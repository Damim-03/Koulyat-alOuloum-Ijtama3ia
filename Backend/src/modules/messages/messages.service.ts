import { prisma } from "../../core/prisma/client";
import {
    NotFoundException,
    BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
    SendMessageDTO,
    BroadcastMessageDTO,
    ListMessagesDTO,
} from "./messages.validation";

/* ── shared selects ─────────────────────────────────────────── */
const userLite = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatarUrl: true,
    role: true,
} as const;

const messageInclude = {
    sender: { select: userLite },
} as const;

/* ════════════════════════════════════════════════════════════
   SEND (direct) — any authenticated user, with role-based checks
   ════════════════════════════════════════════════════════════ */
export const sendMessageService = async (
    senderId: string,
    dto: SendMessageDTO,
) => {
    const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, role: true, status: true },
    });
    if (!sender)
        throw new NotFoundException(
            "Sender not found",
            ErrorCodeEnum.RESOURCE_NOT_FOUND,
        );
    if (sender.status !== "active")
        throw new BadRequestException(
            "الحساب موقوف — لا يمكن إرسال رسائل",
            ErrorCodeEnum.VALIDATION_ERROR,
        );

    // unique, non-self recipients
    const recipientIds = [...new Set(dto.recipientIds)].filter(
        (id) => id !== senderId,
    );
    if (recipientIds.length === 0)
        throw new BadRequestException(
            "حدّد مستلماً واحداً على الأقل",
            ErrorCodeEnum.VALIDATION_ERROR,
        );

    const recipients = await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, role: true },
    });
    if (recipients.length !== recipientIds.length)
        throw new BadRequestException(
            "بعض المستلمين غير موجودين",
            ErrorCodeEnum.VALIDATION_ERROR,
        );

    // ── role-based relationship checks ──
    if (sender.role === "student") {
        await assertStudentCanMessage(senderId, recipients);
    } else if (sender.role === "professor") {
        await assertProfessorCanMessage(senderId, recipients);
    }
    // admin / owner: may message anyone.

    const message = await prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
            data: {
                senderId,
                subject: dto.subject?.trim() || null,
                body: dto.body.trim(),
            },
        });
        await tx.messageRecipient.createMany({
            data: recipientIds.map((userId) => ({ messageId: msg.id, userId })),
        });
        return msg;
    });

    return prisma.message.findUnique({
        where: { id: message.id },
        include: {
            ...messageInclude,
            recipients: { include: { user: { select: userLite } } },
        },
    });
};

/* Students may message: admins/owners, their supervising professors
   (topic professor of any project/group-request/application they belong to),
   and their own team members. */
