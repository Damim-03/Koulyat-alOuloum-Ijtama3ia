import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { emitEvent, emitToUsers, isOnline } from "../../core/realtime/realtime";
import type { Prisma } from "../../generated/prisma";
import {
  SendMessageDTO,
  ReplyMessageDTO,
  BroadcastMessageDTO,
  AudienceDTO,
  ListMessagesDTO,
  ContactsDTO,
  ChatDTO,
} from "./messages.validation";

/**
 * Messages between the people of the platform.
 *
 * Three things this module guarantees:
 *
 *   • **Who may write to whom** is social, not technical — a student writes to
 *     the administration, their supervisor and their team; a professor to the
 *     administration, colleagues and the students of their topics. The same
 *     rules decide the contact list, so the screen never offers a name the
 *     server would refuse.
 *   • **Privacy.** A message is visible to its sender and its recipients only,
 *     and a recipient of a broadcast never sees who else received it.
 *   • **Realtime.** A message reaches its recipients' screens the moment it is
 *     stored, and a read receipt reaches its sender the moment it is read.
 */

/* ── shared selects ─────────────────────────────────────────── */
const userLite = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  avatarUrl: true,
  gender: true,
  role: true,
} as const;

type UserLite = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  avatarUrl: string | null;
  gender: string | null;
  role: string;
};

const notFound = () =>
  new NotFoundException("Message not found", ErrorCodeEnum.RESOURCE_NOT_FOUND);
const bad = (message: string) =>
  new BadRequestException(message, ErrorCodeEnum.VALIDATION_ERROR);

/* ════════════════════════════════════════════════════════════
   REALTIME
   ════════════════════════════════════════════════════════════ */

/** Tells recipients a message arrived — with enough to show it at once. */
function announceNew(
  message: {
    id: string;
    threadId: string | null;
    subject: string | null;
    body: string;
    broadcast: string | null;
    createdAt: Date;
  },
  sender: UserLite,
  recipientIds: string[],
) {
  emitToUsers(recipientIds, "messages", "created", message.id);
  emitEvent(recipientIds, "message:new", {
    id: message.id,
    threadId: message.threadId,
    subject: message.subject,
    preview: message.body.slice(0, 160),
    broadcast: message.broadcast,
    createdAt: message.createdAt.toISOString(),
    sender,
  });
  // The sender's other tabs show it in "sent" without a refresh.
  emitToUsers([sender.id], "messages", "created", message.id);
}

/* ════════════════════════════════════════════════════════════
   WHO MAY WRITE TO WHOM
   ════════════════════════════════════════════════════════════ */

type Relation = "admin" | "supervisor" | "teammate" | "professor" | "student";

/** Everyone a student may write to, and how each is related to them. */
async function studentCircle(userId: string): Promise<Map<string, Relation>> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      projectMembers: {
        select: {
          group: {
            select: {
              topic: { select: { professor: { select: { userId: true } } } },
              members: { select: { student: { select: { userId: true } } } },
            },
          },
        },
      },
      ledGroupRequests: {
        where: { status: { in: ["pending", "accepted"] } },
        select: {
          topic: { select: { professor: { select: { userId: true } } } },
          members: { select: { student: { select: { userId: true } } } },
        },
      },
      groupRequestMembers: {
        where: { request: { status: { in: ["pending", "accepted"] } } },
        select: {
          request: {
            select: {
              topic: { select: { professor: { select: { userId: true } } } },
              leader: { select: { userId: true } },
              members: { select: { student: { select: { userId: true } } } },
            },
          },
        },
      },
    },
  });
  if (!student) throw bad("ملف الطالب غير موجود");

  const circle = new Map<string, Relation>();
  const supervisor = (id?: string | null) => id && circle.set(id, "supervisor");
  const mate = (id?: string | null) =>
    id && id !== userId && !circle.has(id) && circle.set(id, "teammate");

  for (const pm of student.projectMembers) {
    supervisor(pm.group?.topic?.professor?.userId);
    for (const m of pm.group?.members ?? []) mate(m.student?.userId);
  }
  for (const r of student.ledGroupRequests) {
    supervisor(r.topic?.professor?.userId);
    for (const m of r.members ?? []) mate(m.student?.userId);
  }
  for (const gm of student.groupRequestMembers) {
    const req = gm.request;
    supervisor(req?.topic?.professor?.userId);
    mate(req?.leader?.userId);
    for (const m of req?.members ?? []) mate(m.student?.userId);
  }
  return circle;
}

/** The students related to a professor's topics, by user id. */
async function professorStudents(professorId: string, userIds?: string[]) {
  const rows = await prisma.student.findMany({
    where: {
      ...(userIds ? { userId: { in: userIds } } : {}),
      OR: [
        { projectMembers: { some: { group: { topic: { professorId } } } } },
        { ledGroupRequests: { some: { topic: { professorId } } } },
        { groupRequestMembers: { some: { request: { topic: { professorId } } } } },
      ],
    },
    select: { userId: true },
  });
  return new Set(rows.map((s) => s.userId));
}

