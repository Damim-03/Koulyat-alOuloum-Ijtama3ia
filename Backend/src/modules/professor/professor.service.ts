import { prisma } from "../../core/prisma/client";
import { setTopicDecision } from "../../core/topic/topic-status";
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  CreateTopicDTO,
  CreateTopicWithGroupDTO,
  SearchStudentsDTO,
  UpdateTopicDTO,
  CreateMilestoneDTO,
  UpdateMilestoneDTO,
} from "./professor.validation";
import { publicUser, userBadgeSelect } from "../../core/prisma/selects";
import {
  createNotification,
  notifyAdminsQuietly,
} from "../notification/notification.service";

//
// ─── GET PROFESSOR BY USERID ─────────────────────────────────
//

const getProfessor = async (userId: string) => {
  const professor = await prisma.professor.findUnique({
    where: { userId },
  });

  if (!professor) {
    throw new NotFoundException(
      "Professor not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  return professor;
};

//
// ─── CREATE TOPIC ─────────────────────────────────────────────
//

export const createTopicService = async (
  userId: string,
  data: CreateTopicDTO,
) => {
  const professor = await getProfessor(userId);

  const topic = await prisma.graduationTopic.create({
    data: {
      title: data.title,
      description: data.description,
      maxStudents: data.maxStudents,
      specializationId: data.specializationId,
      academicYearId: data.academicYearId,
      requirements: data.requirements ?? [],
      objectives: data.objectives ?? [],
      references: data.references ?? [],
      professorId: professor.id,
      status: "pending",
    },
    include: {
      specialization: true,
      academicYear: true,
    },
  });

  // الموضوع يولد «قيد الانتظار»، أي أنه ينتظر قرار الإدارة. ولا يعلم به أحدٌ
  // منها حتى الآن إلا إن فتح اللوحة وتصفّح — فالجرس هو ما يُقصّر ذلك.
  await notifyAdminsQuietly({
    type: "general",
    title: "موضوعٌ جديد بانتظار القرار",
    message: `اقترح أستاذٌ موضوع: «${topic.title}».`,
    link: "/admin/topics",
  });

  return topic;
};

//
// ─── CREATE TOPIC + PROPOSED GROUP ───────────────────────────
//

/**
 * Proposes a topic and the team for it in one step.
 *
 * Deliberately NOT an assignment. The topic is created `pending` and the
 * team is recorded as a `pending` GroupRequest, so the administration still
 * decides — on the group-requests screen it already has. Accepting there
 * creates the project group and moves the topic to `full`, which is the
 * existing path, unchanged.
 */
export const createTopicWithGroupService = async (
  userId: string,
  data: CreateTopicWithGroupDTO,
) => {
  const professor = await getProfessor(userId);

  const [specialization, academicYear] = await Promise.all([
    prisma.specialization.findUnique({ where: { id: data.specializationId } }),
    prisma.academicYear.findUnique({ where: { id: data.academicYearId } }),
  ]);
  if (!specialization)
    throw new NotFoundException(
      "Specialization not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (!academicYear)
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // ── resolve the registration numbers ──
  const numbers = Array.from(
    new Set(
      data.memberRegistrationNumbers
        .map((r) => r.trim())
        .filter((r) => r.length > 0),
    ),
  );
  const students = await prisma.student.findMany({
    where: { registrationNumber: { in: numbers } },
    select: { id: true, userId: true, registrationNumber: true },
  });
  if (students.length !== numbers.length) {
    const found = new Set(students.map((s) => s.registrationNumber));
    const missing = numbers.filter((r) => !found.has(r));
    throw new BadRequestException(
      `أرقام تسجيل غير موجودة: ${missing.join(", ")}`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const leader = students.find(
    (s) => s.registrationNumber === data.leaderRegistrationNumber.trim(),
  );
  if (!leader)
    throw new BadRequestException(
      "المرسِل يجب أن يكون ضمن الطلبة المُختارين",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  if (students.length > data.maxStudents)
    throw new BadRequestException(
      `عدد الطلبة يتجاوز الحدّ الأقصى للموضوع (${data.maxStudents})`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // A student already on a project cannot be proposed for another.
  const placed = await prisma.projectMember.findFirst({
    where: { studentId: { in: students.map((s) => s.id) } },
    select: { student: { select: { registrationNumber: true } } },
  });
  if (placed)
    throw new BadRequestException(
      `الطالب ${placed.student.registrationNumber} لديه مشروع بالفعل`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // ── the topic and the proposal, together or not at all ──
  const topic = await prisma.$transaction(async (tx) => {
    const created = await tx.graduationTopic.create({
      data: {
        title: data.title,
        description: data.description,
        requirements: data.requirements ?? [],
        objectives: data.objectives ?? [],
        references: data.references ?? [],
        maxStudents: data.maxStudents,
        status: "pending", // the administration still approves it
        professorId: professor.id,
        specializationId: data.specializationId,
        academicYearId: data.academicYearId,
      },
    });

    await tx.groupRequest.create({
      data: {
        topicId: created.id,
        // The proposal reserves the topic exactly as a student request does.
        activeTopicId: created.id,
        leaderStudentId: leader.id,
        priority: 1,
        status: "pending",
        members: {
          create: students.map((s) => ({ studentId: s.id })),
        },
      },
    });

    return created;
  });

  await notifyAdminsQuietly({
    type: "general",
    title: "موضوعٌ جديد بفريقه بانتظار القرار",
    message: `اقترح أستاذٌ موضوع: «${topic.title}» مع فريقٍ من ${students.length} طالب/طلبة.`,
    link: "/admin/topics",
  });

  // Tell the students they have been put forward — they did not ask for it.
  for (const s of students) {
    await createNotification({
      userId: s.userId,
      type: "general",
      title: "اقترح أستاذك موضوعاً لكم",
      message: `اقترح الأستاذ موضوع: «${topic.title}» لفريقكم. بانتظار موافقة الإدارة.`,
      link: "/student/requests",
    });
  }

  return topic;
};

//
// ─── SEARCH STUDENTS (for proposing a team) ──────────────────
//

/**
 * Students a professor may put forward, matched by registration number or by
 * name.
 *
 * Three things keep this from being a way to read the student roster: the
 * term is required (see searchStudentsSchema), only students with no project
 * are returned — the only ones that could be proposed anyway — and the answer
 * is capped at ten rows carrying nothing beyond what the picker displays.
 */
export const searchStudentsService = async (
  userId: string,
  q: SearchStudentsDTO,
) => {
  await getProfessor(userId); // role is guarded upstream; this proves the profile

  const term = q.q.trim();
  const words = term.split(/\s+/).filter(Boolean);

  const students = await prisma.student.findMany({
    where: {
      // Already on a project → not proposable, so not shown.
      projectMembers: { none: {} },
      ...(q.specializationId ? { specializationId: q.specializationId } : {}),
      OR: [
        { registrationNumber: { contains: term } },
        // Each word must appear in one of the two name fields, so "خالد مرابط"
        // and "مرابط خالد" find the same person.
        {
          AND: words.map((w) => ({
            OR: [
              { user: { firstName: { contains: w } } },
              { user: { lastName: { contains: w } } },
            ],
          })),
        },
      ],
    },
    select: {
      id: true,
      registrationNumber: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
          gender: true,
        },
      },
      specialization: { select: { id: true, name: true } },
    },
    orderBy: { registrationNumber: "asc" },
    take: 10,
  });

  return students;
};

//
// ─── GET MY TOPICS ────────────────────────────────────────────
//

export const getMyTopicsService = async (userId: string) => {
  const professor = await getProfessor(userId);

  const topics = await prisma.graduationTopic.findMany({
    where: { professorId: professor.id },
    include: {
      specialization: true,
      academicYear: true,
      _count: {
        select: { groupRequests: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return topics;
};

//
// ─── GET TOPIC BY ID ──────────────────────────────────────────
//

/**
 * A topic with the students attached to it.
 *
 * The page used to report "3 students" and be unable to name one of them.
 * Two different sets of students matter here and they are not the same thing:
 *
 *   * `groupRequests` — teams that asked for this topic. The decision is the
 *     administration's, so these are shown to the professor for information:
 *     who wants his topic, and where each request stands.
 *   * `projectGroup` — the one team that was accepted. These are the students
 *     he actually supervises.
 *
 * The two carry different shapes on purpose. A team he supervises gets
 * `publicUser`, the same shape `getGroupService` already gives him — he needs
 * to reach them. A team that merely applied gets `userBadgeSelect`: a name, a
 * photo, a registration number. Nothing about an applicant's contact details
 * belongs in an answer about a topic.
 */
export const getTopicByIdService = async (userId: string, topicId: string) => {
  const professor = await getProfessor(userId);

  const applicant = {
    include: {
      student: {
        select: {
          id: true,
          registrationNumber: true,
          user: { select: userBadgeSelect },
          specialization: { select: { id: true, name: true } },
        },
      },
    },
  } as const;

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
    include: {
      specialization: true,
      academicYear: true,

      groupRequests: {
        // Live requests first, then the rest; newest first within each.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          leader: applicant.include.student,
          members: applicant,
        },
      },

      projectGroup: {
        include: {
          members: {
            orderBy: { isLeader: "desc" },
            include: { student: { include: { user: publicUser } } },
          },
          _count: { select: { milestones: true } },
        },
      },

      _count: { select: { groupRequests: true } },
    },
  });

  if (!topic) {
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      "You do not own this topic",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  return topic;
};

//
// ─── UPDATE TOPIC ─────────────────────────────────────────────
//

export const updateTopicService = async (
  userId: string,
  topicId: string,
  data: UpdateTopicDTO,
) => {
  const professor = await getProfessor(userId);

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
  });

  if (!topic) {
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      "You do not own this topic",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  // Can only edit if pending or rejected
  if (topic.status !== "pending" && topic.status !== "rejected") {
    throw new UnauthorizedException(
      "Cannot edit a topic that is already approved or open",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  // A foreign key that does not exist would surface as a database error with
  // nothing to tell the professor which field was wrong.
  if (data.specializationId) {
    const found = await prisma.specialization.findUnique({
      where: { id: data.specializationId },
      select: { id: true },
    });
    if (!found)
      throw new NotFoundException(
        "Specialization not found",
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
  }
  if (data.academicYearId) {
    const found = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
      select: { id: true },
    });
    if (!found)
      throw new NotFoundException(
        "Academic year not found",
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
  }

  // Editing a rejected topic *is* resubmitting it: it goes back into the
  // queue and loses the old reason. Without this it stayed `rejected` after
  // being corrected — filed under "rejected" on both sides, with nothing to
  // tell the administration it had been answered.
  const resubmitting = topic.status === "rejected";

  const updated = await prisma.$transaction(async (tx) => {
    await tx.graduationTopic.update({ where: { id: topicId }, data });
    // Resubmitting is a change of decision, so it goes through the one place
    // that writes decisions — which also clears the stale rejection reason.
    if (resubmitting) await setTopicDecision(tx, topicId, "pending");
    return tx.graduationTopic.findUniqueOrThrow({ where: { id: topicId } });
  });

  return updated;
};

//
// ─── DELETE TOPIC ─────────────────────────────────────────────
//

export const deleteTopicService = async (userId: string, topicId: string) => {
  const professor = await getProfessor(userId);

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
  });

  if (!topic) {
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      "You do not own this topic",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  // Can only delete if pending or rejected
  if (topic.status !== "pending" && topic.status !== "rejected") {
    throw new UnauthorizedException(
      "Cannot delete a topic that is already approved or open",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  await prisma.graduationTopic.delete({
    where: { id: topicId },
  });

  return { message: "Topic deleted successfully" };
};

//
// ═══════════════════════════════════════════════════════════════
//  APPLICATIONS
// ═══════════════════════════════════════════════════════════════
//

// ─── LIST APPLICATIONS (for this professor's topics) ──────────


// ─── helper: load an application owned by this professor ──────


// ─── ACCEPT APPLICATION ───────────────────────────────────────


// ─── REJECT APPLICATION ───────────────────────────────────────


//
// ═══════════════════════════════════════════════════════════════
//  MILESTONES
// ═══════════════════════════════════════════════════════════════
//

// ─── helper: load a project group owned by this professor ─────

const getOwnedGroup = async (professorId: string, groupId: string) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: { topic: true },
  });

  if (!group) {
    throw new NotFoundException(
      "Project group not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (group.topic.professorId !== professorId) {
    throw new UnauthorizedException(
      "You do not own this project group",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  return group;
};

// ─── CREATE MILESTONE ─────────────────────────────────────────

export const createMilestoneService = async (
  userId: string,
  groupId: string,
  data: CreateMilestoneDTO,
) => {
  const professor = await getProfessor(userId);
  await getOwnedGroup(professor.id, groupId);

  return prisma.milestone.create({
    data: {
      title: data.title,
      description: data.description,
      deadline: data.deadline,
      order: data.order,
      groupId,
      status: "pending",
    },
  });
};

// ─── LIST MILESTONES ──────────────────────────────────────────

export const getMilestonesService = async (userId: string, groupId: string) => {
  const professor = await getProfessor(userId);
  await getOwnedGroup(professor.id, groupId);

  return prisma.milestone.findMany({
    where: { groupId },
    orderBy: { order: "asc" },
    include: { submissions: true },
  });
};

// ─── helper: load a milestone owned by this professor ─────────

const getOwnedMilestone = async (professorId: string, milestoneId: string) => {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { group: { include: { topic: true } } },
  });

  if (!milestone) {
    throw new NotFoundException(
      "Milestone not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (milestone.group.topic.professorId !== professorId) {
    throw new UnauthorizedException(
      "You do not own this milestone",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  return milestone;
};

// ─── UPDATE MILESTONE (fields + status) ───────────────────────

export const updateMilestoneService = async (
  userId: string,
  milestoneId: string,
  data: UpdateMilestoneDTO,
) => {
  const professor = await getProfessor(userId);
  await getOwnedMilestone(professor.id, milestoneId);

  return prisma.milestone.update({ where: { id: milestoneId }, data });
};

// ─── DELETE MILESTONE ─────────────────────────────────────────

export const deleteMilestoneService = async (
  userId: string,
  milestoneId: string,
) => {
  const professor = await getProfessor(userId);
  await getOwnedMilestone(professor.id, milestoneId);

  await prisma.milestone.delete({ where: { id: milestoneId } });

  return { message: "Milestone deleted successfully" };
};

//
// ═══════════════════════════════════════════════════════════════
//  PROJECT GROUPS (supervised projects)
// ═══════════════════════════════════════════════════════════════
//

// ─── LIST MY GROUPS ───────────────────────────────────────────

export const getMyGroupsService = async (userId: string) => {
  const professor = await getProfessor(userId);

  return prisma.projectGroup.findMany({
    where: { topic: { professorId: professor.id } },
    include: {
      topic: {
        select: { id: true, title: true, status: true, maxStudents: true },
      },
      members: {
        include: { student: { include: { user: publicUser } } },
      },
      _count: { select: { milestones: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ─── GET GROUP BY ID (full detail) ────────────────────────────

export const getGroupByIdService = async (userId: string, groupId: string) => {
  const professor = await getProfessor(userId);
  await getOwnedGroup(professor.id, groupId); // ownership check

  return prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: {
      topic: {
        select: { id: true, title: true, status: true, maxStudents: true },
      },
      members: {
        include: { student: { include: { user: publicUser } } },
      },
      milestones: {
        orderBy: { order: "asc" },
        include: {
          submissions: {
            include: {
              uploadedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
      defense: true,
    },
  });
};

//
// ─── DASHBOARD ───────────────────────────────────────────────
//

/**
 * The professor's first screen, assembled server-side.
 *
 * Everything here is scoped to `professorId` at the query level, so the
 * endpoint cannot return another professor's projects even by mistake.
 *
 * "Awaiting review" is derived rather than stored: a submission counts as
 * pending while its milestone is not yet marked completed, which is exactly
 * the step a professor takes after reading it. There is no review flag on
 * Submission, and inventing one here would have meant guessing.
 */
export const getDashboardService = async (userId: string) => {
  const professor = await getProfessor(userId);
  const now = new Date();
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const mine = { topic: { professorId: professor.id } };

  const [topics, groups, milestones, defenses, submissions] = await Promise.all([
    prisma.graduationTopic.findMany({
      where: { professorId: professor.id },
      select: {
        id: true,
        title: true,
        status: true,
        rejectionReason: true,
        maxStudents: true,
        createdAt: true,
        updatedAt: true,
        specialization: { select: { id: true, name: true } },
        _count: { select: { groupRequests: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.projectGroup.findMany({
      where: mine,
      include: {
        topic: { select: { id: true, title: true, status: true, maxStudents: true } },
        members: {
          orderBy: { isLeader: "desc" },
          include: {
            student: {
              select: {
                id: true,
                registrationNumber: true,
                user: publicUser,
              },
            },
          },
        },
        defense: { select: { id: true, date: true, room: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.milestone.findMany({
      where: { group: mine },
      select: {
        id: true,
        title: true,
        deadline: true,
        status: true,
        order: true,
        groupId: true,
        group: { select: { topic: { select: { id: true, title: true } } } },
      },
      orderBy: { deadline: "asc" },
    }),

    prisma.defense.findMany({
      where: { group: mine },
      select: {
        id: true,
        date: true,
        room: true,
        status: true,
        groupId: true,
        group: { select: { topic: { select: { id: true, title: true } } } },
      },
      orderBy: { date: "asc" },
    }),

    prisma.submission.findMany({
      where: { milestone: { group: mine } },
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        version: true,
        milestone: {
          select: {
            id: true,
            title: true,
            status: true,
            groupId: true,
            group: { select: { topic: { select: { id: true, title: true } } } },
          },
        },
        uploadedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, gender: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // ── counters ──
  const breakdown: Record<string, number> = {
    pending: 0, approved: 0, open: 0, full: 0, rejected: 0, archived: 0,
  };
  for (const t of topics) breakdown[t.status] = (breakdown[t.status] ?? 0) + 1;

  const supervisedStudents = groups.reduce((n, g) => n + g.members.length, 0);

  const isLate = (m: { deadline: Date; status: string }) =>
    m.status !== "completed" && m.deadline < now;

  const overdueMilestones = milestones.filter(isLate);
  const dueThisWeek = milestones.filter(
    (m) => m.status !== "completed" && m.deadline >= now && m.deadline <= weekAhead,
  );
  const upcomingDefenses = defenses.filter(
    (d) => d.status === "scheduled" && d.date >= now,
  );

  // ── needs your attention ──
  const attention = {
    rejectedTopics: topics.filter((t) => t.status === "rejected"),
    pendingTopics: topics.filter((t) => t.status === "pending"),
    // Accepted but never published: it is invisible to students until the
    // administration publishes it, and nothing else on the screen said so.
    // The professor cannot publish it himself — he can ask.
    approvedNotPublished: topics.filter((t) => t.status === "approved"),
    // Published, and still nobody has asked for it.
    openWithoutRequests: topics.filter(
      (t) => t.status === "open" && t._count.groupRequests === 0,
    ),
    overdueMilestones,
    dueThisWeek,
    awaitingReview: submissions.filter(
      (s) => s.milestone.status !== "completed",
    ),
  };

  // ── one chronological agenda out of two kinds of date ──
  const agenda = [
    ...milestones
      .filter((m) => m.status !== "completed" && m.deadline >= now)
      .map((m) => ({
        kind: "milestone" as const,
        id: m.id,
        title: m.title,
        date: m.deadline,
        groupId: m.groupId,
        topicTitle: m.group.topic.title,
        room: null as string | null,
      })),
    ...upcomingDefenses.map((d) => ({
      kind: "defense" as const,
      id: d.id,
      title: d.group.topic.title,
      date: d.date,
      groupId: d.groupId,
      topicTitle: d.group.topic.title,
      room: d.room,
    })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  // ── the project cards ──
  const projects = groups.map((g) => {
    const own = milestones.filter((m) => m.groupId === g.id);
    const completed = own.filter((m) => m.status === "completed").length;
    const next = own.find((m) => m.status !== "completed" && m.deadline >= now);
    return {
      id: g.id,
      topic: g.topic,
      members: g.members,
      defense: g.defense,
      milestones: {
        total: own.length,
        completed,
        overdue: own.filter(isLate).length,
      },
      nextDeadline: next ? { id: next.id, title: next.title, deadline: next.deadline } : null,
    };
  });

  return {
    // The whole list, not a slice: a professor carries tens of topics at
    // most, and the screen needs to show which topic is where — a count per
    // status cannot answer that.
    topics,
    stats: {
      myTopics: topics.length,
      supervisedProjects: groups.length,
      supervisedStudents,
      overdueMilestones: overdueMilestones.length,
      upcomingDefenses: upcomingDefenses.length,
    },
    topicBreakdown: breakdown,
    attention,
    agenda,
    projects,
  };
};