async function assertStudentCanMessage(
    senderUserId: string,
    recipients: { id: string; role: string }[],
) {
    const nonStaff = recipients.filter(
        (r) => r.role !== "admin" && r.role !== "owner",
    );
    if (nonStaff.length === 0) return;

    const student = await prisma.student.findUnique({
        where: { userId: senderUserId },
        select: {
            id: true,
            projectMembers: {
                select: {
                    group: {
                        select: {
                            topic: { select: { professor: { select: { userId: true } } } },
                            members: {
                                select: { student: { select: { userId: true } } },
                            },
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
    if (!student)
        throw new BadRequestException(
            "ملف الطالب غير موجود",
            ErrorCodeEnum.VALIDATION_ERROR,
        );

    const allowed = new Set<string>();
    for (const pm of student.projectMembers) {
        const prof = pm.group?.topic?.professor?.userId;
        if (prof) allowed.add(prof);
        for (const m of pm.group?.members ?? []) {
            if (m.student?.userId) allowed.add(m.student.userId);
        }
    }
    for (const r of student.ledGroupRequests) {
        const prof = r.topic?.professor?.userId;
        if (prof) allowed.add(prof);
        for (const m of r.members ?? []) {
            if (m.student?.userId) allowed.add(m.student.userId);
        }
    }
    for (const gm of student.groupRequestMembers) {
        const req = gm.request;
        const prof = req?.topic?.professor?.userId;
        if (prof) allowed.add(prof);
        if (req?.leader?.userId) allowed.add(req.leader.userId);
        for (const m of req?.members ?? []) {
            if (m.student?.userId) allowed.add(m.student.userId);
        }
    }
    const blocked = nonStaff.filter((r) => !allowed.has(r.id));
    if (blocked.length > 0)
        throw new BadRequestException(
            "لا يمكنك مراسلة مستخدمين لا تربطك بهم علاقة أكاديمية (أستاذك المشرف أو أعضاء فريقك أو الإدارة).",
            ErrorCodeEnum.VALIDATION_ERROR,
        );
}

/* Professors may message: admins/owners, other professors, and students
   related to their topics (project members, group-request members/leaders). */
async function assertProfessorCanMessage(
    senderUserId: string,
    recipients: { id: string; role: string }[],
) {
    const students = recipients.filter((r) => r.role === "student");
    if (students.length === 0) return;

    const professor = await prisma.professor.findUnique({
        where: { userId: senderUserId },
        select: { id: true },
    });
    if (!professor)
        throw new BadRequestException(
            "ملف الأستاذ غير موجود",
            ErrorCodeEnum.VALIDATION_ERROR,
        );

    const studentUserIds = students.map((s) => s.id);
    const related = await prisma.student.findMany({
        where: {
            userId: { in: studentUserIds },
            OR: [
                {
                    projectMembers: {
                        some: { group: { topic: { professorId: professor.id } } },
                    },
                },
                {
                    ledGroupRequests: {
                        some: { topic: { professorId: professor.id } },
                    },
                },
                {
                    groupRequestMembers: {
                        some: { request: { topic: { professorId: professor.id } } },
                    },
                },
            ],
        },
        select: { userId: true },
    });
    const allowed = new Set(related.map((s) => s.userId));
    const blocked = students.filter((s) => !allowed.has(s.id));
    if (blocked.length > 0)
        throw new BadRequestException(
            "يمكنك مراسلة الطلبة المرتبطين بمواضيعك فقط (أعضاء مشاريعك أو أصحاب طلبات المجموعات عليها).",
            ErrorCodeEnum.VALIDATION_ERROR,
        );
}

/* ════════════════════════════════════════════════════════════
   BROADCAST — admin/owner only (enforced at the route level too)
   target: all | students | professors  (+ optional specializationId)
   ════════════════════════════════════════════════════════════ */
export const broadcastMessageService = async (
    senderId: string,
    dto: BroadcastMessageDTO,
) => {
    let userIds: string[] = [];

    if (dto.target === "students") {
        const where = dto.specializationId
            ? { specializationId: dto.specializationId }
            : {};
        const students = await prisma.student.findMany({
            where,
            select: { userId: true },
        });
        userIds = students.map((s) => s.userId);
    } else if (dto.target === "professors") {
        const professors = await prisma.professor.findMany({
            select: { userId: true },
        });
        userIds = professors.map((p) => p.userId);
    } else {
        // all: every active student & professor (not admins)
        const users = await prisma.user.findMany({
            where: { role: { in: ["student", "professor"] } },
            select: { id: true },
        });
        userIds = users.map((u) => u.id);
    }

    userIds = userIds.filter((id) => id !== senderId);
    if (userIds.length === 0)
        throw new BadRequestException(
            "لا يوجد مستلمون مطابقون",
            ErrorCodeEnum.VALIDATION_ERROR,
        );

    const broadcastTag = dto.specializationId
        ? `${dto.target}:${dto.specializationId}`
        : dto.target;

    const message = await prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
            data: {
                senderId,
                subject: dto.subject?.trim() || null,
                body: dto.body.trim(),
                broadcast: broadcastTag,
            },
        });
        await tx.messageRecipient.createMany({
            data: userIds.map((userId) => ({ messageId: msg.id, userId })),
        });
        return msg;
    });

    return { id: message.id, recipients: userIds.length };
};

/* ════════════════════════════════════════════════════════════
   INBOX / SENT (paginated)
   ════════════════════════════════════════════════════════════ */
export const listInboxService = async (
    userId: string,
    q: ListMessagesDTO,
) => {
    const where = {
        userId,
        ...(q.unread ? { readAt: null } : {}),
        ...(q.search
            ? {
                message: {
                    OR: [
                        { subject: { contains: q.search } },
                        { body: { contains: q.search } },
                    ],
                },
            }
            : {}),
    };

    const [items, total] = await Promise.all([
        prisma.messageRecipient.findMany({
            where,
            include: { message: { include: messageInclude } },
            orderBy: { message: { createdAt: "desc" } },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma.messageRecipient.count({ where }),
    ]);

    return { items, total, page: q.page, limit: q.limit };
};

export const listSentService = async (userId: string, q: ListMessagesDTO) => {
    const where = {
        senderId: userId,
        ...(q.search
            ? {
                OR: [
                    { subject: { contains: q.search } },
                    { body: { contains: q.search } },
                ],
            }
            : {}),
    };

    const [items, total] = await Promise.all([
        prisma.message.findMany({
            where,
            include: {
                recipients: {
                    include: { user: { select: userLite } },
                    take: 5, // preview only; counts come from _count
                },
                _count: { select: { recipients: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma.message.count({ where }),
    ]);

    return { items, total, page: q.page, limit: q.limit };
};

/* ════════════════════════════════════════════════════════════
   READ / UNREAD COUNT / DELETE (for recipient)
   ════════════════════════════════════════════════════════════ */
export const unreadCountService = async (userId: string) => {
    const count = await prisma.messageRecipient.count({
        where: { userId, readAt: null },
    });
    return { count };
};

export const markMessageReadService = async (
    userId: string,
    messageId: string,
) => {
    const rec = await prisma.messageRecipient.findUnique({
        where: { messageId_userId: { messageId, userId } },
    });
    if (!rec)
        throw new NotFoundException(
            "Message not found",
            ErrorCodeEnum.RESOURCE_NOT_FOUND,
        );
    if (rec.readAt) return { ok: true };
    await prisma.messageRecipient.update({
        where: { id: rec.id },
        data: { readAt: new Date() },
    });
    return { ok: true };
};

export const markAllReadService = async (userId: string) => {
    const res = await prisma.messageRecipient.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
    });
    return { updated: res.count };
};

/** Removes the message from the recipient's inbox only (sender copy stays). */
export const deleteInboxMessageService = async (
    userId: string,
    messageId: string,
) => {
    const rec = await prisma.messageRecipient.findUnique({
        where: { messageId_userId: { messageId, userId } },
    });
    if (!rec)
        throw new NotFoundException(
            "Message not found",
            ErrorCodeEnum.RESOURCE_NOT_FOUND,
        );
    await prisma.messageRecipient.delete({ where: { id: rec.id } });
    return { ok: true };
};

/* ── single message (recipient or sender) ───────────────────── */
export const getMessageService = async (userId: string, messageId: string) => {
    const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
            ...messageInclude,
            recipients: { include: { user: { select: userLite } } },
        },
    });
    if (!message)
        throw new NotFoundException(
            "Message not found",
            ErrorCodeEnum.RESOURCE_NOT_FOUND,
        );

    const isSender = message.senderId === userId;
    const isRecipient = message.recipients.some((r) => r.userId === userId);
    if (!isSender && !isRecipient)
        throw new NotFoundException(
            "Message not found",
            ErrorCodeEnum.RESOURCE_NOT_FOUND,
        );

    return message;
};