/**
 * Throws unless `sender` may write to every one of `recipients`.
 *
 * Anyone who has written to you may be answered, whatever the rules would
 * otherwise say: they opened the conversation. A chat where one side can
 * speak and the other cannot reply is not a chat.
 */
async function assertMayWrite(
  sender: { id: string; role: string },
  recipients: { id: string; role: string }[],
) {
  if (sender.role === "admin") return;
  const wroteToMe = new Set(
    (
      await prisma.message.findMany({
        where: {
          senderId: { in: recipients.map((r) => r.id) },
          recipients: { some: { userId: sender.id } },
        },
        select: { senderId: true },
        distinct: ["senderId"],
      })
    ).map((m) => m.senderId),
  );
  recipients = recipients.filter((r) => !wroteToMe.has(r.id));
  if (recipients.length === 0) return;

  if (sender.role === "student") {
    const others = recipients.filter((r) => r.role !== "admin");
    if (others.length === 0) return;
    const circle = await studentCircle(sender.id);
    if (others.some((r) => !circle.has(r.id)))
      throw bad(
        "لا يمكنك مراسلة مستخدمين لا تربطك بهم علاقة أكاديمية (أستاذك المشرف أو أعضاء فريقك أو الإدارة).",
      );
    return;
  }

  if (sender.role === "professor") {
    const students = recipients.filter((r) => r.role === "student");
    if (students.length === 0) return;
    const professor = await prisma.professor.findUnique({
      where: { userId: sender.id },
      select: { id: true },
    });
    if (!professor) throw bad("ملف الأستاذ غير موجود");
    const allowed = await professorStudents(
      professor.id,
      students.map((s) => s.id),
    );
    if (students.some((s) => !allowed.has(s.id)))
      throw bad(
        "يمكنك مراسلة الطلبة المرتبطين بمواضيعك فقط (أعضاء مذكراتك أو أصحاب طلبات المجموعات عليها).",
      );
  }
}

async function activeSender(senderId: string) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { ...userLite, status: true },
  });
  if (!sender)
    throw new NotFoundException("Sender not found", ErrorCodeEnum.RESOURCE_NOT_FOUND);
  if (sender.status !== "active") throw bad("الحساب موقوف — لا يمكن إرسال رسائل");
  const { status: _status, ...lite } = sender;
  return lite as UserLite;
}

/** Stores a message and its recipients in one transaction, then announces it. */
async function deliver(input: {
  sender: UserLite;
  recipientIds: string[];
  subject?: string | null;
  body: string;
  broadcast?: string | null;
  threadId?: string | null;
  replyToId?: string | null;
}) {
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        senderId: input.sender.id,
        subject: input.subject?.trim() || null,
        body: input.body.trim(),
        broadcast: input.broadcast ?? null,
        threadId: input.threadId ?? null,
        replyToId: input.replyToId ?? null,
      },
    });
    await tx.messageRecipient.createMany({
      data: input.recipientIds.map((userId) => ({ messageId: msg.id, userId })),
    });
    return msg;
  });
  announceNew(message, input.sender, input.recipientIds);
  return message;
}

/* ════════════════════════════════════════════════════════════
   SEND (direct)
   ════════════════════════════════════════════════════════════ */
export const sendMessageService = async (senderId: string, dto: SendMessageDTO) => {
  const sender = await activeSender(senderId);

  const recipientIds = [...new Set(dto.recipientIds)].filter((id) => id !== senderId);
  if (recipientIds.length === 0) throw bad("حدّد مستلماً واحداً على الأقل");

  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, role: true, status: true },
  });
  if (recipients.length !== recipientIds.length) throw bad("بعض المستلمين غير موجودين");
  if (recipients.some((r) => r.status !== "active"))
    throw bad("بعض المستلمين حساباتهم موقوفة — أزلهم من القائمة ثمّ أعد الإرسال");

  await assertMayWrite(sender, recipients);

  const message = await deliver({
    sender,
    recipientIds,
    subject: dto.subject,
    body: dto.body,
  });
  return shapeOne(senderId, message.id);
};

/* ════════════════════════════════════════════════════════════
   REPLY — in the same conversation
   ════════════════════════════════════════════════════════════ */
