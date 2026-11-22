import { prisma } from "../../core/prisma/client";
import type { Prisma } from "../../generated/prisma";
import {
  AVAILABLE_TO_STUDENTS,
  COUNTED_ON_CAP,
  computeTopicStatus,
} from "../../core/topic/topic-status";
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { CreateGroupRequestDTO, ListTopicsDTO } from "./student.validation";
import { badgeUser, professorBadge } from "../../core/prisma/selects";
import { notifyAdminsQuietly } from "../notification/notification.service";
import { tr } from "../../core/i18n";
import { assertSelectionNotClosed, assertSelectionOpen, selectionWindowState } from "../../core/academic/selection-window";

//
// ─── resolve the Student row for the logged-in user ───────────
//

const getStudent = async (userId: string) => {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw new NotFoundException(
      tr("notFound.student"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  return student;
};

/** Just enough of a person to put a name and an avatar on screen. */
const personLite = {
  select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, avatarUrl: true, gender: true },
} as const;

//
// ═══════════════════════════════════════════════════════════════
//  BROWSE PUBLISHED TOPICS
// ═══════════════════════════════════════════════════════════════
//

// Only topics the admin has approved/opened are visible to students.
export const browseTopicsService = async (
  userId: string,
  filters: ListTopicsDTO,
) => {
  await getStudent(userId);

  return prisma.graduationTopic.findMany({
    where: {
      // «متاح» يُعرَّف في مكان واحد (core/topic/topic-status) وتستورده كل
      // شاشة تعرض المواضيع، بدل أن تشتقّه كل واحدة بطريقتها.
      ...AVAILABLE_TO_STUDENTS,
      ...(filters.specializationId
        ? { specializationId: filters.specializationId }
        : {}),
      ...(filters.academicYearId
        ? { academicYearId: filters.academicYearId }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search } },
              {
                description: { contains: filters.search },
              },
            ],
          }
        : {}),
    },
    include: {
      specialization: true,
      academicYear: true,
      professor: professorBadge,
      _count: { select: { groupRequests: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getTopicByIdService = async (userId: string, topicId: string) => {
  await getStudent(userId);

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
    include: {
      specialization: true,
      academicYear: true,
      professor: professorBadge,
    },
  });

  if (!topic) {
    throw new NotFoundException(
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  // Students may only view published topics.
  if (topic.status !== "approved" && topic.status !== "open") {
    throw new UnauthorizedException(
      tr("student.topicUnavailable"),
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }
  return topic;
};

//
// ═══════════════════════════════════════════════════════════════
//  STUDENT LOOKUP  (live teammate search by registration number)
// ═══════════════════════════════════════════════════════════════
//

/**
 * طلبٌ حيٌّ لفريقٍ غير فريق هذا المرسِل.
 *
 * «حيّ» كما في كلّ مكان: معلّقٌ أو مقبول — المرفوضُ انتهى ولا يحبس أحداً.
 * وطلباتُ المرسِل نفسه مستثناة: الفريقُ الواحد يطلب أكثر من موضوعٍ بأولوياتٍ
 * مختلفة، والزميلُ فيها كلّها هو الزميلُ نفسه لا عضوٌ في «مجموعة أخرى».
 */
const otherTeamsLiveRequest = (leaderStudentId: string) => ({
  status: { in: ["pending", "accepted"] as ("pending" | "accepted")[] },
  leaderStudentId: { not: leaderStudentId },
});

// Returns the student (id + name) matching a registration number, or
// null if none. Used by the group-request dialog for live validation.
//
// `isSelf` يُقرّر بالمعرّف لا بالنصّ: الترتيب (collation) في قاعدة البيانات
// قد يُطابق رقماً مكتوباً بأرقامٍ عربية أو بحالة حروفٍ أخرى مع رقم الطالب
// نفسه، فيمرّ من مقارنة النصوص في المتصفّح. والمعرّف لا يُخدع.
export const lookupStudentByRegistrationService = async (
  userId: string,
  registration: string,
) => {
  const me = await getStudent(userId); // only an authenticated student may search

  const reg = registration.trim();
  if (!reg) {
    throw new BadRequestException(
      tr("student.registrationRequired"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // وفي النداء نفسه: هل هو في مجموعةٍ أخرى؟ — فيُرفض في مقعده قبل الإرسال.
  const found = await prisma.student.findUnique({
    where: { registrationNumber: reg },
    select: {
      id: true,
      registrationNumber: true,
      user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
      specialization: { select: { name: true } },
      projectMembers: { select: { id: true }, take: 1 },
      groupRequestMembers: {
        where: { request: otherTeamsLiveRequest(me.id) },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!found) return null;

  const { projectMembers, groupRequestMembers, ...student } = found;
  const isSelf = found.id === me.id;
  return {
    ...student,
    isSelf,
    otherGroup: isSelf
      ? null
      : projectMembers.length
        ? ("project" as const)
        : groupRequestMembers.length
          ? ("request" as const)
          : null,
  };
};

//
// ═══════════════════════════════════════════════════════════════
//  GROUP REQUESTS  (the leader assembles a team and submits)
// ═══════════════════════════════════════════════════════════════
//

/**
 * Still takes a request: published (or approved) with no group, and — when
 * published — fewer pending requests than its cap. Said with the reason that
 * applies: the cap is full, or the topic has been taken.
 */
const assertStillOpen = async (
  db: Prisma.TransactionClient | typeof prisma,
  topic: { id: string; maxRequests: number | null },
) => {
  const open = await db.graduationTopic.findFirst({
    where: { id: topic.id, ...AVAILABLE_TO_STUDENTS },
    select: { id: true },
  });
  if (open) return;
  const pending = await db.groupRequest.count({ where: { topicId: topic.id, ...COUNTED_ON_CAP } });
  throw new BadRequestException(
    topic.maxRequests !== null && pending >= topic.maxRequests
      ? tr("student.requestCap", { max: topic.maxRequests })
      : tr("student.topicReserved"),
    ErrorCodeEnum.VALIDATION_ERROR,
  );
};

export const createGroupRequestService = async (
  userId: string,
  data: CreateGroupRequestDTO,
) => {
  const leader = await getStudent(userId);

  // 1. Topic must exist and be published.
  const topic = await prisma.graduationTopic.findUnique({
    where: { id: data.topicId },
  });
  if (!topic) {
    throw new NotFoundException(
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  if (topic.status !== "approved" && topic.status !== "open") {
    throw new BadRequestException(
      tr("student.topicNotOpen"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 1.a.a مهلة اختيار المواضيع لسنة الموضوع (core/academic/selection-window):
  // قبلها وبعدها لا طلب — بتاريخها، لا بخطأٍ عامّ.
  await assertSelectionOpen(topic.academicYearId);

  // 1.a.b طلبُ فريقي على هذا الموضوع، إن كان ما يزال حيّاً.
  //
  // ويسبق فحصَ الإتاحة عمداً: الطلبُ الحيّ هو نفسه ما يحجز الموضوع، فلو
  // تُرك للفحص التالي لقيل لصاحبه «هذا الموضوع محجوز بالفعل» — وهو محجوزٌ
  // له هو، فيبحث عمّن سبقه ولا أحد.
  //
  // ولا يقتصر على المرسِل: العضوُ في الطلب الحيّ يُردّ كذلك، وبرسالةٍ تقول
  // إنّ **فريقه** هو الذي أرسل — لا أنّ مجهولاً سبقه. فالمجموعة ترسل طلباً
  // واحداً على الموضوع، من أيّ أعضائها جاء.
  //
  // و«حيّ» وحده: الطلبُ المرفوض لا يمنع إعادة المحاولة. الرفضُ قد يكون
  // لنقصٍ يُستدرك — عضوٌ ناقص، أو ورقةٌ لم تُرفق — وقد يكون خطأً من الإدارة
  // نفسها. والذي يحدّ التكرار هو سقفُ المحاولات لا منعُ المحاولة الثانية.
  const mine = await prisma.groupRequest.findFirst({
    where: {
      topicId: topic.id,
      status: { in: ["pending", "accepted"] },
      OR: [
        { leaderStudentId: leader.id },
        { members: { some: { studentId: leader.id } } },
      ],
    },
    select: { status: true, leaderStudentId: true },
  });
  if (mine) {
    const isLeader = mine.leaderStudentId === leader.id;
    throw new BadRequestException(
      mine.status === "accepted"
        ? isLeader
          ? tr("student.ownAccepted")
          : tr("student.teamAccepted")
        : isLeader
          ? tr("student.ownPending")
          : tr("student.teamPending"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 1.a.c المرسِل نفسه، بالقاعدة التي يُفحص بها زملاؤه (2.b).
  //
  // كان الفحصُ على الزملاء وحدهم: أيمن عضوٌ في فريق أحمد — أو له مشروعٌ
  // قائم — يُرسل طلباً بنفسه ومعه علاء وحسام، فيُفحص علاء وحسام ولا يُفحص
  // هو. فيمرّ الطلب، وإن قُبل صار أيمن في مشروعين.
  //
  // وطلباتُ المرسِل التي أرسلها هو مستثناةٌ كما هناك: هي الفريقُ نفسه يطلب
  // موضوعاً ثانياً بأولويةٍ أخرى.
  const [ownProject, ownOtherTeam] = await Promise.all([
    prisma.projectMember.findFirst({
      where: { studentId: leader.id },
      select: { group: { select: { topic: { select: { title: true } } } } },
    }),
    prisma.groupRequestMember.findFirst({
      where: { studentId: leader.id, request: otherTeamsLiveRequest(leader.id) },
      select: {
        request: {
          select: {
            topic: { select: { title: true } },
            leader: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }),
  ]);
  if (ownProject)
    throw new BadRequestException(
      tr("student.selfHasProject", { title: ownProject.group.topic.title }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (ownOtherTeam) {
    const { firstName, lastName } = ownOtherTeam.request.leader.user;
    throw new BadRequestException(
      tr("student.selfInOtherTeam", {
        name: [firstName, lastName].filter(Boolean).join(" "),
        title: ownOtherTeam.request.topic.title,
      }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 1.b ما يزال يقبل طلباً — الفحصُ نفسه يُعاد تحت القفل عند الكتابة (7)؛
  // وهنا ليُقال السببُ الصحيح قبل أن يُبنى الفريق.
  await assertStillOpen(prisma, topic);

  // 2. Resolve teammate registration numbers → Student rows.
  const regNumbers = Array.from(
    new Set(
      data.memberRegistrationNumbers
        .map((r) => r.trim())
        .filter((r) => r.length > 0),
    ),
  );

  const teammates = await prisma.student.findMany({
    where: { registrationNumber: { in: regNumbers } },
  });

  // 2.a المرسِل ليس زميلاً لنفسه.
  //
  // كان يُسقَط بصمتٍ عند توحيد الأعضاء أدناه، فيمرّ الطلب وفي خانةٍ منه رقمُ
  // صاحبه — خطأً أو تلاعباً لملء المقعد. والمقارنة بالمعرّف بعد البحث لا
  // بالنصّ قبله: ما طابقته قاعدة البيانات هو ما يُعتدّ به.
  if (teammates.some((s) => s.id === leader.id)) {
    throw new BadRequestException(
      tr("student.selfAsMember"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // Every supplied number must match a real student.
  if (teammates.length !== regNumbers.length) {
    const found = new Set(teammates.map((s) => s.registrationNumber));
    const missing = regNumbers.filter((r) => !found.has(r));
    throw new BadRequestException(
      tr("student.unknownRegistrations", { list: missing.join(", ") }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 2.b الزميلُ الذي في مجموعةٍ أخرى لا يُضاف.
  //
  // طالبٌ واحد لمشروعٍ واحد — القاعدةُ نفسها في مسارَي الإدارة والأستاذ،
  // وكان هذا المسار وحده بلا حارس. ويُمنع كذلك من هو في طلبٍ حيٍّ لفريقٍ
  // آخر: لو قُبل الطلبان لصار له مشروعان.
  const teammateIds = teammates.map((s) => s.id);
  if (teammateIds.length) {
    const who = { student: { select: { registrationNumber: true } } };
    const [inProject, inOtherTeam] = await Promise.all([
      prisma.projectMember.findFirst({
        where: { studentId: { in: teammateIds } },
        select: who,
      }),
      prisma.groupRequestMember.findFirst({
        where: {
          studentId: { in: teammateIds },
          request: otherTeamsLiveRequest(leader.id),
        },
        select: who,
      }),
    ]);
    if (inProject)
      throw new BadRequestException(
        tr("student.memberHasProject", { reg: inProject.student.registrationNumber }),
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    if (inOtherTeam)
      throw new BadRequestException(
        tr("student.memberInOtherTeam", { reg: inOtherTeam.student.registrationNumber }),
        ErrorCodeEnum.VALIDATION_ERROR,
      );
  }

  // 3. Build the final member set (leader + teammates), unique.
  const memberStudentIds = Array.from(
    new Set([leader.id, ...teammates.map((s) => s.id)]),
  );

  // 4. Team size must not exceed the topic capacity.
  if (memberStudentIds.length > topic.maxStudents) {
    throw new BadRequestException(
      tr("student.teamTooBig", { max: topic.maxStudents }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 6. A member already in an accepted request for this topic needs no check
  //    of its own: any accepted request takes the topic out of
  //    AVAILABLE_TO_STUDENTS, so `assertStillOpen` refuses it — above, and
  //    again under the row lock below, whoever was accepted in between.

  // 7. Create the request with its members (status forced to pending).
  //
  // Several teams may ask at once, up to the cap — so two arriving together
  // for the last place would both pass the reads above. The topic's row is
  // locked for the length of the transaction: requests on the same topic
  // queue behind one another, and each re-checks the cap with the previous
  // one already counted. Requests on other topics are not held up.
  const request = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM GraduationTopic WHERE id = ${topic.id} FOR UPDATE`;
    await assertStillOpen(tx, topic);
    const created = await tx.groupRequest.create({
      data: {
        topicId: topic.id,
        leaderStudentId: leader.id,
        priority: data.priority,
        status: "pending",
        members: {
          create: memberStudentIds.map((studentId) => ({ studentId })),
        },
      },
      include: {
        topic: { select: { id: true, title: true } },
        members: { include: { student: { include: { user: badgeUser } } } },
      },
    });
    // The pending count — the cap's measure — moves with it.
    await computeTopicStatus(tx, topic.id);
    return created;
  });

  // الطلب يحجز الموضوع ويقف بانتظار قرار الإدارة. وكلّما طال انتظاره تعطّل
  // فريقٌ كامل عن موضوعٍ آخر — فالتبليغ هنا ليس ترفاً.
  await notifyAdminsQuietly({
    type: "general",
    title: { key: "notif.groupRequestNew.title" },
    message: { key: "notif.groupRequestNew.message", params: { title: request.topic.title } },
    link: "/admin/group-requests",
  });

  return request;
};

/**
 * The group requests this student is part of — the ones they sent, and the
 * ones a teammate sent with them in the team.
 *
 * Only the leader's own used to come back, so a member whose team was
 * waiting on the administration read "you have not sent any request". The
 * request belongs to the whole team; `isLeader` says which side this
 * student is on, since only the leader may cancel it.
 *
 * The topic carries its supervisor and academic year: the page names both,
 * and without them here it had nothing to show.
 */
export const getMyGroupRequestsService = async (userId: string) => {
  const student = await getStudent(userId);

  const rows = await prisma.groupRequest.findMany({
    where: {
      OR: [
        { leaderStudentId: student.id },
        { members: { some: { studentId: student.id } } },
      ],
    },
    include: {
      topic: {
        select: {
          id: true,
          title: true,
          status: true,
          maxStudents: true,
          professor: { select: { id: true, user: personLite } },
          academicYear: { select: { id: true, title: true } },
          specialization: { select: { id: true, name: true } },
        },
      },
      members: { include: { student: { include: { user: badgeUser } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    ...r,
    isLeader: r.leaderStudentId === student.id,
  }));
};

// Cancel a still-pending request the student owns.
export const cancelGroupRequestService = async (
  userId: string,
  requestId: string,
) => {
  const student = await getStudent(userId);

  const request = await prisma.groupRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new NotFoundException(
      tr("notFound.groupRequest"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  if (request.leaderStudentId !== student.id) {
    throw new UnauthorizedException(
      tr("access.notOwner.request"),
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }
  if (request.status !== "pending") {
    throw new BadRequestException(
      tr("student.requestReviewed"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
  // After the deadline a request sent in time is the administration's to decide: it stays.
  const topic = await prisma.graduationTopic.findUnique({ where: { id: request.topicId }, select: { academicYearId: true } });
  if (topic) await assertSelectionNotClosed(topic.academicYearId);

  // The team withdraws: its place on the topic's cap frees with it.
  await prisma.$transaction(async (tx) => {
    await tx.groupRequest.delete({ where: { id: requestId } });
    await computeTopicStatus(tx, request.topicId);
  });
  return { message: "تم إلغاء الطلب" };
};

//
// ═══════════════════════════════════════════════════════════════
//  MY PROJECT  (after a request is accepted)
// ═══════════════════════════════════════════════════════════════
//

/**
 * The project group this student belongs to, with milestones & defense.
 *
 * The topic brings its academic year and specialization, and the defense its
 * committee: the project page names all three, and a student preparing for
 * a defense wants to know who will sit on it.
 */
export const getMyProjectService = async (userId: string) => {
  const student = await getStudent(userId);

  const membership = await prisma.projectMember.findFirst({
    where: { studentId: student.id },
    include: {
      group: {
        include: {
          topic: {
            include: {
              professor: professorBadge,
              academicYear: { select: { id: true, title: true } },
              specialization: { select: { id: true, name: true } },
            },
          },
          members: {
            orderBy: { isLeader: "desc" },
            include: { student: { include: { user: badgeUser } } },
          },
          milestones: {
            orderBy: { order: "asc" },
            include: { submissions: true },
          },
          defense: {
            include: {
              committee: {
                select: {
                  role: true,
                  professor: { select: { id: true, user: personLite } },
                },
              },
            },
          },
        },
      },
    },
  });

  return membership?.group ?? null;
};

//
// ═══════════════════════════════════════════════════════════════
//  DASHBOARD  (the student's first screen, in one read)
// ═══════════════════════════════════════════════════════════════
//

/** A milestone as the attention lists name it — no more than that. */
const pickMilestone = (m: { id: string; title: string; deadline: Date }) => ({
  id: m.id,
  title: m.title,
  deadline: m.deadline,
});

/**
 * Where the student stands, as one word the screen can build on.
 *
 * Read from the rows, never stored: the project and its defense already say
 * it, and a second copy would only be a second thing to keep in step.
 */
export type StudentStage =
  | "choose_topic"
  | "awaiting_decision"
  | "in_progress"
  | "defense_scheduled"
  | "defended";

/**
 * The student's first screen, assembled server-side.
 *
 * It answers what a student opens the platform to learn: where am I, what
 * do I do next, and what is late. Counting things comes last.
 *
 * Requests are read from both sides — the ones this student sent and the
 * ones a teammate sent with them in it. A member whose leader submitted
 * the team's request used to be shown "no request yet" while the team was
 * waiting on the administration.
 */
export const getStudentDashboardService = async (userId: string) => {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      registrationNumber: true,
      specializationId: true,
      specialization: { select: { id: true, name: true, level: true } },
      academicYear: { select: { id: true, title: true } },
    },
  });
  if (!student) {
    throw new NotFoundException(
      tr("notFound.student"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  const now = new Date();
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const [requestRows, membership, availableTopics] = await Promise.all([
    prisma.groupRequest.findMany({
      where: {
        OR: [
          { leaderStudentId: student.id },
          { members: { some: { studentId: student.id } } },
        ],
      },
      select: {
        id: true,
        priority: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        leaderStudentId: true,
        leader: { select: { user: personLite } },
        topic: {
          select: {
            id: true,
            title: true,
            professor: { select: { user: personLite } },
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.projectMember.findFirst({
      where: { studentId: student.id },
      select: {
        group: {
          select: {
            id: true,
            topic: {
              select: {
                id: true,
                title: true,
                professor: { select: { user: personLite } },
              },
            },
            members: {
              orderBy: { isLeader: "desc" },
              select: {
                id: true,
                isLeader: true,
                student: {
                  select: {
                    id: true,
                    registrationNumber: true,
                    user: personLite,
                  },
                },
              },
            },
            milestones: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                deadline: true,
                status: true,
                order: true,
                _count: { select: { submissions: true } },
              },
            },
            defense: {
              select: {
                id: true,
                date: true,
                room: true,
                status: true,
                grade: true,
                committee: {
                  select: {
                    role: true,
                    professor: { select: { user: personLite } },
                  },
                },
              },
            },
          },
        },
      },
    }),

    // What the student can still ask for in their own specialization — the
    // number that says whether browsing is worth their time today.
    prisma.graduationTopic.count({
      where: {
        ...AVAILABLE_TO_STUDENTS,
        specializationId: student.specializationId,
      },
    }),
  ]);

  const group = membership?.group ?? null;

  const requests = requestRows.map(({ _count, leaderStudentId, ...r }) => ({
    ...r,
    isLeader: leaderStudentId === student.id,
    membersCount: _count.members,
  }));

  // ── the project, when there is one ──
  const isLate = (m: { deadline: Date; status: string }) =>
    m.status !== "completed" && (m.status === "overdue" || m.deadline < now);

  let project = null;
  let overdueMilestones: { id: string; title: string; deadline: Date }[] = [];
  let dueThisWeek: { id: string; title: string; deadline: Date }[] = [];

  if (group) {
    const milestones = group.milestones.map(({ _count, ...m }) => ({
      ...m,
      submissions: _count.submissions,
    }));
    const completed = milestones.filter((m) => m.status === "completed");
    overdueMilestones = milestones.filter(isLate);
    dueThisWeek = milestones.filter(
      (m) =>
        m.status !== "completed" &&
        !isLate(m) &&
        m.deadline <= weekAhead,
    );
    const next =
      [...milestones]
        .filter((m) => m.status !== "completed" && !isLate(m))
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0] ??
      null;

    const document = await prisma.supervisionDocument.findFirst({
      where: { topicId: group.topic.id, status: "active" },
      select: { id: true, documentNumber: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    project = {
      id: group.id,
      topic: group.topic,
      members: group.members,
      milestones,
      progress: {
        total: milestones.length,
        completed: completed.length,
        overdue: overdueMilestones.length,
        percent: milestones.length
          ? Math.round((completed.length / milestones.length) * 100)
          : 0,
      },
      nextMilestone: next,
      defense: group.defense,
      supervisionDocument: document,
    };
  }

  // ── where the student stands ──
  const liveRequest = requests.find((r) => r.status === "pending") ?? null;
  const defense = group?.defense ?? null;

  const stage: StudentStage = group
    ? defense?.status === "completed"
      ? "defended"
      : defense?.status === "scheduled"
        ? "defense_scheduled"
        : "in_progress"
    : liveRequest
      ? "awaiting_decision"
      : "choose_topic";

  // A refusal matters only while the student still has nothing: once a
  // project exists, or another request is already waiting, it is history
  // and belongs on the requests page, not at the top of the first screen.
  const rejectedRequests =
    stage === "choose_topic"
      ? requests.filter((r) => r.status === "rejected").slice(0, 3)
      : [];

  return {
    student: {
      registrationNumber: student.registrationNumber,
      specialization: student.specialization,
      academicYear: student.academicYear,
    },
    stage,
    availableTopics,
    requests,
    project,
    attention: {
      overdueMilestones: overdueMilestones.map(pickMilestone),
      dueThisWeek: dueThisWeek.map(pickMilestone),
      rejectedRequests,
    },
  };
};

//
// ─── THE DEADLINE TO CHOOSE ──────────────────────────────────
//

/**
 * The deadline to choose topics for the student's own academic year
 * (core/academic/selection-window): its days and where it stands now. No
 * deadline set: `unset`, and choosing is open.
 */
export const selectionWindowService = async (userId: string) => {
  const student = await getStudent(userId);
  const year = await prisma.academicYear.findUnique({
    where: { id: student.academicYearId },
    select: { id: true, title: true, selectionOpenAt: true, selectionCloseAt: true },
  });
  return { window: year ? { ...year, state: selectionWindowState(year) } : null };
};
