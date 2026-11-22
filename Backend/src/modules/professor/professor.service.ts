import { prisma } from "../../core/prisma/client";
import { resolveTopicExtras, topicExtrasSelect } from "../../core/topic/topic-extras";
import { computeTopicStatus, setTopicDecision } from "../../core/topic/topic-status";
import type { TopicStatus } from "../../generated/prisma";
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { assertYearOpen } from "../../core/academic/year-open";
import { assertProposalsOpen } from "../../core/academic/proposal-window";
import { assertTeamSize } from "../../core/academic/team-size";
import { assertTopicQuota, lockProfessor, topicQuotaOf } from "../../core/academic/topic-quota";
import { nameSearchFilter } from "../../core/search/name-search";
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
import { tr } from "../../core/i18n";

//
// ─── GET PROFESSOR BY USERID ─────────────────────────────────
//

const getProfessor = async (userId: string) => {
  const professor = await prisma.professor.findUnique({
    where: { userId },
  });

  if (!professor) {
    throw new NotFoundException(
      tr("notFound.professor"),
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
  await assertYearOpen(data.academicYearId);
  await assertProposalsOpen(data.academicYearId);
  await assertTeamSize(data.academicYearId, data.specializationId, data.maxStudents);
  const extras = await resolveTopicExtras(data, { professorId: professor.id, specializationId: data.specializationId });

  // Counted and created under his lock: two sends at once do not both slip under the limit.
  const topic = await prisma.$transaction(async (tx) => {
    await lockProfessor(tx, professor.id);
    await assertTopicQuota(data.academicYearId, professor.id, tx);
    return tx.graduationTopic.create({
      data: {
        ...extras,
        title: data.title,
        description: data.description,
        maxStudents: data.maxStudents,
        maxRequests: data.maxRequests ?? null,
        specializationId: data.specializationId,
        academicYearId: data.academicYearId,
        requirements: data.requirements,
        objectives: data.objectives,
        references: data.references,
        professorId: professor.id,
        status: "pending",
      },
      include: {
        specialization: true,
        academicYear: true,
      },
    });
  });

  // الموضوع يولد «قيد الانتظار»، أي أنه ينتظر قرار الإدارة. ولا يعلم به أحدٌ
  // منها حتى الآن إلا إن فتح اللوحة وتصفّح — فالجرس هو ما يُقصّر ذلك.
  await notifyAdminsQuietly({
    type: "general",
    title: { key: "notif.topicProposed.title" },
    message: { key: "notif.topicProposed.message", params: { title: topic.title } },
    link: "/admin/topics",
  });

  return topic;
};

//
// ─── HOW MANY TOPICS HE MAY STILL SEND ───────────────────────
//

/**
 * The professor's limit for a year — the one asked, else the current — and
 * how much of it he has used: «2 of 3». `max` null: no limit.
 */
export const topicQuotaService = async (userId: string, academicYearId?: string) => {
  const professor = await getProfessor(userId);
  const yearId =
    academicYearId ??
    (await prisma.academicYear.findFirst({ where: { isActive: true, archivedAt: null }, select: { id: true } }))?.id;
  const quota = yearId ? await topicQuotaOf(yearId, professor.id) : null;
  return quota ?? { year: null, max: null, used: 0 };
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
      tr("notFound.specialization"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (!academicYear)
    throw new NotFoundException(
      tr("notFound.academicYear"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  await assertYearOpen(academicYear.id);
  await assertProposalsOpen(academicYear.id);
  await assertTeamSize(academicYear.id, data.specializationId, data.maxStudents);
  // Said before the team is checked; checked again, locked, as the topic is created.
  await assertTopicQuota(academicYear.id, professor.id);

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
      tr("student.unknownRegistrations", { list: missing.join(", ") }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const leader = students.find(
    (s) => s.registrationNumber === data.leaderRegistrationNumber.trim(),
  );
  if (!leader)
    throw new BadRequestException(
      tr("professor.leaderNotInTeam"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  if (students.length > data.maxStudents)
    throw new BadRequestException(
      tr("professor.teamTooBig", { max: data.maxStudents }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // A student already on a project cannot be proposed for another.
  const placed = await prisma.projectMember.findFirst({
    where: { studentId: { in: students.map((s) => s.id) } },
    select: { student: { select: { registrationNumber: true } } },
  });
  if (placed)
    throw new BadRequestException(
      tr("professor.studentHasProject", { reg: placed.student.registrationNumber }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // ولا من هو في طلبٍ حيٍّ لفريقٍ آخر — القاعدةُ نفسها التي يُفحص بها زملاء
  // الطالب حين يُرسل طلبه. لو قُبل الطلبان لصار له مشروعان.
  const requested = await prisma.groupRequestMember.findFirst({
    where: {
      studentId: { in: students.map((s) => s.id) },
      request: { status: { in: ["pending", "accepted"] } },
    },
    select: {
      student: { select: { registrationNumber: true } },
      request: { select: { topic: { select: { title: true } } } },
    },
  });
  if (requested)
    throw new BadRequestException(
      tr("professor.studentInRequest", {
        reg: requested.student.registrationNumber,
        title: requested.request.topic.title,
      }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // ── the topic and the proposal, together or not at all ──
  const extras = await resolveTopicExtras(data, { professorId: professor.id, specializationId: data.specializationId });
  const topic = await prisma.$transaction(async (tx) => {
    await lockProfessor(tx, professor.id);
    await assertTopicQuota(data.academicYearId, professor.id, tx);
    const created = await tx.graduationTopic.create({
      data: {
        ...extras,
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        objectives: data.objectives,
        references: data.references,
        maxStudents: data.maxStudents,
        maxRequests: data.maxRequests ?? null,
        status: "pending", // the administration still approves it
        professorId: professor.id,
        specializationId: data.specializationId,
        academicYearId: data.academicYearId,
      },
    });

    // The proposal's own request. The topic is not published, and an
    // unpublished topic takes one request only — so it stays theirs.
    await tx.groupRequest.create({
      data: {
        topicId: created.id,
        leaderStudentId: leader.id,
        priority: 1,
        status: "pending",
        members: {
          create: students.map((s) => ({ studentId: s.id })),
        },
      },
    });
    await computeTopicStatus(tx, created.id);

    return created;
  });

  await notifyAdminsQuietly({
    type: "general",
    title: { key: "notif.topicProposedWithTeam.title" },
    message: { key: "notif.topicProposedWithTeam.message", params: { title: topic.title, count: students.length } },
    link: "/admin/topics",
  });

  // Tell the students they have been put forward — they did not ask for it.
  for (const s of students) {
    await createNotification({
      userId: s.userId,
      type: "general",
      title: { key: "notif.teamProposedForYou.title" },
      message: { key: "notif.teamProposedForYou.message", params: { title: topic.title } },
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
 * and no live request are returned — the only ones that could be proposed
 * anyway — and the answer is capped at ten rows carrying nothing beyond what
 * the picker displays.
 */
/**
 * The students a professor may name for a proposed team: free ones — on no
 * project, in no live request.
 *
 * Typed: a registration number, or letters of the names — each word in the
 * first or last name, Arabic or Latin, in any order: «خا مر» finds «خالد
 * مرابط», and one letter is enough. Not typed: the specialization's students,
 * to choose from a list — never the whole university.
 */
export const searchStudentsService = async (
  userId: string,
  q: SearchStudentsDTO,
) => {
  await getProfessor(userId); // role is guarded upstream; this proves the profile

  const term = q.q.trim();
  if (!term && !q.specializationId) return { students: [], total: 0 };
  const byName = term ? nameSearchFilter(term, (f) => ({ user: f })) : null;

  const where = {
    // Already on a project, or in a live request → not proposable, so not shown.
    projectMembers: { none: {} },
    groupRequestMembers: {
      none: { request: { status: { in: ["pending", "accepted"] as ("pending" | "accepted")[] } } },
    },
    ...(q.specializationId ? { specializationId: q.specializationId } : {}),
    ...(term ? { OR: [{ registrationNumber: { contains: term } }, ...(byName ? [byName] : [])] } : {}),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: {
        id: true,
        registrationNumber: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            firstNameLatin: true,
            lastNameLatin: true,
            avatarUrl: true,
            gender: true,
          },
        },
        specialization: { select: { id: true, name: true } },
      },
      // By name: a list read by eye.
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }, { registrationNumber: "asc" }],
      take: q.limit,
    }),
    prisma.student.count({ where }),
  ]);

  return { students, total };
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
      // The co-supervisor and the type (core/topic/topic-extras); the summary is a column.
      coSupervisor: topicExtrasSelect.coSupervisor,
      type: topicExtrasSelect.type,
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
      // The co-supervisor and the type (core/topic/topic-extras); the summary is a column.
      coSupervisor: topicExtrasSelect.coSupervisor,
      type: topicExtrasSelect.type,

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
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      tr("access.notOwner.topic"),
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
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      tr("access.notOwner.topic"),
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  // Can only edit if pending or rejected
  if (topic.status !== "pending" && topic.status !== "rejected") {
    throw new UnauthorizedException(
      tr("professor.cantEditDecided"),
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
        tr("notFound.specialization"),
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
        tr("notFound.academicYear"),
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
    await assertYearOpen(data.academicYearId);
  }

  // The rule of its year and level, when its number changes or it moves; kept as it is, in place, it stands.
  if (data.maxStudents !== undefined || data.academicYearId || data.specializationId) {
    const inPlace =
      (!data.academicYearId || data.academicYearId === topic.academicYearId) &&
      (!data.specializationId || data.specializationId === topic.specializationId);
    await assertTeamSize(
      data.academicYearId ?? topic.academicYearId,
      data.specializationId ?? topic.specializationId,
      data.maxStudents ?? topic.maxStudents,
      inPlace ? topic.maxStudents : undefined,
    );
  }

  // Editing a rejected topic *is* resubmitting it: it goes back into the
  // queue and loses the old reason. Without this it stayed `rejected` after
  // being corrected — filed under "rejected" on both sides, with nothing to
  // tell the administration it had been answered.
  const resubmitting = topic.status === "rejected";

  // The co-supervisor, short description and type, checked against the topic as it will be.
  const { coSupervisorId, summary, typeId, ...fields } = data;
  const extras = await resolveTopicExtras(
    { coSupervisorId, summary, typeId },
    { professorId: topic.professorId, specializationId: data.specializationId ?? topic.specializationId },
    topic,
  );

  // Resubmitting a rejected topic, or moving it to another year, adds it to a
  // count it was not in: the limit of the year it will be in.
  const yearAfter = data.academicYearId ?? topic.academicYearId;
  const counts = resubmitting || yearAfter !== topic.academicYearId;

  const updated = await prisma.$transaction(async (tx) => {
    if (counts) {
      await lockProfessor(tx, topic.professorId);
      await assertTopicQuota(yearAfter, topic.professorId, tx);
    }
    await tx.graduationTopic.update({ where: { id: topicId }, data: { ...fields, ...extras } });
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
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      tr("access.notOwner.topic"),
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  // Can only delete if pending or rejected
  if (topic.status !== "pending" && topic.status !== "rejected") {
    throw new UnauthorizedException(
      tr("professor.cantDeleteDecided"),
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
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (group.topic.professorId !== professorId) {
    throw new UnauthorizedException(
      tr("access.notOwner.group"),
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
      tr("notFound.milestone"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (milestone.group.topic.professorId !== professorId) {
    throw new UnauthorizedException(
      tr("access.notOwner.milestone"),
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

/**
 * The professor's projects, with what the list page needs to say how each
 * one is doing: its milestones (state and deadline, not their files), its
 * defense, and the topic's specialization and year.
 *
 * The page used to read `defense` from this response, which never carried
 * it — every project showed "no defense", scheduled or not.
 */
export const getMyGroupsService = async (userId: string) => {
  const professor = await getProfessor(userId);

  return prisma.projectGroup.findMany({
    where: { topic: { professorId: professor.id } },
    include: {
      topic: {
        select: {
          id: true,
          title: true,
          status: true,
          maxStudents: true,
          specialization: { select: { id: true, name: true } },
          academicYear: { select: { id: true, title: true } },
        },
      },
      members: {
        orderBy: { isLeader: "desc" },
        include: { student: { include: { user: publicUser } } },
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
        select: { id: true, date: true, room: true, status: true, grade: true },
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
                select: { id: true, firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true },
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

  const lite = {
    select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, avatarUrl: true, gender: true },
  } as const;

  const [
    topics,
    groups,
    milestones,
    defenses,
    submissions,
    profile,
    committeeSeats,
  ] = await Promise.all([
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
        uploadedBy: { select: { id: true, firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, avatarUrl: true, gender: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),

    // Who the professor is, as the card at the top of the screen shows it.
    prisma.professor.findUnique({
      where: { id: professor.id },
      select: {
        employeeNumber: true,
        universityEmail: true,
        grade: true,
        tags: true,
        department: {
          select: {
            id: true,
            name: true,
            faculty: { select: { id: true, name: true } },
          },
        },
      },
    }),

    // Defenses the professor sits on as a committee member — including
    // other professors' projects, which nothing else on this screen covers.
    prisma.defenseCommitteeMember.findMany({
      where: { professorId: professor.id },
      select: {
        role: true,
        defense: {
          select: {
            id: true,
            date: true,
            room: true,
            status: true,
            grade: true,
            groupId: true,
            group: {
              select: {
                topic: {
                  select: {
                    id: true,
                    title: true,
                    professorId: true,
                    professor: { select: { user: lite } },
                  },
                },
                _count: { select: { members: true } },
              },
            },
          },
        },
      },
      orderBy: { defense: { date: "asc" } },
    }),
  ]);

  // ── counters ──
  // Every status, by type: a status added to the schema and forgotten here
  // fails to compile, instead of counting as NaN.
  const breakdown: Record<TopicStatus, number> = {
    pending: 0, approved: 0, open: 0, full: 0, rejected: 0, archived: 0,
  };
  for (const t of topics) breakdown[t.status] += 1;

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

  // ── committee duties ──
  const committee = committeeSeats.map(({ role, defense: d }) => ({
    role,
    id: d.id,
    date: d.date,
    room: d.room,
    status: d.status,
    grade: d.grade,
    groupId: d.groupId,
    topic: { id: d.group.topic.id, title: d.group.topic.title },
    supervisor: d.group.topic.professor.user,
    // Sitting on one's own project's committee is the usual case for the
    // supervisor; the screen marks it so the two kinds read apart.
    ownProject: d.group.topic.professorId === professor.id,
    membersCount: d.group._count.members,
  }));

  return {
    profile,
    committee,
    // Newest first, whatever their milestone's state: "awaiting review"
    // above is the ones still to act on, this is simply what came in.
    recentSubmissions: submissions.slice(0, 8),
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