export const replyMessageService = async (
  userId: string,
  parentId: string,
  dto: ReplyMessageDTO,
) => {
  const sender = await activeSender(userId);
  const parent = await prisma.message.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      senderId: true,
      broadcast: true,
      threadId: true,
      recipients: { select: { userId: true, deletedAt: true } },
    },
  });
  if (!parent) throw notFound();

  const mine = parent.senderId === userId;
  const myRow = parent.recipients.find((r) => r.userId === userId);
  if (!mine && (!myRow || myRow.deletedAt)) throw notFound();

  let recipientIds: string[];
  // Answering the person who wrote to you needs no further permission: they
  // opened the conversation. Anyone else added by "reply all" does.
  let checkIds: string[] = [];
  if (mine) {
    if (parent.broadcast)
      throw bad("لا يُردّ على تعميمٍ أرسلتَه — أرسل تعميماً جديداً أو رسالةً مباشرة");
    recipientIds = parent.recipients.map((r) => r.userId);
  } else {
    const others =
      dto.all && !parent.broadcast
        ? parent.recipients.map((r) => r.userId).filter((id) => id !== userId)
        : [];
    recipientIds = [parent.senderId, ...others];
    checkIds = others;
  }
  recipientIds = [...new Set(recipientIds)].filter((id) => id !== userId);

  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds }, status: "active" },
    select: { id: true, role: true },
  });
  if (users.length === 0) throw bad("لم يعد في المحادثة من يستقبل الرسالة");
  if (checkIds.length)
    await assertMayWrite(
      sender,
      users.filter((u) => checkIds.includes(u.id)),
    );

  const message = await deliver({
    sender,
    recipientIds: users.map((u) => u.id),
    body: dto.body,
    threadId: parent.threadId ?? parent.id,
    replyToId: parent.id,
  });
  return shapeOne(userId, message.id);
};

/* ════════════════════════════════════════════════════════════
   BROADCAST — admins only (enforced at the route level)
   ════════════════════════════════════════════════════════════ */

/** The users a broadcast audience describes: active accounts only. */
async function audienceUserIds(dto: AudienceDTO, excludeId: string) {
  const active = { status: "active" as const };

  if (dto.target === "students" || dto.target === "all") {
    // Most specific academic filter wins, as in every other list.
    const spec: Prisma.SpecializationWhereInput = {};
    if (dto.specializationId) Object.assign(spec, { id: dto.specializationId });
    else if (dto.filiereId) Object.assign(spec, { filiereId: dto.filiereId });
    else if (dto.departmentId) Object.assign(spec, { filiere: { departmentId: dto.departmentId } });
    else if (dto.facultyId)
      Object.assign(spec, { filiere: { department: { facultyId: dto.facultyId } } });
    if (dto.level) Object.assign(spec, { level: dto.level });

    const where: Prisma.StudentWhereInput = {
      user: active,
      ...(Object.keys(spec).length ? { specialization: spec } : {}),
      ...(dto.academicYearId ? { academicYearId: dto.academicYearId } : {}),
      ...(dto.project === "with"
        ? { projectMembers: { some: {} } }
        : dto.project === "without"
          ? { projectMembers: { none: {} } }
          : {}),
    };
    const students =
      dto.target === "students" || hasStudentFilters(dto)
        ? await prisma.student.findMany({ where, select: { userId: true } })
        : null;

    if (dto.target === "students")
      return students!.map((s) => s.userId).filter((id) => id !== excludeId);

    // "all" without filters: every active student and professor.
    if (!students) {
      const users = await prisma.user.findMany({
        where: { ...active, role: { in: ["student", "professor"] }, id: { not: excludeId } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    const profs = await professorsOf(dto);
    return [...new Set([...students.map((s) => s.userId), ...profs])].filter(
      (id) => id !== excludeId,
    );
  }

  if (dto.target === "professors")
    return (await professorsOf(dto)).filter((id) => id !== excludeId);

  // admins
  const admins = await prisma.user.findMany({
    where: { ...active, role: "admin", id: { not: excludeId } },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

const hasStudentFilters = (d: AudienceDTO) =>
  !!(d.facultyId || d.departmentId || d.filiereId || d.specializationId || d.academicYearId || d.level || d.project);

async function professorsOf(dto: AudienceDTO) {
  const where: Prisma.ProfessorWhereInput = { user: { status: "active" } };
  if (dto.departmentId) where.departmentId = dto.departmentId;
  else if (dto.facultyId) where.department = { facultyId: dto.facultyId };
  const rows = await prisma.professor.findMany({ where, select: { userId: true } });
  return rows.map((p) => p.userId);
}

/**
 * The broadcast tag: `target|names`. The names are what the audience was
 * narrowed by, so the message can say "students · Master · Clinical psych."
 * forever after, even if those entities are later renamed or removed.
 */
async function audienceTag(dto: AudienceDTO) {
  const [faculty, department, filiere, spec, year] = await Promise.all([
    dto.facultyId ? prisma.faculty.findUnique({ where: { id: dto.facultyId }, select: { name: true } }) : null,
    dto.departmentId ? prisma.department.findUnique({ where: { id: dto.departmentId }, select: { name: true } }) : null,
    dto.filiereId ? prisma.filiere.findUnique({ where: { id: dto.filiereId }, select: { name: true } }) : null,
    dto.specializationId
      ? prisma.specialization.findUnique({ where: { id: dto.specializationId }, select: { name: true } })
      : null,
    dto.academicYearId
      ? prisma.academicYear.findUnique({ where: { id: dto.academicYearId }, select: { title: true } })
      : null,
  ]);
  const names = [
    spec?.name ?? filiere?.name ?? department?.name ?? faculty?.name,
    dto.level ? `@${dto.level}` : null,
    year?.title,
    dto.project ? `@project-${dto.project}` : null,
  ].filter(Boolean);
  return `${dto.target}${names.length ? `|${names.join(" · ")}` : ""}`.slice(0, 191);
}

export const audiencePreviewService = async (senderId: string, dto: AudienceDTO) => {
  const ids = await audienceUserIds(dto, senderId);
  const sample = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids.slice(0, 200) } },
        select: userLite,
        take: 6,
      })
    : [];
  return { count: ids.length, sample };
};

export const broadcastMessageService = async (senderId: string, dto: BroadcastMessageDTO) => {
  const sender = await activeSender(senderId);
  const { subject, body, ...audience } = dto;
  const userIds = await audienceUserIds(audience, senderId);
  if (userIds.length === 0) throw bad("لا يوجد مستلمون مطابقون لهذا الجمهور");

  const message = await deliver({
    sender,
    recipientIds: userIds,
    subject,
    body,
    broadcast: await audienceTag(audience),
  });
  return { id: message.id, recipients: userIds.length };
};

/* ════════════════════════════════════════════════════════════
   CONTACTS — the people the current user may write to
   ════════════════════════════════════════════════════════════ */
const contactSelect = {
  ...userLite,
  email: true,
  student: {
    select: { registrationNumber: true, specialization: { select: { name: true } } },
  },
  professor: {
    select: { universityEmail: true, department: { select: { name: true } } },
  },
} as const;

function nameFilter(term?: string): Prisma.UserWhereInput {
  if (!term) return {};
  const words = term.split(/\s+/).filter(Boolean).slice(0, 4);
  return {
    AND: words.map((w) => ({
      OR: [
        { firstName: { contains: w } },
        { lastName: { contains: w } },
        { email: { contains: w } },
        { username: { contains: w } },
        { student: { registrationNumber: { contains: w } } },
        { professor: { universityEmail: { contains: w } } },
      ],
    })),
  };
}

export const contactsService = async (userId: string, q: ContactsDTO) => {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!me) throw notFound();

  let ids: string[] | null = null; // null = anyone (admin)
  const relation = new Map<string, Relation>();

  if (me.role === "student") {
    const circle = await studentCircle(userId);
    circle.forEach((rel, id) => relation.set(id, rel));
    ids = [...circle.keys()];
  } else if (me.role === "professor") {
    const professor = await prisma.professor.findUnique({ where: { userId }, select: { id: true } });
    if (professor) {
      const students = await professorStudents(professor.id);
      students.forEach((id) => relation.set(id, "student"));
      ids = [...students];
    } else ids = [];
  }

  const roleWhere: Prisma.UserWhereInput =
    me.role === "admin"
      ? {}
      : me.role === "professor"
        ? { OR: [{ role: { in: ["admin", "professor"] } }, { id: { in: ids ?? [] } }] }
        : { OR: [{ role: "admin" }, { id: { in: ids ?? [] } }] };

  // With nothing typed, people you have corresponded with come first.
  let recentIds: string[] = [];
  if (!q.search) {
    const recent = await prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { recipients: { some: { userId } } }], broadcast: null },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { senderId: true, recipients: { select: { userId: true }, take: 5 } },
    });
    recentIds = [
      ...new Set(recent.flatMap((m) => [m.senderId, ...m.recipients.map((r) => r.userId)])),
    ].filter((id) => id !== userId);
  }

  const where: Prisma.UserWhereInput = {
    AND: [{ id: { not: userId } }, { status: "active" }, roleWhere, nameFilter(q.search)],
  };
  const byRecent = new Map(recentIds.map((id, i) => [id, i]));

  /**
   * One quota per role. A single list ordered by role let the first role
   * fill every slot — twelve professors and not one student — so each role
   * is fetched on its own, people you wrote to recently first within it.
   */
  const ROLES = ["admin", "professor", "student"] as const;
  const roles = q.role ? [q.role] : ROLES;
  const [groups, counts] = await Promise.all([
    Promise.all(
      roles.map(async (role) => {
        const scoped: Prisma.UserWhereInput = { AND: [where, { role }] };
        const [recent, rest] = await Promise.all([
          recentIds.length
            ? prisma.user.findMany({
                where: { AND: [scoped, { id: { in: recentIds } }] },
                select: contactSelect,
                take: q.limit,
              })
            : [],
          prisma.user.findMany({
            where: scoped,
            select: contactSelect,
            take: q.limit,
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          }),
        ]);
        recent.sort((a, b) => (byRecent.get(a.id) ?? 0) - (byRecent.get(b.id) ?? 0));
        const seen = new Set<string>();
        return [...recent, ...rest]
          .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))
          .slice(0, q.limit);
      }),
    ),
    // How many of each role match — for the tabs, whichever one is open.
    Promise.all(ROLES.map((role) => prisma.user.count({ where: { AND: [where, { role }] } }))),
  ]);

  return {
    items: groups.flat().map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      firstNameLatin: u.firstNameLatin,
      lastNameLatin: u.lastNameLatin,
      avatarUrl: u.avatarUrl,
      gender: u.gender,
      role: u.role,
      relation:
        relation.get(u.id) ?? (u.role === "admin" ? "admin" : u.role === "professor" ? "professor" : "student"),
      detail:
        u.student?.specialization?.name ??
        u.professor?.department?.name ??
        null,
      // Identifiers only for the administration, which already sees them.
      handle:
        me.role === "admin"
          ? (u.student?.registrationNumber ?? u.professor?.universityEmail ?? u.email ?? null)
          : null,
      recent: byRecent.has(u.id),
    })),
    counts: { admin: counts[0], professor: counts[1], student: counts[2] },
  };
};

/* ════════════════════════════════════════════════════════════
   INBOX / SENT / SUMMARY
   ════════════════════════════════════════════════════════════ */
function searchWhere(term?: string): Prisma.MessageWhereInput {
  if (!term) return {};
  return {
    OR: [
      { subject: { contains: term } },
      { body: { contains: term } },
      { sender: { firstName: { contains: term } } },
      { sender: { lastName: { contains: term } } },
    ],
  };
}

export const listInboxService = async (userId: string, q: ListMessagesDTO) => {
  const filter = q.filter ?? (q.unread ? "unread" : "all");
  const where: Prisma.MessageRecipientWhereInput = {
    userId,
    deletedAt: null,
    ...(filter === "unread" ? { readAt: null } : {}),
    message: {
      ...searchWhere(q.search),
      ...(filter === "broadcast" ? { broadcast: { not: null } } : {}),
      ...(filter === "direct" ? { broadcast: null } : {}),
    },
  };

  const [items, total] = await Promise.all([
    prisma.messageRecipient.findMany({
      where,
      include: {
        message: {
          select: {
            id: true,
            senderId: true,
            subject: true,
            body: true,
            broadcast: true,
            threadId: true,
            replyToId: true,
            createdAt: true,
            sender: { select: userLite },
          },
        },
      },
      orderBy: { message: { createdAt: "desc" } },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.messageRecipient.count({ where }),
  ]);

  return { items, total, page: q.page, limit: q.limit };
};

export const listSentService = async (userId: string, q: ListMessagesDTO) => {
  const where: Prisma.MessageWhereInput = {
    senderId: userId,
    ...searchWhere(q.search),
    ...(q.filter === "broadcast" ? { broadcast: { not: null } } : {}),
    ...(q.filter === "direct" ? { broadcast: null } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        recipients: { include: { user: { select: userLite } }, take: 4 },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.message.count({ where }),
  ]);

  // How many have read each one — one grouped query for the whole page.
  const reads = rows.length
    ? await prisma.messageRecipient.groupBy({
        by: ["messageId"],
        where: { messageId: { in: rows.map((m) => m.id) }, readAt: { not: null } },
        _count: { _all: true },
      })
    : [];
  const readBy = new Map(reads.map((r) => [r.messageId, r._count._all]));

  return {
    items: rows.map((m) => ({ ...m, readCount: readBy.get(m.id) ?? 0 })),
    total,
    page: q.page,
    limit: q.limit,
  };
};

export const unreadCountService = async (userId: string) => {
  const count = await prisma.messageRecipient.count({
    where: { userId, readAt: null, deletedAt: null },
  });
  return { count };
};

export const summaryService = async (userId: string) => {
  const [unread, inbox, sent] = await Promise.all([
    prisma.messageRecipient.count({ where: { userId, readAt: null, deletedAt: null } }),
    prisma.messageRecipient.count({ where: { userId, deletedAt: null } }),
    prisma.message.count({ where: { senderId: userId } }),
  ]);
  return { unread, inbox, sent };
};

/* ════════════════════════════════════════════════════════════
   ONE MESSAGE — and the conversation it belongs to
   ════════════════════════════════════════════════════════════ */

/**
 * A message as the given user may see it. Its sender sees every recipient and
 * when each read it; a recipient of a direct message sees who else it went to
 * (as in any mail "To:" line); a recipient of a broadcast sees no one.
 */
async function shapeOne(userId: string, id: string) {
  const m = await prisma.message.findUnique({
    where: { id },
    include: {
      sender: { select: userLite },
      _count: { select: { recipients: true } },
    },
  });
  if (!m) throw notFound();
  const [shaped] = await shapeMany(userId, [m]);
  return shaped;
}

async function shapeMany(
  userId: string,
  list: {
    id: string;
    senderId: string;
    subject: string | null;
    body: string;
    broadcast: string | null;
    threadId: string | null;
    replyToId: string | null;
    createdAt: Date;
    sender: UserLite;
    _count: { recipients: number };
  }[],
) {
  const ids = list.map((m) => m.id);
  const sentIds = list.filter((m) => m.senderId === userId).map((m) => m.id);
  const directIds = list.filter((m) => m.senderId !== userId && !m.broadcast).map((m) => m.id);

  const [mineRows, sentRecipients, reads, directRecipients] = await Promise.all([
    prisma.messageRecipient.findMany({
      where: { messageId: { in: ids }, userId },
      select: { messageId: true, readAt: true },
    }),
    sentIds.length
      ? prisma.messageRecipient.findMany({
          where: { messageId: { in: sentIds } },
          select: { messageId: true, readAt: true, user: { select: userLite } },
          orderBy: { readAt: "desc" },
          take: 60 * sentIds.length,
        })
      : [],
    sentIds.length
      ? prisma.messageRecipient.groupBy({
          by: ["messageId"],
          where: { messageId: { in: sentIds }, readAt: { not: null } },
          _count: { _all: true },
        })
      : [],
    directIds.length
      ? prisma.messageRecipient.findMany({
          where: { messageId: { in: directIds } },
          select: { messageId: true, user: { select: userLite } },
          take: 20 * directIds.length,
        })
      : [],
  ]);
  const mine = new Map(mineRows.map((r) => [r.messageId, r.readAt]));
  const readCount = new Map(reads.map((r) => [r.messageId, r._count._all]));

  return list.map((m) => {
    const isMine = m.senderId === userId;
    return {
      id: m.id,
      senderId: m.senderId,
      subject: m.subject,
      body: m.body,
      broadcast: m.broadcast,
      threadId: m.threadId,
      replyToId: m.replyToId,
      createdAt: m.createdAt,
      sender: m.sender,
      mine: isMine,
      readAt: mine.get(m.id) ?? null,
      recipientsCount: m._count.recipients,
      ...(isMine
        ? {
            readCount: readCount.get(m.id) ?? 0,
            recipients: sentRecipients
              .filter((r) => r.messageId === m.id)
              .slice(0, 60)
              .map((r) => ({ user: r.user, readAt: r.readAt })),
          }
        : !m.broadcast
          ? {
              recipients: directRecipients
                .filter((r) => r.messageId === m.id && r.user.id !== userId)
                .slice(0, 20)
                .map((r) => ({ user: r.user, readAt: null })),
            }
          : {}),
    };
  });
}

/** Loads a message if `userId` may see it, else 404 — never 403. */
async function visible(userId: string, id: string) {
  const m = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      senderId: true,
      threadId: true,
      recipients: { where: { userId }, select: { deletedAt: true } },
    },
  });
  if (!m) throw notFound();
  const mine = m.senderId === userId;
  const row = m.recipients[0];
  if (!mine && (!row || row.deletedAt)) throw notFound();
  return m;
}

export const getMessageService = async (userId: string, messageId: string) => {
  const m = await visible(userId, messageId);
  const rootId = m.threadId ?? m.id;

  const list = await prisma.message.findMany({
    where: {
      AND: [
        { OR: [{ id: rootId }, { threadId: rootId }] },
        {
          OR: [
            { senderId: userId },
            { recipients: { some: { userId, deletedAt: null } } },
          ],
        },
      ],
    },
    include: {
      sender: { select: userLite },
      _count: { select: { recipients: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const thread = await shapeMany(userId, list);
  const message = thread.find((x) => x.id === messageId) ?? (await shapeOne(userId, messageId));
  const root = list.find((x) => x.id === rootId);

  return {
    message,
    thread,
    rootId,
    subject: root?.subject ?? message.subject,
  };
};

/* ════════════════════════════════════════════════════════════
   READ / UNREAD / DELETE (for the recipient)
   ════════════════════════════════════════════════════════════ */

/** Receipts reach the senders of whatever was just read, and my other tabs. */
async function announceRead(userId: string, messageIds: string[]) {
  if (messageIds.length === 0) return;
  const senders = await prisma.message.findMany({
    where: { id: { in: messageIds } },
    select: { senderId: true },
    distinct: ["senderId"],
  });
  emitToUsers([userId, ...senders.map((s) => s.senderId)], "messages", "updated");
}

/** Marks the message — and the rest of its conversation — read for me. */
export const markMessageReadService = async (userId: string, messageId: string) => {
  const rec = await prisma.messageRecipient.findUnique({
    where: { messageId_userId: { messageId, userId } },
    select: { id: true, deletedAt: true, message: { select: { threadId: true } } },
  });
  if (!rec || rec.deletedAt) throw notFound();

  const rootId = rec.message.threadId ?? messageId;
  const unread = await prisma.messageRecipient.findMany({
    where: {
      userId,
      readAt: null,
      deletedAt: null,
      message: { OR: [{ id: rootId }, { threadId: rootId }, { id: messageId }] },
    },
    select: { id: true, messageId: true },
  });
  if (unread.length === 0) return { ok: true, updated: 0 };

  await prisma.messageRecipient.updateMany({
    where: { id: { in: unread.map((u) => u.id) } },
    data: { readAt: new Date() },
  });
  await announceRead(userId, unread.map((u) => u.messageId));
  return { ok: true, updated: unread.length };
};

export const markMessageUnreadService = async (userId: string, messageId: string) => {
  const rec = await prisma.messageRecipient.findUnique({
    where: { messageId_userId: { messageId, userId } },
    select: { id: true, deletedAt: true },
  });
  if (!rec || rec.deletedAt) throw notFound();
  await prisma.messageRecipient.update({ where: { id: rec.id }, data: { readAt: null } });
  await announceRead(userId, [messageId]);
  return { ok: true };
};

export const markAllReadService = async (userId: string) => {
  const unread = await prisma.messageRecipient.findMany({
    where: { userId, readAt: null, deletedAt: null },
    select: { messageId: true },
  });
  if (unread.length === 0) return { updated: 0 };
  const res = await prisma.messageRecipient.updateMany({
    where: { userId, readAt: null, deletedAt: null },
    data: { readAt: new Date() },
  });
  await announceRead(userId, unread.map((u) => u.messageId));
  return { updated: res.count };
};

/**
 * Removes the message from the recipient's inbox only. The row is kept, so the
 * sender's copy still says how many it went to and who read it.
 */
export const deleteInboxMessageService = async (userId: string, messageId: string) => {
  const rec = await prisma.messageRecipient.findUnique({
    where: { messageId_userId: { messageId, userId } },
    select: { id: true, deletedAt: true, readAt: true },
  });
  if (!rec || rec.deletedAt) throw notFound();
  await prisma.messageRecipient.update({
    where: { id: rec.id },
    data: { deletedAt: new Date(), readAt: rec.readAt ?? new Date() },
  });
  emitToUsers([userId], "messages", "deleted", messageId);
  return { ok: true };
};

/* ════════════════════════════════════════════════════════════
   CHATS — one conversation per person, as in any messenger
   ════════════════════════════════════════════════════════════
   The same messages, seen per counterpart: everything I sent to someone
   (broadcasts aside — those have their own list) and everything they sent
   me, broadcasts included. A message to several people shows in the chat
   with each of them. */

/** Whether `senderId` may write to `recipientId` now — for the composer and typing. */
export const mayWrite = async (senderId: string, recipientId: string) => {
  if (senderId === recipientId) return false;
  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: { id: true, role: true, status: true } }),
    prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, role: true, status: true } }),
  ]);
  if (!sender || !recipient || sender.status !== "active" || recipient.status !== "active") return false;
  try {
    await assertMayWrite(sender, [recipient]);
    return true;
  } catch {
    return false;
  }
};

const counterpartSelect = {
  ...userLite,
  status: true,
  lastLoginAt: true,
  student: { select: { registrationNumber: true, specialization: { select: { name: true } } } },
  professor: { select: { department: { select: { name: true } } } },
} as const;

type Counterpart = Prisma.UserGetPayload<{ select: typeof counterpartSelect }>;

function shapeCounterpart(u: Counterpart, viewerRole: string) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    firstNameLatin: u.firstNameLatin,
    lastNameLatin: u.lastNameLatin,
    avatarUrl: u.avatarUrl,
    gender: u.gender,
    role: u.role,
    detail: u.student?.specialization?.name ?? u.professor?.department?.name ?? null,
    handle: viewerRole === "admin" ? (u.student?.registrationNumber ?? null) : null,
    active: u.status === "active",
    online: isOnline(u.id),
    lastLoginAt: u.lastLoginAt,
  };
}

export const conversationsService = async (userId: string, limit = 60) => {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!me) throw notFound();

  // The most recent activity is enough to order and badge the list.
  const [received, sent] = await Promise.all([
    prisma.messageRecipient.findMany({
      where: { userId, deletedAt: null },
      select: { readAt: true, message: { select: { id: true, senderId: true, createdAt: true } } },
      orderBy: { message: { createdAt: "desc" } },
      take: 3000,
    }),
    prisma.message.findMany({
      where: { senderId: userId, broadcast: null },
      select: { id: true, createdAt: true, recipients: { select: { userId: true, readAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
  ]);

  type Acc = { lastAt: Date; lastId: string; mine: boolean; read: boolean; unread: number };
  const acc = new Map<string, Acc>();
  const bump = (other: string, at: Date, id: string, mine: boolean, read: boolean) => {
    const cur = acc.get(other);
    if (!cur) acc.set(other, { lastAt: at, lastId: id, mine, read, unread: 0 });
    else if (at > cur.lastAt) Object.assign(cur, { lastAt: at, lastId: id, mine, read });
  };
  for (const r of received) {
    const other = r.message.senderId;
    if (other === userId) continue;
    bump(other, r.message.createdAt, r.message.id, false, !!r.readAt);
    if (!r.readAt) acc.get(other)!.unread += 1;
  }
  for (const m of sent)
    for (const rec of m.recipients) {
      if (rec.userId === userId) continue;
      bump(rec.userId, m.createdAt, m.id, true, !!rec.readAt);
    }

  const top = [...acc.entries()]
    .sort((a, b) => b[1].lastAt.getTime() - a[1].lastAt.getTime())
    .slice(0, limit);
  const [users, lasts] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: counterpartSelect }),
    prisma.message.findMany({
      where: { id: { in: top.map(([, a]) => a.lastId) } },
      select: { id: true, subject: true, body: true, broadcast: true, createdAt: true },
    }),
  ]);
  const userBy = new Map(users.map((u) => [u.id, u]));
  const lastBy = new Map(lasts.map((m) => [m.id, m]));

  return {
    items: top
      .filter(([id]) => userBy.has(id))
      .map(([id, a]) => {
        const last = lastBy.get(a.lastId);
        return {
          user: shapeCounterpart(userBy.get(id)!, me.role),
          unread: a.unread,
          last: last
            ? {
                id: last.id,
                subject: last.subject,
                preview: last.body.slice(0, 140),
                broadcast: last.broadcast,
                createdAt: last.createdAt,
                mine: a.mine,
                read: a.read,
              }
            : null,
        };
      }),
    unread: [...acc.values()].reduce((n, a) => n + a.unread, 0),
  };
};

export const chatService = async (userId: string, otherId: string, q: ChatDTO) => {
  const [me, other] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.user.findUnique({ where: { id: otherId }, select: counterpartSelect }),
  ]);
  if (!me || !other || otherId === userId) throw notFound();

  const where: Prisma.MessageWhereInput = {
    AND: [
      {
        OR: [
          { senderId: userId, broadcast: null, recipients: { some: { userId: otherId } } },
          { senderId: otherId, recipients: { some: { userId, deletedAt: null } } },
        ],
      },
      q.before ? { createdAt: { lt: new Date(q.before) } } : {},
    ],
  };
  const rows = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: q.limit + 1,
    select: {
      id: true,
      senderId: true,
      subject: true,
      body: true,
      broadcast: true,
      threadId: true,
      replyToId: true,
      createdAt: true,
      _count: { select: { recipients: true } },
    },
  });
  const hasMore = rows.length > q.limit;
  const page = rows.slice(0, q.limit).reverse();

  const receipts = page.length
    ? await prisma.messageRecipient.findMany({
        where: { messageId: { in: page.map((m) => m.id) }, userId: { in: [userId, otherId] } },
        select: { messageId: true, userId: true, readAt: true },
      })
    : [];
  const readOf = (messageId: string, who: string) =>
    receipts.find((r) => r.messageId === messageId && r.userId === who)?.readAt ?? null;

  return {
    user: shapeCounterpart(other, me.role),
    canWrite: await mayWrite(userId, otherId),
    hasMore,
    items: page.map((m) => {
      const mine = m.senderId === userId;
      return {
        id: m.id,
        senderId: m.senderId,
        subject: m.subject,
        body: m.body,
        broadcast: m.broadcast,
        threadId: m.threadId,
        replyToId: m.replyToId,
        createdAt: m.createdAt,
        mine,
        // Mine: when they read it. Theirs: when I did.
        readAt: readOf(m.id, mine ? otherId : userId),
        recipientsCount: m._count.recipients,
      };
    }),
  };
};

/** Everything this person sent me is now read — and they see it at once. */
export const markChatReadService = async (userId: string, otherId: string) => {
  const unread = await prisma.messageRecipient.findMany({
    where: { userId, readAt: null, deletedAt: null, message: { senderId: otherId } },
    select: { id: true, messageId: true },
  });
  if (unread.length === 0) return { updated: 0 };
  await prisma.messageRecipient.updateMany({
    where: { id: { in: unread.map((u) => u.id) } },
    data: { readAt: new Date() },
  });
  await announceRead(userId, unread.map((u) => u.messageId));
  return { updated: unread.length };
};

export const presenceService = (ids: string[]) => ({
  online: Object.fromEntries(ids.slice(0, 100).map((id) => [id, isOnline(id)])),
});
