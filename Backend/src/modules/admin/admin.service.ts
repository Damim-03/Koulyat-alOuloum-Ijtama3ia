import { nameSearchFilter } from "../../core/search/name-search";
import { prisma } from "../../core/prisma/client";
import { resolveTopicExtras, topicExtrasSelect } from "../../core/topic/topic-extras";
import { passwordChangedMail } from "../auth/email-links";
import {
  computeTopicStatus,
  setTopicDecision,
  setTopicPublished,
  readOccupancy,
  topicActions,
  requestActions,
  occupancyFromRelations,
  OCCUPANCY_INCLUDE,
  type TopicDecision,
  type TopicActionKey,
  COUNTED_ON_CAP,
} from "../../core/topic/topic-status";
import bcrypt from "bcryptjs";
import { revokeAllSessions } from "../../core/auth/sessions";
import { closeUserSessions } from "../../core/auth/refresh-sessions";
import { clearFailures, throttleKey } from "../../core/auth/login-throttle";
import { disconnectSessions } from "../../core/realtime/realtime";
import { studentAcademicWhere } from "./student-filters";
import { topicListWhere } from "./topic-filters";
import { config } from "../../core/config/app.config";
import {
  NotFoundException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  ListUsersDTO,
  CreateUserDTO,
  UpdateUserDTO,
  UpdateUserStatusDTO,
  UpdateUserVerificationDTO,
  ResetPasswordDTO,
  ListStudentsDTO,
  CreateStudentDTO,
  UpdateStudentDTO,
  ListQueryDTO,
  CreateProfessorDTO,
  CreateUniversityDomainDTO,
  AcademicStructureDTO,
  UpdateProfessorDTO,
  CreateFacultyDTO,
  UpdateFacultyDTO,
  CreateDepartmentDTO,
  UpdateDepartmentDTO,
  CreateFiliereDTO,
  UpdateFiliereDTO,
  CreateSpecializationDTO,
  UpdateSpecializationDTO,
  CreateAcademicYearDTO,
  UpdateAcademicYearDTO,
  ListTopicsDTO,
  type TopicTitlesListDTO,
  RejectTopicDTO,
  ChangeSupervisorDTO,
  AssignStudentDTO,
  DissolveProjectDTO,
  CreateDefenseDTO,
  UpdateDefenseDTO,
  ListProfessorsDTO,
  ListProjectsDTO,
  ListMilestonesDTO,
  AdminCreateMilestoneDTO,
  AdminUpdateMilestoneDTO,
  CreateDomainDTO,
  UpdateDomainDTO,
  CreateTopicDTO,
  CreateAssignedTopicDTO,
  UpdateAssignedTopicDTO,
} from "./admin.validation";
import { Prisma, Role } from "../../generated/prisma";
import { assertYearOpen } from "../../core/academic/year-open";
import { assertTeamSize } from "../../core/academic/team-size";
import {
  createNotification,
  createNotifications,
} from "../notification/notification.service";
import { listOf, tr } from "../../core/i18n";
import type { MessageKey } from "../../core/i18n";
import type { NotifyText } from "../notification/notification.service";

// Cost factor is configurable and defaults to 12. bcrypt stores the cost in
// the hash, so raising it does not invalidate existing passwords.
const SALT_ROUNDS = config.BCRYPT_ROUNDS;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  email: true,
  username: true,
  avatarUrl: true, // ← جديد
  gender: true, // ← يحدّد الصورة الافتراضية
  role: true,
  status: true,
  isVerified: true,
  lastLoginAt: true,
  createdAt: true,
};

/** A handed-in file, with who handed it in — never more of that user. */
const submissionSelect = {
  id: true,
  fileName: true,
  fileUrl: true,
  fileSize: true,
  mimeType: true,
  version: true,
  createdAt: true,
  uploadedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      firstNameLatin: true,
      lastNameLatin: true,
      avatarUrl: true,
      gender: true,
    },
  },
} as const;

// Rich user projection for the student profile (adds avatar + phone).
const studentUserSelect = {
  ...userSelect,
  avatarUrl: true,
  phone: true,
};

// Rich user projection for the professor profile (adds phone).
const professorUserSelect = {
  ...userSelect,
  phone: true,
};

// Resolve the userId of a topic's supervising professor (for notifications).
// The caller has just read the topic, and every topic has a professor.
const getTopicProfessorUserId = async (topicId: string) =>
  (
    await prisma.graduationTopic.findUniqueOrThrow({
      where: { id: topicId },
      select: { professor: { select: { userId: true } } },
    })
  ).professor.userId;

// Resolve a student's userId (for notifications) — a request's leader, who exists.
const getStudentUserId = async (studentId: string) =>
  (
    await prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { userId: true },
    })
  ).userId;

//
// ════════ STATS ════════
//
export const getOverviewStatsService = async () => {
  const [
    students,
    professors,
    topics,
    approvedTopics,
    projects,
    defenses,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.professor.count(),
    prisma.graduationTopic.count(),
    prisma.graduationTopic.count({ where: { status: "approved" } }),
    prisma.projectGroup.count(),
    prisma.defense.count(),
  ]);

  return {
    students,
    professors,
    topics,
    approvedTopics,
    projects,
    defenses,
  };
};

//
// ════════ DASHBOARD ════════
//
// Aggregated payload for the admin dashboard page:
//   stats             → counters row
//   pendingProposals  → topics professors submitted, awaiting admin approval
//   recentRequests    → latest team (group) requests: topic + the students
//   upcomingDefenses  → next scheduled defenses
//   attention         → items that need the admin to act
//   topicBreakdown    → topic count per status (for a small chart)
//
const DASHBOARD_STALE_DAYS = 3;

export const getDashboardService = async () => {
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - DASHBOARD_STALE_DAYS * 24 * 60 * 60 * 1000,
  );
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // أشهر آخر 6 أشهر (للنموّ).
  const months: { month: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      start,
      end,
    });
  }

  const [
    // counters
    students,
    professors,
    openTopics,
    fullTopics,
    pendingTopics,
    pendingGroupRequests,
    upcomingDefensesCount,
    // lists
    pendingProposals,
    recentRequests,
    upcomingDefenses,
    staleProposals,
    openWithoutRequests,
    breakdownGrouped,
    // widgets
    activeAcademicYear,
    healthGrouped,
    studentsPerSpecRows,
    // trends (this month vs previous)
    studentsThisMonth,
    studentsPrevMonth,
    topicsThisMonth,
    topicsPrevMonth,
    requestsThisMonth,
    requestsPrevMonth,
    // monthly growth (6m)
    monthlyGrowth,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.professor.count(),
    prisma.graduationTopic.count({ where: { status: "open" } }),
    prisma.graduationTopic.count({ where: { status: "full" } }),
    prisma.graduationTopic.count({ where: { status: "pending" } }),
    prisma.groupRequest.count({ where: { status: "pending" } }),
    prisma.defense.count({
      where: { status: "scheduled", date: { gte: now } },
    }),

    // مقترحات الأساتذة المعلّقة
    prisma.graduationTopic.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        maxStudents: true,
        createdAt: true,
        professor: {
          select: { user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } } },
        },
        specialization: { select: { id: true, name: true } },
      },
    }),

    // آخر طلبات الفرق: الموضوع + الطلبة
    prisma.groupRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        status: true,
        priority: true,
        createdAt: true,
        topic: { select: { id: true, title: true } },
        leader: {
          select: {
            registrationNumber: true,
            user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
          },
        },
        members: {
          select: {
            student: {
              select: {
                registrationNumber: true,
                user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
              },
            },
          },
        },
      },
    }),

    // مناقشات قادمة
    prisma.defense.findMany({
      where: { status: "scheduled", date: { gte: now } },
      orderBy: { date: "asc" },
      take: 5,
      select: {
        id: true,
        date: true,
        room: true,
        group: { select: { topic: { select: { id: true, title: true } } } },
      },
    }),

    // يحتاج انتباهك: مقترحات معلّقة منذ أكثر من 3 أيام
    prisma.graduationTopic.findMany({
      where: { status: "pending", createdAt: { lt: staleBefore } },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        professor: {
          select: { user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } } },
        },
      },
    }),

    // يحتاج انتباهك: مواضيع منشورة بلا أي طلب
    prisma.graduationTopic.findMany({
      where: {
        status: "open",
        groupRequests: { none: {} },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        specialization: { select: { id: true, name: true } },
      },
    }),

    // توزيع المواضيع حسب الحالة
    prisma.graduationTopic.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),

    // السنة الجامعية النشطة
    prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, title: true, isActive: true },
    }),

    // صحّة النظام: تجميع المستخدمين حسب الحالة
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),

    // الطلبة لكل تخصص (لرسم أعمدة)
    prisma.specialization.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { students: true } },
      },
      orderBy: { students: { _count: "desc" } },
      take: 8,
    }),

    // اتّجاهات: هذا الشهر مقابل السابق
    prisma.student.count({ where: { createdAt: { gte: thisMonthStart } } }),
    prisma.student.count({
      where: { createdAt: { gte: prevMonthStart, lt: thisMonthStart } },
    }),
    prisma.graduationTopic.count({
      where: { createdAt: { gte: thisMonthStart } },
    }),
    prisma.graduationTopic.count({
      where: { createdAt: { gte: prevMonthStart, lt: thisMonthStart } },
    }),
    prisma.groupRequest.count({
      where: { createdAt: { gte: thisMonthStart } },
    }),
    prisma.groupRequest.count({
      where: { createdAt: { gte: prevMonthStart, lt: thisMonthStart } },
    }),

    // نموّ آخر 6 أشهر
    Promise.all(
      months.map(async (m) => {
        const [s, t, p] = await Promise.all([
          prisma.student.count({
            where: { createdAt: { gte: m.start, lt: m.end } },
          }),
          prisma.graduationTopic.count({
            where: { createdAt: { gte: m.start, lt: m.end } },
          }),
          prisma.projectGroup.count({
            where: { createdAt: { gte: m.start, lt: m.end } },
          }),
        ]);
        return { month: m.month, students: s, topics: t, projects: p };
      }),
    ),
  ]);

  // ── توزيع الحالات بترتيب ثابت ──
  const STATUS_ORDER = [
    "pending",
    "approved",
    "open",
    "full",
    "rejected",
    "archived",
  ] as const;
  const breakdownMap = new Map(
    breakdownGrouped.map((g) => [g.status, g._count._all]),
  );
  const topicBreakdown = STATUS_ORDER.map((status) => ({
    status,
    count: breakdownMap.get(status) ?? 0,
  }));

  // ── صحّة النظام ──
  const healthMap = new Map(
    healthGrouped.map((g) => [g.status, g._count._all]),
  );
  // من يقرأ اللوحة مسؤولٌ نشط (authMiddleware) — فللنشطين صفٌّ دائماً.
  const activeUsers = healthMap.get("active")!;
  const suspendedUsers = healthMap.get("suspended") ?? 0;
  const systemHealth = {
    totalAccounts: activeUsers + suspendedUsers,
    activeUsers,
    suspendedUsers,
  };

  // ── الطلبة لكل تخصص ──
  const studentsPerSpecialization = studentsPerSpecRows.map((r) => ({
    id: r.id,
    name: r.name,
    count: r._count.students,
  }));

  // ── الاتّجاهات (مقارنة شهرية) ──
  const trend = (current: number, previous: number) => ({
    current,
    previous,
    delta: current - previous,
  });
  const trends = {
    students: trend(studentsThisMonth, studentsPrevMonth),
    topics: trend(topicsThisMonth, topicsPrevMonth),
    requests: trend(requestsThisMonth, requestsPrevMonth),
  };

  return {
    stats: {
      students,
      professors,
      openTopics,
      fullTopics,
      pendingTopics,
      pendingGroupRequests,
      pendingRequests: pendingGroupRequests,
      upcomingDefenses: upcomingDefensesCount,
    },
    trends,
    academicYear: activeAcademicYear,
    pendingProposals,
    recentRequests,
    upcomingDefenses,
    attention: { staleProposals, openWithoutRequests },
    topicBreakdown,
    studentsPerSpecialization,
    monthlyGrowth,
    systemHealth,
  };
};

export const createTopicService = async (data: CreateTopicDTO) => {
  const {
    title,
    description,
    requirements = [],
    objectives = [],
    maxStudents,
    maxRequests = null,
    professorId,
    specializationId,
    academicYearId,
    publish,
  } = data;

  const [professor, specialization, academicYear] = await Promise.all([
    prisma.professor.findUnique({ where: { id: professorId } }),
    prisma.specialization.findUnique({ where: { id: specializationId } }),
    prisma.academicYear.findUnique({ where: { id: academicYearId } }),
  ]);
  if (!professor)
    throw new NotFoundException(
      tr("notFound.professor"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
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
  await assertTeamSize(academicYear.id, specializationId, maxStudents);
  const extras = await resolveTopicExtras(data, { professorId, specializationId });

  // لا مجموعة ولا أعضاء: الموضوع يُنشأ وحده، والطلبة يصلونه عبر طلب مجموعة.
  const topic = await prisma.graduationTopic.create({
    data: {
      ...extras,
      title,
      description,
      requirements,
      objectives,
      maxStudents,
      maxRequests,
      status: publish ? "open" : "approved",
      // النشر بتاريخه، لا بالحالة وحدها: الحالة إسقاطٌ يُعاد حسابه
      // (core/topic/topic-status)، وبلا `publishedAt` يعود «مقبولاً» عند
      // أوّل إعادة حساب — رفضِ طلبٍ عليه مثلاً — فيختفي عن الطلبة.
      publishedAt: publish ? new Date() : null,
      professorId,
      specializationId,
      academicYearId,
    },
  });

  // الأستاذ لم يقترح هذا الموضوع، فأعلِمه أنّ الإدارة أسندت إشرافه إليه.
  await createNotification({
    userId: professor.userId,
    type: "general",
    title: { key: "notif.topicCreatedForYou.title" },
    message: { key: "notif.topicCreatedForYou.message", params: { title: topic.title } },
    link: "/professor/topics",
  });

  return topic;
};

export const createAssignedTopicService = async (
  data: CreateAssignedTopicDTO,
) => {
  const {
    title,
    description,
    requirements = [],
    objectives = [],
    maxStudents,
    maxRequests = null,
    professorId,
    specializationId,
    academicYearId,
    memberStudentIds,
    leaderStudentId,
  } = data;

  // 1) تأكّد من وجود الأستاذ والتخصص والسنة.
  const [professor, specialization, academicYear] = await Promise.all([
    prisma.professor.findUnique({ where: { id: professorId } }),
    prisma.specialization.findUnique({ where: { id: specializationId } }),
    prisma.academicYear.findUnique({ where: { id: academicYearId } }),
  ]);
  if (!professor)
    throw new NotFoundException(
      tr("notFound.professor"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
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
  await assertTeamSize(academicYear.id, specializationId, maxStudents);

  // 2) تأكّد من وجود كل الطلبة.
  const students = await prisma.student.findMany({
    where: { id: { in: memberStudentIds } },
    select: { id: true, userId: true },
  });
  if (students.length !== memberStudentIds.length)
    throw new BadRequestException(
      tr("assigned.studentsMissing"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // 3) امنع إسناد طالب لديه مشروع بالفعل.
  const already = await prisma.projectMember.findFirst({
    where: { studentId: { in: memberStudentIds } },
  });
  if (already)
    throw new BadRequestException(
      tr("assigned.studentHasProject"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // 4) أنشئ الموضوع + المجموعة + الأعضاء (مع المرسِل) — في معاملة واحدة.
  const extras = await resolveTopicExtras(data, { professorId, specializationId });
  const topic = await prisma.$transaction(async (tx) => {
    const created = await tx.graduationTopic.create({
      data: {
        ...extras,
        title,
        description,
        requirements,
        objectives,
        maxStudents,
        maxRequests,
        // قرار الإدارة: معتمَد. و«محجوز» ليست قراراً بل نتيجة المجموعة التي
        // تُنشأ بعد سطرين، فيقرأ الإسقاط `full` من تلقائه. و`publishedAt`
        // يبقى NULL: الموضوع المُسنَد لم يُعرَض على الطلبة قطّ.
        status: "approved",
        professorId,
        specializationId,
        academicYearId,
      },
    });

    const group = await tx.projectGroup.create({
      data: { topicId: created.id },
    });

    await tx.projectMember.createMany({
      data: memberStudentIds.map((sid) => ({
        groupId: group.id,
        studentId: sid,
        isLeader: sid === leaderStudentId,
      })),
      skipDuplicates: true,
    });

    await computeTopicStatus(tx, created.id);
    return tx.graduationTopic.findUniqueOrThrow({ where: { id: created.id } });
  });

  // 5) أعلِم الطلبة المُسنَدين.
  for (const s of students) {
    await createNotification({
      userId: s.userId,
      type: "general",
      title: { key: "notif.assignedToTopic.title" },
      message: { key: "notif.assignedToTopic.message", params: { title: topic.title } },
      link: "/student/project",
    });
  }

  return topic;
};

export const updateAssignedTopicService = async (
  id: string,
  data: UpdateAssignedTopicDTO,
) => {
  const {
    title,
    description,
    requirements,
    objectives,
    maxStudents,
    maxRequests,
    professorId,
    specializationId,
    academicYearId,
    memberStudentIds,
    leaderStudentId,
  } = data;

  // 1) الموضوع + المجموعة وأعضاؤها.
  const topic = await prisma.graduationTopic.findUnique({
    where: { id },
    include: { projectGroup: { include: { members: true } } },
  });
  if (!topic)
    throw new NotFoundException(
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // 1.b إسناد مجموعة إلى موضوع فريقٌ ينتظر قراره يتخطّى الفريق بلا ردّ: تُنشأ
  // المجموعة، ويصير الموضوع `full`، ويبقى طلبهم معلّقاً على موضوع مأخوذ. ولا
  // يُفحص هذا إلا حين تُسنَد مجموعة فعلاً — تعديل العنوان أو المشرف لا يمسّ
  // الفريق المنتظر في شيء.
  if (memberStudentIds && !topic.projectGroup)
    await gateTopicAction(id, "assignGroup");

  // 2) تحقّق من المراجع المُرسَلة.
  if (professorId) {
    const p = await prisma.professor.findUnique({ where: { id: professorId } });
    if (!p)
      throw new NotFoundException(
        tr("notFound.professor"),
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
  }
  if (specializationId) {
    const s = await prisma.specialization.findUnique({
      where: { id: specializationId },
    });
    if (!s)
      throw new NotFoundException(
        tr("notFound.specialization"),
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
  }
  if (academicYearId) {
    const y = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    if (!y)
      throw new NotFoundException(
        tr("notFound.academicYear"),
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
    await assertYearOpen(academicYearId);
  }

  const effectiveMax = maxStudents ?? topic.maxStudents;
  // The rule of its year and level, when its number changes or it moves; kept as it is, in place, it stands.
  if (maxStudents !== undefined || academicYearId || specializationId) {
    const inPlace =
      (!academicYearId || academicYearId === topic.academicYearId) && (!specializationId || specializationId === topic.specializationId);
    await assertTeamSize(
      academicYearId ?? topic.academicYearId,
      specializationId ?? topic.specializationId,
      effectiveMax,
      inPlace ? topic.maxStudents : undefined,
    );
  }
  const currentGroup = topic.projectGroup;
  const currentIds = new Set(
    (currentGroup?.members ?? []).map((m) => m.studentId),
  );

  // The size check below only ran when the member list was part of the same
  // request. A PATCH carrying maxStudents alone slipped past it and could set
  // a ceiling under the group that already exists — three members in a topic
  // whose maximum now says one.
  if (maxStudents !== undefined && !memberStudentIds) {
    if (currentIds.size > maxStudents)
      throw new BadRequestException(
        tr("assigned.maxBelowMembers"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );
  }

  // 3) تحقّقات الطلبة عند تعديلهم.
  let newlyAdded: string[] = [];
  if (memberStudentIds) {
    // These two also live in the Zod schema, but the service must not depend
    // on its caller having validated. Without them a request could empty a
    // group, or name a leader who is not in it — which silently produced a
    // group with no leader at all, since isLeader is set by comparison.
    if (memberStudentIds.length === 0)
      throw new BadRequestException(
        tr("assigned.keepOne"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    if (!leaderStudentId || !memberStudentIds.includes(leaderStudentId))
      throw new BadRequestException(
        tr("assigned.leaderInGroup"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    if (new Set(memberStudentIds).size !== memberStudentIds.length)
      throw new BadRequestException(
        tr("assigned.duplicateStudent"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    if (memberStudentIds.length > effectiveMax)
      throw new BadRequestException(
        tr("assigned.tooMany"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    const students = await prisma.student.findMany({
      where: { id: { in: memberStudentIds } },
      select: { id: true },
    });
    if (students.length !== memberStudentIds.length)
      throw new BadRequestException(
        tr("assigned.studentsMissing"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    // الجدد فقط (غير أعضاء هذه المجموعة) يجب ألّا يكونوا في مشروع آخر.
    newlyAdded = memberStudentIds.filter((sid) => !currentIds.has(sid));
    if (newlyAdded.length) {
      const clash = await prisma.projectMember.findFirst({
        where: {
          studentId: { in: newlyAdded },
          ...(currentGroup ? { groupId: { not: currentGroup.id } } : {}),
        },
      });
      if (clash)
        throw new BadRequestException(
          tr("assigned.newStudentHasProject"),
          ErrorCodeEnum.VALIDATION_ERROR,
        );
    }
  }

  // The co-supervisor, short description and type, checked against the topic as it will be.
  const extras = await resolveTopicExtras(
    { coSupervisorId: data.coSupervisorId, summary: data.summary, typeId: data.typeId },
    { professorId: professorId ?? topic.professorId, specializationId: specializationId ?? topic.specializationId },
    topic,
  );

  // 4) طبّق كل شيء في معاملة واحدة.
  await prisma.$transaction(async (tx) => {
    await tx.graduationTopic.update({
      where: { id },
      data: {
        ...extras,
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(requirements !== undefined ? { requirements } : {}),
        ...(objectives !== undefined ? { objectives } : {}),
        ...(maxStudents !== undefined ? { maxStudents } : {}),
        ...(maxRequests !== undefined ? { maxRequests } : {}),
        ...(professorId !== undefined ? { professorId } : {}),
        ...(specializationId !== undefined ? { specializationId } : {}),
        ...(academicYearId !== undefined ? { academicYearId } : {}),
      },
    });

    if (memberStudentIds && leaderStudentId) {
      const group =
        currentGroup ??
        (await tx.projectGroup.create({ data: { topicId: id } }));

      await tx.projectMember.deleteMany({
        where: { groupId: group.id, studentId: { notIn: memberStudentIds } },
      });

      for (const sid of memberStudentIds) {
        await tx.projectMember.upsert({
          where: { groupId_studentId: { groupId: group.id, studentId: sid } },
          create: {
            groupId: group.id,
            studentId: sid,
            isLeader: sid === leaderStudentId,
          },
          update: { isLeader: sid === leaderStudentId },
        });
      }
    } else if (leaderStudentId && currentGroup) {
      // Promoting an existing member without touching the roster. This used to
      // fall through both branches: the request was accepted with 200 and the
      // leader silently stayed as it was.
      if (!currentIds.has(leaderStudentId))
        throw new BadRequestException(
          tr("assigned.leaderInMembers"),
          ErrorCodeEnum.VALIDATION_ERROR,
        );

      await tx.projectMember.updateMany({
        where: { groupId: currentGroup.id },
        data: { isLeader: false },
      });
      await tx.projectMember.update({
        where: {
          groupId_studentId: {
            groupId: currentGroup.id,
            studentId: leaderStudentId,
          },
        },
        data: { isLeader: true },
      });
    }

    // This path can create the group for a topic that did not have one, so
    // the occupancy it projects has to be rewritten with it.
    await computeTopicStatus(tx, id);
  });

  // 5) أعلِم الطلبة المُضافين حديثاً.
  if (newlyAdded.length) {
    const added = await prisma.student.findMany({
      where: { id: { in: newlyAdded } },
      select: { userId: true },
    });
    for (const s of added) {
      await createNotification({
        userId: s.userId,
        type: "general",
        title: { key: "notif.assignedToTopic.title" },
        message: { key: "notif.assignedToTopic.message", params: { title: title ?? topic.title } },
        link: "/student/project",
      });
    }
  }

  return getTopicByIdService(id);
};

//
// ════════ USERS ════════
//
// Name search, one word at a time — shared with the professors' search (core/search/name-search).
export { nameSearchFilter };

export const listUsersService = async (q: ListUsersDTO) => {
  const where: Record<string, unknown> = {};
  if (q.role) where.role = q.role;
  if (q.status) where.status = q.status;

  // Filters are combined with AND: each one narrows what the others left.
  const and: Record<string, unknown>[] = [];

  const byName = q.search ? nameSearchFilter(q.search) : null;
  if (byName) and.push(byName);

  // The account address, or the professor's separate university address.
  if (q.email) {
    and.push({
      OR: [
        { email: { contains: q.email } },
        {
          professor: {
            universityEmail: { contains: q.email },
          },
        },
      ],
    });
  }

  // Only students carry a registration number, so this narrows to them.
  if (q.registrationNumber) {
    and.push({
      student: {
        registrationNumber: {
          contains: q.registrationNumber,
        },
      },
    });
  }

  if (and.length > 0) where.AND = and;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page: q.page, limit: q.limit };
};

// ════════════════════════════════════════════════════════════
//  REPLACE getUserByIdService in admin.service.ts WITH THIS
//  Expands the student projection to the full academic chain
//  (specialization → filiere → department → faculty) + academicYear,
//  so the ID card can be filled. Professor/admin unchanged.
// ════════════════════════════════════════════════════════════

export const getUserByIdService = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      phone: true,
      student: {
        select: {
          id: true,
          registrationNumber: true,
          academicYear: { select: { id: true, title: true } },
          specialization: {
            select: {
              id: true,
              name: true,
              filiere: {
                select: {
                  id: true,
                  name: true,
                  department: {
                    select: {
                      id: true,
                      name: true,
                      faculty: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      professor: {
        select: {
          id: true,
          employeeNumber: true,
          universityEmail: true,
          department: {
            select: {
              id: true,
              name: true,
              faculty: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!user)
    throw new NotFoundException(
      tr("notFound.user"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return user;
};

export const createUserService = async (data: CreateUserDTO) => {
  if (!data.email && !data.username) {
    throw new BadRequestException(
      tr("user.emailOrUsername"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      username: data.username,
      password: hashed,
      // Handed out by the administration: replaced by its owner before use.
      mustChangePassword: true,
      role: data.role as Role,
      gender: data.gender,
      // undefined leaves the column at its default (false).
      isVerified: data.isVerified,
    },
    select: userSelect,
  });
  return user;
};

export const updateUserService = async (id: string, data: UpdateUserDTO) => {
  await getUserByIdService(id);
  const user = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });
  return user;
};

/**
 * The administration must never lock itself out. Every administrator is equal
 * here — any one may suspend or delete another — so two things are refused:
 * doing it to yourself (a slip of the mouse ends your own access, and with it
 * the means to undo it), and doing it to the last active administrator, after
 * which only someone with a shell on the server (`create-admin`) could get
 * back in.
 */
const assertAdministrationKeepsAnAdmin = async (
  target: { id: string; role: string; status: string },
  actorId: string,
) => {
  if (target.role !== "admin") return;
  if (target.id === actorId)
    throw new BadRequestException(tr("user.notYourself"), ErrorCodeEnum.VALIDATION_ERROR);
  if (target.status !== "active") return;
  const others = await prisma.user.count({
    where: { role: "admin", status: "active", NOT: { id: target.id } },
  });
  if (others === 0)
    throw new BadRequestException(tr("user.lastAdmin"), ErrorCodeEnum.VALIDATION_ERROR);
};

export const updateUserStatusService = async (
  id: string,
  data: UpdateUserStatusDTO,
  actorId: string,
) => {
  const target = await getUserByIdService(id);
  if (data.status !== "active") await assertAdministrationKeepsAnAdmin(target, actorId);
  const user = await prisma.user.update({
    where: { id },
    data: { status: data.status },
    select: userSelect,
  });
  // Requests are refused from the next one on; a live socket is cut now.
  if (data.status !== "active") void disconnectSessions(id);
  return user;
};

export const updateUserVerificationService = async (
  id: string,
  data: UpdateUserVerificationDTO,
) => {
  await getUserByIdService(id);
  const user = await prisma.user.update({
    where: { id },
    data: { isVerified: data.isVerified },
    select: userSelect,
  });
  return user;
};

/**
 * A password the administration sets ends every session on the account
 * (whoever was inside, was inside with the old password) and lifts a lock left
 * by failed attempts.
 */
export const resetUserPasswordService = async (
  id: string,
  data: ResetPasswordDTO,
) => {
  const user = await getUserByIdService(id);
  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { password: hashed, mustChangePassword: true } });

  await revokeAllSessions(id);
  await closeUserSessions(id);
  void disconnectSessions(id);

  const ids = await prisma.user.findUnique({
    where: { id },
    select: {
      email: true,
      student: { select: { registrationNumber: true } },
      professor: { select: { universityEmail: true } },
    },
  });
  await clearFailures(
    ...[
      ids?.student && throttleKey("student", ids.student.registrationNumber),
      ids?.professor && throttleKey("professor", ids.professor.universityEmail),
      user.role === "admin" && ids?.email && throttleKey("admin", ids.email),
    ].filter((k): k is string => !!k),
  );
  // Its owner learns of it by email, if their address is proven.
  void passwordChangedMail(id, { byAdmin: true });
  return { message: "Password reset" };
};

export const deleteUserService = async (id: string, actorId: string) => {
  const user = await getUserByIdService(id);
  await assertAdministrationKeepsAnAdmin(user, actorId);
  if (user.student)
    throw new BadRequestException(
      tr("user.isStudent"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (user.professor)
    throw new BadRequestException(
      tr("user.isProfessor"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.user.delete({ where: { id } });
  return { message: "User deleted" };
};

//
// ════════ STUDENTS ════════
//
// ════════════════════════════════════════════════════════════
//  REPLACE listStudentsService in admin.service.ts WITH THIS
//  Adds full academic chain to each row + filiere/department/faculty filters.
// ════════════════════════════════════════════════════════════

export const listStudentsService = async (q: ListStudentsDTO) => {
  // السنة والهرم والمستوى والتخصص — الشرط نفسه الذي يقرؤه التصدير.
  const where: Record<string, unknown> = studentAcademicWhere(q);

  if (q.unassigned === "true") {
    // «لم يختر موضوعاً» = لا مشروع نهائي ولا طلب مجموعة نشط (يقوده أو عضو فيه).
    where.projectMembers = { none: {} };
    where.ledGroupRequests = {
      none: { status: { in: ["pending", "accepted"] } },
    };
    where.groupRequestMembers = {
      none: { request: { status: { in: ["pending", "accepted"] } } },
    };
  }

  // Filters are combined with AND: each one narrows what the others left.
  const and: Record<string, unknown>[] = [];

  const byName = q.search
    ? nameSearchFilter(q.search, (f) => ({ user: f }))
    : null;
  if (byName) and.push(byName);

  // Picker search: try every identifier at once.
  if (q.quickSearch) {
    const term = q.quickSearch;
    const byNameToo = nameSearchFilter(term, (f) => ({ user: f }));
    and.push({
      OR: [
        ...(byNameToo ? [byNameToo] : []),
        { registrationNumber: { contains: term } },
        // Student has no universityEmail of its own — only Professor does.
        { user: { username: { contains: term } } },
        { user: { email: { contains: term } } },
      ],
    });
  }

  if (q.registrationNumber) {
    and.push({ registrationNumber: { contains: q.registrationNumber } });
  }

  if (and.length > 0) where.AND = and;

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        user: { select: userSelect },
        academicYear: true,
        // Full chain so the list can show specialization/filiere/department/faculty.
        specialization: {
          include: {
            filiere: {
              include: { department: { include: { faculty: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.student.count({ where }),
  ]);

  return { items, total, page: q.page, limit: q.limit };
};

export const getStudentByIdService = async (id: string) => {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: studentUserSelect },
      academicYear: true,
      // Full academic chain: specialization → filiere → department → faculty.
      specialization: {
        include: {
          filiere: {
            include: { department: { include: { faculty: true } } },
          },
        },
      },
      // Group requests this student LEADS.
      ledGroupRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          topic: { select: { id: true, title: true, status: true } },
          members: {
            include: {
              student: { include: { user: { select: userSelect } } },
            },
          },
        },
      },
      // Group requests this student is a MEMBER of (led by someone else).
      groupRequestMembers: {
        include: {
          request: {
            include: {
              topic: { select: { id: true, title: true, status: true } },
              leader: { include: { user: { select: userSelect } } },
            },
          },
        },
      },
      // The final, accepted project (chosen topic + defense).
      projectMembers: {
        include: {
          group: {
            include: {
              topic: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  professor: { include: { user: { select: userSelect } } },
                },
              },
              defense: true,
            },
          },
        },
      },
    },
  });
  if (!student)
    throw new NotFoundException(
      tr("notFound.student"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return student;
};

export const createStudentService = async (data: CreateStudentDTO) => {
  const exists = await prisma.student.findUnique({
    where: { registrationNumber: data.registrationNumber },
  });
  if (exists)
    throw new BadRequestException(
      tr("student.registrationTaken"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);

  await assertYearOpen(data.academicYearId);

  const student = await prisma.student.create({
    data: {
      registrationNumber: data.registrationNumber,
      specialization: { connect: { id: data.specializationId } },
      academicYear: { connect: { id: data.academicYearId } },
      user: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          firstNameLatin: data.firstNameLatin,
          lastNameLatin: data.lastNameLatin,
          email: data.email,
          phone: data.phone,
          avatarUrl: data.avatarUrl,
          gender: data.gender,
          password: hashed,
          // Handed out (a birth date, typically): replaced by its owner before use.
          mustChangePassword: true,
          role: "student" as Role,
          isVerified: data.isVerified,
        },
      },
    },
    include: {
      user: { select: userSelect },
      specialization: true,
      academicYear: true,
    },
  });
  return student;
};

export const updateStudentService = async (
  id: string,
  data: UpdateStudentDTO,
) => {
  await getStudentByIdService(id);

  // If changing the registration number, keep it unique.
  if (data.registrationNumber !== undefined) {
    const clash = await prisma.student.findFirst({
      where: { registrationNumber: data.registrationNumber, id: { not: id } },
      select: { id: true },
    });
    if (clash)
      throw new BadRequestException(
        tr("student.registrationTaken"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );
  }

  const updateData: Record<string, unknown> = {};
  if (data.registrationNumber !== undefined)
    updateData.registrationNumber = data.registrationNumber;
  if (data.specializationId !== undefined)
    updateData.specialization = { connect: { id: data.specializationId } };
  if (data.academicYearId !== undefined) {
    await assertYearOpen(data.academicYearId);
    updateData.academicYear = { connect: { id: data.academicYearId } };
  }

  const userUpdate: Record<string, unknown> = {};
  if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
  if (data.lastName !== undefined) userUpdate.lastName = data.lastName;
  if (data.firstNameLatin !== undefined)
    userUpdate.firstNameLatin = data.firstNameLatin;
  if (data.lastNameLatin !== undefined)
    userUpdate.lastNameLatin = data.lastNameLatin;
  if (data.email !== undefined) userUpdate.email = data.email;
  if (data.phone !== undefined) userUpdate.phone = data.phone;
  if (data.avatarUrl !== undefined) userUpdate.avatarUrl = data.avatarUrl;
  if (data.gender !== undefined) userUpdate.gender = data.gender;
  if (Object.keys(userUpdate).length > 0)
    updateData.user = { update: userUpdate };

  const student = await prisma.student.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: studentUserSelect },
      specialization: {
        include: {
          filiere: {
            include: { department: { include: { faculty: true } } },
          },
        },
      },
      academicYear: true,
    },
  });
  return student;
};

export const deleteStudentService = async (id: string) => {
  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!student)
    throw new NotFoundException(
      tr("notFound.student"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  await prisma.$transaction(async (tx) => {
    // المواضيع التي يتقدّم إليها بطلبٍ معلّق: يُعاد عدّ سقفها بعد الحذف.
    const pendingOn = await tx.groupRequest.findMany({
      where: { leaderStudentId: id, status: "pending" },
      select: { topicId: true },
    });
    // ملفّات الطالب المرفوعة
    await tx.submission.deleteMany({ where: { uploadedById: student.userId } });
    // طلبات الالتحاق الفردية
    await tx.topicApplication.deleteMany({ where: { studentId: id } });
    // عضوياته في طلبات فرق الآخرين
    await tx.groupRequestMember.deleteMany({ where: { studentId: id } });
    // طلبات الفرق التي يقودها (تتعاقب أعضاؤها تلقائيًّا عبر onDelete: Cascade)
    await tx.groupRequest.deleteMany({ where: { leaderStudentId: id } });
    // عضويته في المشاريع
    await tx.projectMember.deleteMany({ where: { studentId: id } });
    // أخيرًا الطالب ثم حسابه (الإشعارات تتعاقب عبر onDelete: Cascade)
    await tx.student.delete({ where: { id } });
    await tx.user.delete({ where: { id: student.userId } });
    for (const topicId of new Set(pendingOn.map((r) => r.topicId))) await computeTopicStatus(tx, topicId);
  });
  return { message: "Student deleted" };
};

//
// ════════ PROFESSORS ════════
//
export const listProfessorsService = async (q: ListProfessorsDTO) => {
  const where: Record<string, unknown> = {};

  // Filters are combined with AND: each one narrows what the others left.
  const and: Record<string, unknown>[] = [];

  const byName = q.search
    ? nameSearchFilter(q.search, (f) => ({ user: f }))
    : null;
  if (byName) and.push(byName);

  // Picker search: the caller has one string and does not know which field
  // it belongs to, so every identifier is tried at once.
  if (q.quickSearch) {
    const term = q.quickSearch;
    const byNameToo = nameSearchFilter(term, (f) => ({ user: f }));
    and.push({
      OR: [
        ...(byNameToo ? [byNameToo] : []),
        { universityEmail: { contains: term } },
        { employeeNumber: { contains: term } },
        { user: { username: { contains: term } } },
        { user: { email: { contains: term } } },
      ],
    });
  }

  if (q.employeeNumber) {
    and.push({ employeeNumber: { contains: q.employeeNumber } });
  }

  // The university address, or the address on the underlying account.
  if (q.email) {
    and.push({
      OR: [
        { universityEmail: { contains: q.email } },
        { user: { email: { contains: q.email } } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;

  // Most specific wins: department > filiere > faculty.
  if (q.departmentId) {
    where.departmentId = q.departmentId;
  } else if (q.filiereId) {
    where.department = { filieres: { some: { id: q.filiereId } } };
  } else if (q.facultyId) {
    where.department = { facultyId: q.facultyId };
  }

  // Optional exact-tag match over the grade array (if you wire a UI filter).
  // `grade` عمود JSON (مصفوفةٌ منذ الانتقال إلى MySQL) — و`has` لمصفوفات PostgreSQL وحدها.
  if (q.grade) where.grade = { path: "$", array_contains: [q.grade] };

  const [items, total] = await Promise.all([
    prisma.professor.findMany({
      where,
      include: {
        user: { select: userSelect },
        department: { include: { faculty: true, filieres: true } }, // ← faculty + الشعبة
        _count: { select: { topics: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.professor.count({ where }),
  ]);

  return { items, total, page: q.page, limit: q.limit };
};

export const getProfessorByIdService = async (id: string) => {
  const professor = await prisma.professor.findUnique({
    where: { id },
    include: {
      user: { select: professorUserSelect }, // ← adds phone
      department: { include: { faculty: true } }, // ← adds faculty
      topics: {
        orderBy: { createdAt: "desc" },
        include: {
          specialization: { select: { id: true, name: true } },
          _count: { select: { groupRequests: { where: COUNTED_ON_CAP } } },
        },
      },
    },
  });
  if (!professor)
    throw new NotFoundException(
      tr("notFound.professor"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return professor;
};

//
// ─── ACADEMIC STRUCTURE (معالج الهيكل الأكاديمي) ──────────────
//

/**
 * ينشئ شجرة أكاديمية كاملة في معاملة واحدة: كلية ← أقسام ← ميادين ← شعب ←
 * تخصّصات. الكلّ أو لا شيء — لا يبقى هيكل نصفه محفوظ إن فشلت خطوة.
 *
 * الرموز (code) فريدة في القاعدة، لذا تُفحص كلّها مسبقاً — داخل الحمولة نفسها
 * ومقابل الصفوف الموجودة — لنعيد رسالة مفهومة بدل خطأ قيد فريد خام.
 */
export const createAcademicStructureService = async (
  data: AcademicStructureDTO,
) => {
  // ── 1. الرموز المطلوبة في هذه العملية ──
  const newCodes: { code: string; label: string }[] = [];
  if (data.faculty.kind === "new")
    newCodes.push({ code: data.faculty.code, label: tr("structure.label.faculty") });
  for (const d of data.departments)
    newCodes.push({ code: d.code, label: tr("structure.label.department", { name: d.name }) });
  for (const d of data.domains)
    newCodes.push({ code: d.code, label: tr("structure.label.domain", { name: d.name }) });
  for (const f of data.filieres)
    newCodes.push({ code: f.code, label: tr("structure.label.filiere", { name: f.name }) });

  // تكرار داخل الحمولة نفسها
  const seen = new Set<string>();
  for (const { code, label } of newCodes) {
    if (seen.has(code))
      throw new BadRequestException(
        tr("structure.codeRepeated", { code, label }),
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    seen.add(code);
  }

  // تعارض مع رموز موجودة (الرمز فريد في كل جدول على حدة)
  const codes = [...seen];
  if (codes.length) {
    const [faculties, departments, domains, filieres] = await Promise.all([
      prisma.faculty.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      }),
      prisma.department.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      }),
      prisma.domain.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      }),
      prisma.filiere.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      }),
    ]);
    const taken = [...faculties, ...departments, ...domains, ...filieres].map(
      (r) => r.code,
    );
    if (taken.length)
      throw new BadRequestException(
        tr("structure.codesTaken", { list: listOf([...new Set(taken)]) }),
        ErrorCodeEnum.VALIDATION_ERROR,
      );
  }

  // ── 2. الإنشاء داخل معاملة ──
  return prisma.$transaction(async (tx) => {
    // الكلية: جديدة أو قائمة
    const faculty =
      data.faculty.kind === "new"
        ? await tx.faculty.create({
            data: { name: data.faculty.name, code: data.faculty.code },
          })
        : await tx.faculty.findUnique({ where: { id: data.faculty.id } });

    if (!faculty)
      throw new NotFoundException(
        tr("notFound.faculty"),
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );

    const departmentIds = new Map<string, string>();
    for (const d of data.departments) {
      const created = await tx.department.create({
        data: { name: d.name, code: d.code, facultyId: faculty.id },
      });
      departmentIds.set(d.key, created.id);
    }

    // يحوّل إشارة (مفتاح مؤقّت أو معرّف قائم) إلى معرّف حقيقي.
    const resolve = (
      ref: { kind: "new" | "existing"; value: string },
      created: Map<string, string>,
      what: string,
    ): string => {
      if (ref.kind === "existing") return ref.value;
      const id = created.get(ref.value);
      if (!id)
        throw new BadRequestException(
          tr("structure.danglingRef", { what }),
          ErrorCodeEnum.VALIDATION_ERROR,
        );
      return id;
    };

    const domainIds = new Map<string, string>();
    for (const d of data.domains) {
      const created = await tx.domain.create({
        data: {
          name: d.name,
          code: d.code,
          departmentId: resolve(
            d.department,
            departmentIds,
            tr("structure.label.domain", { name: d.name }),
          ),
        },
      });
      domainIds.set(d.key, created.id);
    }

    let specializationCount = 0;
    for (const f of data.filieres) {
      const filiere = await tx.filiere.create({
        data: {
          name: f.name,
          code: f.code,
          departmentId: resolve(
            f.department,
            departmentIds,
            tr("structure.label.filiere", { name: f.name }),
          ),
          domainId: f.domain
            ? resolve(f.domain, domainIds, tr("structure.label.filiere", { name: f.name }))
            : null,
        },
      });
      for (const s of f.specializations) {
        await tx.specialization.create({
          data: { name: s.name, level: s.level, filiereId: filiere.id },
        });
        specializationCount++;
      }
    }

    return {
      faculty,
      created: {
        departments: data.departments.length,
        domains: data.domains.length,
        filieres: data.filieres.length,
        specializations: specializationCount,
      },
    };
  });
};

//
// ─── UNIVERSITY DOMAINS ───────────────────────────────────────
//

export const listUniversityDomainsService = () =>
  prisma.universityDomain.findMany({
    orderBy: [{ isDefault: "desc" }, { domain: "asc" }],
  });

export const createUniversityDomainService = async (
  data: CreateUniversityDomainDTO,
) => {
  const exists = await prisma.universityDomain.findUnique({
    where: { domain: data.domain },
  });
  if (exists)
    throw new BadRequestException(
      tr("emailDomain.exists"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // نطاق افتراضي واحد فقط.
  if (data.isDefault) {
    await prisma.universityDomain.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.universityDomain.create({
    data: { domain: data.domain, isDefault: data.isDefault ?? false },
  });
};

export const setDefaultUniversityDomainService = async (id: string) => {
  const domain = await prisma.universityDomain.findUnique({ where: { id } });
  if (!domain)
    throw new NotFoundException(
      tr("notFound.emailDomain"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  await prisma.$transaction([
    prisma.universityDomain.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    }),
    prisma.universityDomain.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);

  return { message: "تم تعيين النطاق الافتراضي" };
};

export const deleteUniversityDomainService = async (id: string) => {
  const domain = await prisma.universityDomain.findUnique({ where: { id } });
  if (!domain)
    throw new NotFoundException(
      tr("notFound.emailDomain"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // لا يجوز ترك النظام بلا نطاق — لن يستطيع أحد إنشاء أستاذ بعدها.
  const total = await prisma.universityDomain.count();
  if (total <= 1)
    throw new BadRequestException(
      tr("emailDomain.lastOne"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // ولا حذف نطاق يستعمله أساتذة، وإلّا صارت بياناتهم غير صالحة.
  const inUse = await prisma.professor.count({
    where: { universityEmail: { endsWith: `@${domain.domain}` } },
  });
  if (inUse > 0)
    throw new BadRequestException(
      tr("emailDomain.inUse", { what: tr("count.professors", { count: inUse }) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.universityDomain.delete({ where: { id } });
  return { message: "تم حذف النطاق" };
};

/**
 * يتحقّق أنّ نطاق البريد الجامعي مسجَّل في UniversityDomain.
 * هذا هو الفرض الحقيقي — انتقل من regex ثابت في مخطّطات zod إلى القاعدة
 * حتى تستطيع الإدارة إضافة نطاقات من الواجهة.
 */
const assertAllowedUniversityDomain = async (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const allowed = await prisma.universityDomain.findUnique({
    where: { domain },
  });
  if (allowed) return;

  const all = await prisma.universityDomain.findMany({
    select: { domain: true },
    orderBy: { domain: "asc" },
  });
  throw new BadRequestException(
    all.length
      ? tr("emailDomain.notAllowed", { list: listOf(all.map((d) => `@${d.domain}`)) })
      : tr("emailDomain.none"),
    ErrorCodeEnum.VALIDATION_ERROR,
  );
};

/**
 * رقم وظيفي بصيغة باركود EAN-13 قياسي — قابل للطباعة والمسح الضوئي:
 *
 *   613 | 01 | 7 أرقام عشوائية | رقم تحقّق
 *   └┬┘   └┬┘                    └────┬───┘
 *    │     │                          └── يُحسب بخوارزمية EAN-13
 *    │     └── رمز الفئة: 01 = أستاذ
 *    └── بادئة GS1 للجزائر
 *
 * البدء بـ 613 يميّزه فوراً عن رقم تسجيل الطالب الذي يبدأ بسنة التسجيل،
 * فلا يلتبس الرقمان بصرياً ولا يتقاطع مداهما أبداً.
 */
const EMPLOYEE_NUMBER_PREFIX = "61301";

/** رقم التحقّق القياسي في EAN-13: أوزان 1 و3 بالتناوب على الخانات الاثنتي عشرة. */
const ean13CheckDigit = (twelveDigits: string): number => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(twelveDigits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
};

export const randomEmployeeNumber = (): string => {
  let body = "";
  for (let i = 0; i < 7; i++) {
    body += Math.floor(Math.random() * 10).toString();
  }
  const twelve = `${EMPLOYEE_NUMBER_PREFIX}${body}`;
  return `${twelve}${ean13CheckDigit(twelve)}`;
};

/** يعيد رقماً وظيفياً غير مستعمل. الفهرس الفريد في القاعدة هو الضامن الأخير. */
const generateUniqueEmployeeNumber = async (attempts = 10): Promise<string> => {
  for (let i = 0; i < attempts; i++) {
    const candidate = randomEmployeeNumber();
    const taken = await prisma.professor.findUnique({
      where: { employeeNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new BadRequestException(
    tr("professor.employeeNumberFailed"),
    ErrorCodeEnum.VALIDATION_ERROR,
  );
};

export const createProfessorService = async (data: CreateProfessorDTO) => {
  await assertAllowedUniversityDomain(data.universityEmail);

  // الإدارة لم تعد تُدخل الرقم يدوياً — يُولَّد هنا ما لم يُرسَل صراحةً.
  const employeeNumber =
    data.employeeNumber ?? (await generateUniqueEmployeeNumber());

  const exists = await prisma.professor.findFirst({
    where: {
      OR: [{ employeeNumber }, { universityEmail: data.universityEmail }],
    },
  });
  if (exists)
    throw new BadRequestException(
      tr("professor.idsTaken"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);

  const professor = await prisma.professor.create({
    data: {
      employeeNumber,
      universityEmail: data.universityEmail,
      grade: data.grade ?? [], // ← الرتبة (tags)
      tags: data.tags ?? [], // ← الصفة (tags)
      department: { connect: { id: data.departmentId } },
      user: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          firstNameLatin: data.firstNameLatin,
          lastNameLatin: data.lastNameLatin,
          email: data.email,
          gender: data.gender,
          password: hashed,
          // Handed out (a birth date, typically): replaced by its owner before use.
          mustChangePassword: true,
          role: "professor" as Role,
          isVerified: data.isVerified,
        },
      },
    },
    include: { user: { select: userSelect }, department: true },
  });
  return professor;
};

export const updateProfessorService = async (
  id: string,
  data: UpdateProfessorDTO,
) => {
  await getProfessorByIdService(id);

  const updateData: Record<string, unknown> = {};
  if (data.universityEmail !== undefined) {
    await assertAllowedUniversityDomain(data.universityEmail);
    updateData.universityEmail = data.universityEmail;
  }
  if (data.departmentId !== undefined)
    updateData.department = { connect: { id: data.departmentId } }; // ← الإصلاح
  if (data.grade !== undefined) updateData.grade = data.grade; // full replace
  if (data.tags !== undefined) updateData.tags = data.tags; // full replace

  // user-account fields (name, personal email, phone, avatar)
  const userUpdate: Record<string, unknown> = {};
  if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
  if (data.lastName !== undefined) userUpdate.lastName = data.lastName;
  if (data.firstNameLatin !== undefined) userUpdate.firstNameLatin = data.firstNameLatin;
  if (data.lastNameLatin !== undefined) userUpdate.lastNameLatin = data.lastNameLatin;
  if (data.email !== undefined) userUpdate.email = data.email;
  if (data.phone !== undefined) userUpdate.phone = data.phone;
  if (data.avatarUrl !== undefined) userUpdate.avatarUrl = data.avatarUrl;
  if (data.gender !== undefined) userUpdate.gender = data.gender;
  if (Object.keys(userUpdate).length > 0)
    updateData.user = { update: userUpdate };

  const professor = await prisma.professor.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: professorUserSelect }, // ← يرجع phone + avatarUrl
      department: { include: { faculty: true } }, // ← يرجع faculty للواجهة
    },
  });
  return professor;
};

export const deleteProfessorService = async (id: string) => {
  const professor = await prisma.professor.findUnique({
    where: { id },
    select: { id: true, userId: true, _count: { select: { topics: true } } },
  });
  if (!professor)
    throw new NotFoundException(
      tr("notFound.professor"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (professor._count.topics > 0)
    throw new BadRequestException(
      tr("professor.deleteBlocked", { what: tr("count.topics", { count: professor._count.topics }) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.$transaction(async (tx) => {
    await tx.submission.deleteMany({
      where: { uploadedById: professor.userId },
    });
    await tx.defenseCommitteeMember.deleteMany({ where: { professorId: id } });
    await tx.professor.delete({ where: { id } });
    await tx.user.delete({ where: { id: professor.userId } });
  });
  return { message: "Professor deleted" };
};

//
// ════════ FACULTIES ════════
//
export const listFacultiesService = async () => {
  const faculties = await prisma.faculty.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { departments: true } },
      departments: {
        select: {
          _count: { select: { domains: true, filieres: true } },
          filieres: {
            select: { _count: { select: { specializations: true } } },
          },
        },
      },
    },
  });

  return faculties.map((f) => {
    let domains = 0,
      filieres = 0,
      specializations = 0;
    for (const d of f.departments) {
      domains += d._count.domains;
      filieres += d._count.filieres;
      for (const fl of d.filieres) specializations += fl._count.specializations;
    }
    const { departments, ...rest } = f;
    void departments; // نتجاهلها صراحةً
    return {
      ...rest,
      _count: {
        departments: f._count.departments,
        domains,
        filieres,
        specializations,
      },
    };
  });
};

export const createFacultyService = async (data: CreateFacultyDTO) => {
  const exists = await prisma.faculty.findUnique({
    where: { code: data.code },
  });
  if (exists)
    throw new BadRequestException(
      tr("structure.codeTaken.faculty"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return prisma.faculty.create({ data });
};

export const updateFacultyService = async (
  id: string,
  data: UpdateFacultyDTO,
) => {
  const found = await prisma.faculty.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.faculty"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.faculty.update({ where: { id }, data });
};

export const deleteFacultyService = async (id: string) => {
  const found = await prisma.faculty.findUnique({
    where: { id },
    include: { _count: { select: { departments: true } } },
  });
  if (!found)
    throw new NotFoundException(
      tr("notFound.faculty"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found._count.departments > 0)
    throw new BadRequestException(
      tr("structure.deleteBlocked.faculty", { what: tr("count.departments", { count: found._count.departments }) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.faculty.delete({ where: { id } });
  return { message: "Faculty deleted" };
};

//
// ════════ DOMAINS (الميادين) ════════
//
export const listDomainsService = async (departmentId?: string) => {
  return prisma.domain.findMany({
    where: departmentId ? { departmentId } : undefined,
    // بطاقة الميدان في صفحة القسم تعرض عدد شُعبه.
    include: { department: true, _count: { select: { filieres: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const createDomainService = async (data: CreateDomainDTO) => {
  const exists = await prisma.domain.findUnique({ where: { code: data.code } });
  if (exists)
    throw new BadRequestException(
      tr("structure.codeTaken.domain"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return prisma.domain.create({ data, include: { department: true } });
};

export const updateDomainService = async (
  id: string,
  data: UpdateDomainDTO,
) => {
  const found = await prisma.domain.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.domain"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.domain.update({
    where: { id },
    data,
    include: { department: true },
  });
};

export const deleteDomainService = async (id: string) => {
  const found = await prisma.domain.findUnique({
    where: { id },
    include: { _count: { select: { filieres: true } } },
  });
  if (!found)
    throw new NotFoundException(
      tr("notFound.domain"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  // `Filiere.domainId` is optional and set to NULL on delete, so without this
  // the domain's filieres would silently lose it — refused, like a department.
  if (found._count.filieres > 0)
    throw new BadRequestException(
      tr("structure.deleteBlocked.domain", { what: tr("count.filieres", { count: found._count.filieres }) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.domain.delete({ where: { id } });
  return { message: "Domain deleted" };
};

//
// ════════ DEPARTMENTS ════════
//
export const listDepartmentsService = async () => {
  const departments = await prisma.department.findMany({
    include: {
      faculty: true,
      _count: { select: { filieres: true, professors: true, domains: true } },
      // التخصّص يتبع الشعبة لا القسم، فلا وجود لعلاقة مباشرة يعدّها Prisma —
      // نجمعها عبر الشعب ونضيفها إلى _count ليقرأها العميل كبقيّة العدّادات.
      filieres: { select: { _count: { select: { specializations: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return departments.map(({ filieres, ...department }) => ({
    ...department,
    _count: {
      ...department._count,
      specializations: filieres.reduce(
        (total, f) => total + f._count.specializations,
        0,
      ),
    },
  }));
};

export const createDepartmentService = async (data: CreateDepartmentDTO) => {
  const exists = await prisma.department.findUnique({
    where: { code: data.code },
  });
  if (exists)
    throw new BadRequestException(
      tr("structure.codeTaken.department"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return prisma.department.create({ data, include: { faculty: true } });
};

export const updateDepartmentService = async (
  id: string,
  data: UpdateDepartmentDTO,
) => {
  const found = await prisma.department.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.department"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.department.update({
    where: { id },
    data,
    include: { faculty: true },
  });
};

export const deleteDepartmentService = async (id: string) => {
  const found = await prisma.department.findUnique({
    where: { id },
    include: {
      _count: { select: { filieres: true, professors: true, domains: true } },
    },
  });
  if (!found)
    throw new NotFoundException(
      tr("notFound.department"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  const blockers: string[] = [];
  if (found._count.domains > 0) blockers.push(tr("count.domains", { count: found._count.domains }));
  if (found._count.filieres > 0) blockers.push(tr("count.filieres", { count: found._count.filieres }));
  if (found._count.professors > 0)
    blockers.push(tr("count.professors", { count: found._count.professors }));
  if (blockers.length)
    throw new BadRequestException(
      tr("structure.deleteBlocked.department", { what: listOf(blockers) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.department.delete({ where: { id } });
  return { message: "Department deleted" };
};

//
// ════════ FILIERES ════════
//
export const listFilieresService = async (filter?: {
  domainId?: string;
  departmentId?: string;
}) => {
  const where: { domainId?: string; departmentId?: string } = {};
  if (filter?.domainId) where.domainId = filter.domainId;
  else if (filter?.departmentId) where.departmentId = filter.departmentId;
  return prisma.filiere.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: {
      department: true,
      domain: true,
      _count: { select: { specializations: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const createFiliereService = async (data: CreateFiliereDTO) => {
  const exists = await prisma.filiere.findUnique({
    where: { code: data.code },
  });
  if (exists)
    throw new BadRequestException(
      tr("structure.codeTaken.filiere"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // المصدر الأساسي للقسم هو الميدان؛ نشتقّه منه عند توفّر domainId.
  let departmentId = data.departmentId;
  if (data.domainId) {
    const domain = await prisma.domain.findUnique({
      where: { id: data.domainId },
      select: { departmentId: true },
    });
    if (!domain)
      throw new NotFoundException(
        tr("notFound.domain"),
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
    departmentId = domain.departmentId;
  }
  if (!departmentId)
    throw new BadRequestException(
      tr("structure.parentRequired"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  return prisma.filiere.create({
    data: {
      name: data.name,
      code: data.code,
      coverUrl: data.coverUrl ?? null,
      departmentId,
      domainId: data.domainId ?? null,
    },
    include: { department: true, domain: true },
  });
};

export const updateFiliereService = async (
  id: string,
  data: UpdateFiliereDTO,
) => {
  const found = await prisma.filiere.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.filiere"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // عند نقل الشعبة إلى ميدان آخر، اشتقّ القسم من الميدان الجديد.
  let departmentId = data.departmentId;
  if (data.domainId) {
    const domain = await prisma.domain.findUnique({
      where: { id: data.domainId },
      select: { departmentId: true },
    });
    if (!domain)
      throw new NotFoundException(
        tr("notFound.domain"),
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
    departmentId = domain.departmentId;
  }

  return prisma.filiere.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
      ...(data.domainId !== undefined ? { domainId: data.domainId } : {}),
      ...(departmentId !== undefined ? { departmentId } : {}),
    },
    include: { department: true, domain: true },
  });
};

export const deleteFiliereService = async (id: string) => {
  const found = await prisma.filiere.findUnique({
    where: { id },
    include: { _count: { select: { specializations: true } } },
  });
  if (!found)
    throw new NotFoundException(
      tr("notFound.filiere"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found._count.specializations > 0)
    throw new BadRequestException(
      tr("structure.deleteBlocked.filiere", { what: tr("count.specializations", { count: found._count.specializations }) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.filiere.delete({ where: { id } });
  return { message: "Filiere deleted" };
};

//
// ════════ SPECIALIZATIONS ════════
//
export const listSpecializationsService = async () => {
  return prisma.specialization.findMany({
    include: {
      filiere: { include: { department: true } },
      _count: { select: { students: true, topics: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const createSpecializationService = async (
  data: CreateSpecializationDTO,
) => {
  return prisma.specialization.create({
    data,
    include: { filiere: { include: { department: true } } },
  });
};

export const updateSpecializationService = async (
  id: string,
  data: UpdateSpecializationDTO,
) => {
  const found = await prisma.specialization.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.specialization"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.specialization.update({
    where: { id },
    data,
    include: { filiere: { include: { department: true } } },
  });
};

export const deleteSpecializationService = async (id: string) => {
  const found = await prisma.specialization.findUnique({
    where: { id },
    include: { _count: { select: { students: true, topics: true } } },
  });
  if (!found)
    throw new NotFoundException(
      tr("notFound.specialization"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  const blockers: string[] = [];
  if (found._count.students > 0) blockers.push(tr("count.students", { count: found._count.students }));
  if (found._count.topics > 0) blockers.push(tr("count.topics", { count: found._count.topics }));
  if (blockers.length)
    throw new BadRequestException(
      tr("structure.deleteBlocked.specialization", { what: listOf(blockers) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.specialization.delete({ where: { id } });
  return { message: "Specialization deleted" };
};

//
// ════════ ACADEMIC YEARS ════════
//
export const listAcademicYearsService = async () => {
  return prisma.academicYear.findMany({ orderBy: { title: "desc" } });
};

export const createAcademicYearService = async (
  data: CreateAcademicYearDTO,
) => {
  const exists = await prisma.academicYear.findUnique({
    where: { title: data.title },
  });
  if (exists)
    throw new BadRequestException(
      tr("year.exists"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // «النشطة واحدة» شرطٌ على الجدول كلّه لا على الصفّ، فلا يُكتب `isActive`
  // من هنا مباشرةً: نُنشئ الصفّ مطفأً ثم نمرّ بنقطة التفعيل الوحيدة.
  const { isActive, ...rest } = data;
  const created = await prisma.academicYear.create({
    data: { ...rest, isActive: false },
  });
  return isActive ? activateAcademicYearService(created.id) : created;
};

export const updateAcademicYearService = async (
  id: string,
  data: UpdateAcademicYearDTO,
) => {
  const found = await prisma.academicYear.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.academicYear"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // وكذلك في التعديل: رفع العلم يمرّ بالتفعيل حتى تُطفأ البقيّة معه. أما
  // خفضه فيبقى كما كان — إطفاء الكلّ ليس خرقاً للشرط، وتحريمه تضييقٌ جديد
  // على واجهةٍ تعمل اليوم.
  const { isActive, ...rest } = data;
  const updated = await prisma.academicYear.update({
    where: { id },
    data: { ...rest, ...(isActive === false ? { isActive: false } : {}) },
  });
  return isActive === true ? activateAcademicYearService(id) : updated;
};

export const activateAcademicYearService = async (id: string) => {
  const found = await prisma.academicYear.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.academicYear"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  // A closed year is a record; it becomes current only by being reopened.
  if (found.archivedAt)
    throw new BadRequestException(
      tr("year.archivedCantActivate", { title: found.title }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.$transaction([
    prisma.academicYear.updateMany({ data: { isActive: false } }),
    prisma.academicYear.update({ where: { id }, data: { isActive: true } }),
  ]);
  return prisma.academicYear.findUnique({ where: { id } });
};

export const deleteAcademicYearService = async (id: string) => {
  const found = await prisma.academicYear.findUnique({
    where: { id },
    include: { _count: { select: { students: true, topics: true } } },
  });
  if (!found)
    throw new NotFoundException(
      tr("notFound.academicYear"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found.isActive)
    throw new BadRequestException(
      tr("year.activeCantDelete"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (found.archivedAt)
    throw new BadRequestException(
      tr("year.archivedCantDelete"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  const blockers: string[] = [];
  if (found._count.students > 0) blockers.push(tr("count.students", { count: found._count.students }));
  if (found._count.topics > 0) blockers.push(tr("count.topics", { count: found._count.topics }));
  if (blockers.length)
    throw new BadRequestException(
      tr("year.deleteBlocked", { what: listOf(blockers) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.academicYear.delete({ where: { id } });
  return { message: "Academic year deleted" };
};

//
// ════════ TOPICS ════════
//
export const listTopicsService = async (q: ListTopicsDTO) => {
  const where = topicListWhere(q);

  const [rows, total] = await Promise.all([
    prisma.graduationTopic.findMany({
      where,
      include: {
        professor: { include: { user: { select: userSelect } } },
        specialization: true,
        academicYear: true,
        // The co-supervisor and the type (core/topic/topic-extras); the summary is a column.
        coSupervisor: topicExtrasSelect.coSupervisor,
        type: topicExtrasSelect.type,
        _count: { select: { groupRequests: { where: COUNTED_ON_CAP } } },
        // الإشغال يأتي مع الصفّ في نفس الاستعلام، فلا استعلام لكل موضوع.
        ...OCCUPANCY_INCLUDE,
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.graduationTopic.count({ where }),
  ]);

  // كل صفّ يحمل حكم الخادم على ما يجوز عليه ولماذا لا. القائمة كانت تستنتج
  // ذلك بنفسها من `status` وحده، فتعرض حذفاً مستحيلاً على موضوع مؤرشف له
  // مجموعة، وتُخفي حذفاً جائزاً عن غيره.
  const items = rows.map(({ projectGroup, groupRequests, ...t }) => {
    const occ = occupancyFromRelations({ projectGroup, groupRequests });
    return {
      ...t,
      occupancy: {
        hasGroup: occ.hasGroup,
        groupMemberCount: occ.groupMemberCount,
        hasPendingRequest: occ.hasPendingRequest,
        pendingRequestMemberCount: occ.pendingRequestMemberCount,
        hasAcceptedRequest: occ.hasAcceptedRequest,
      },
      actions: topicActions(t, occ),
    };
  });

  return { items, total, page: q.page, limit: q.limit };
};

/**
 * The list of memoir titles for a scope, grouped by specialization — what the
 * department prints and posts: the specialization's chain heads each page.
 *
 * "before" is the catalogue of validated proposals (approved, published, or
 * already taken — a proposal stays on it once chosen); "after" is the memoirs
 * that have students, with their names, leader first. Rows run by supervisor,
 * then title, so a professor's memoirs read together.
 *
 * Each row carries what the department's official list prints beside the
 * title: the co-supervisor, the short description (or, without one, the
 * opening of the full one), and the type — its code numbers the rows (AI01…)
 * and its colour marks them. The faculty and department carry their Latin
 * names, for a list printed in English or French.
 */
export const topicTitlesListService = async (q: TopicTitlesListDTO) => {
  const where: Prisma.GraduationTopicWhereInput = {};
  if (q.academicYearId) where.academicYearId = q.academicYearId;
  if (q.professorId) where.professorId = q.professorId;
  const spec: Prisma.SpecializationWhereInput = {};
  if (q.specializationId) where.specializationId = q.specializationId;
  else if (q.filiereId) spec.filiereId = q.filiereId;
  else if (q.departmentId) spec.filiere = { departmentId: q.departmentId };
  else if (q.facultyId) spec.filiere = { department: { facultyId: q.facultyId } };
  // One level at a time when asked: a licence list and a master's are two lists.
  if (q.level) spec.level = q.level;
  if (Object.keys(spec).length) where.specialization = spec;
  if (q.mode === "after") where.projectGroup = { members: { some: {} } };
  else where.status = { in: ["approved", "open", "full"] };

  const person = { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } as const;
  const [rows, year] = await Promise.all([
    prisma.graduationTopic.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        maxStudents: true,
        summary: true,
        description: true,
        professor: { select: { id: true, grade: true, universityEmail: true, user: { select: person } } },
        coSupervisor: { select: { id: true, grade: true, universityEmail: true, user: { select: person } } },
        type: { select: { id: true, name: true, code: true, color: true, sortOrder: true } },
        specialization: {
          select: {
            id: true,
            name: true,
            level: true,
            filiere: {
              select: {
                id: true,
                name: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                    nameLatin: true,
                    // Its logo heads the list beside the university's.
                    faculty: { select: { id: true, name: true, nameLatin: true, iconUrl: true } },
                  },
                },
              },
            },
          },
        },
        projectGroup: {
          select: {
            members: {
              orderBy: [{ isLeader: "desc" }, { createdAt: "asc" }],
              select: { isLeader: true, student: { select: { registrationNumber: true, user: { select: person } } } },
            },
          },
        },
      },
    }),
    q.academicYearId
      ? prisma.academicYear.findUnique({ where: { id: q.academicYearId }, select: { id: true, title: true } })
      : Promise.resolve(null),
  ]);

  // By name — the Latin one for a professor without an Arabic name, so each one's topics still read together.
  type Person = { lastName: string | null; firstName: string | null; lastNameLatin: string | null; firstNameLatin: string | null };
  const key = (u?: Person | null) =>
    `${u?.lastName || u?.lastNameLatin || ""} ${u?.firstName || u?.firstNameLatin || ""}`;
  type Named = { id: string; name: string; nameLatin: string | null };
  const groups = new Map<string, { specialization: { id: string; name: string; level: string }; filiere: { id: string; name: string } | null; department: Named | null; faculty: Named | null; rows: unknown[] }>();
  const sorted = [...rows].sort(
    (a, b) =>
      a.specialization.name.localeCompare(b.specialization.name, "ar") ||
      key(a.professor.user).localeCompare(key(b.professor.user), "ar") ||
      a.title.localeCompare(b.title, "ar"),
  );
  for (const t of sorted) {
    const s = t.specialization;
    // التخصص في شعبة، والشعبة في قسم، والقسم في كلية — علاقاتٌ إلزامية.
    const dept = s.filiere.department;
    if (!groups.has(s.id))
      groups.set(s.id, {
        specialization: { id: s.id, name: s.name, level: s.level },
        filiere: { id: s.filiere.id, name: s.filiere.name },
        department: { id: dept.id, name: dept.name, nameLatin: dept.nameLatin },
        faculty: dept.faculty,
        rows: [],
      });
    groups.get(s.id)!.rows.push({
      id: t.id,
      title: t.title,
      status: t.status,
      maxStudents: t.maxStudents,
      supervisor: { id: t.professor.id, grade: t.professor.grade, ...t.professor.user, email: t.professor.universityEmail },
      coSupervisor: t.coSupervisor && {
        id: t.coSupervisor.id,
        grade: t.coSupervisor.grade,
        ...t.coSupervisor.user,
        email: t.coSupervisor.universityEmail,
      },
      summary: t.summary,
      // Without a short description, the list may print the full one's opening.
      excerpt: t.summary ? null : excerptOf(t.description),
      type: t.type,
      students: (t.projectGroup?.members ?? []).map((m) => ({
        registrationNumber: m.student.registrationNumber,
        isLeader: m.isLeader,
        ...m.student.user,
      })),
    });
  }

  return { mode: q.mode, year, groups: [...groups.values()] };
};

/** The opening of a description, to the last whole word within 300 characters. */
const excerptOf = (text: string | null | undefined, max = 300) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat || null;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max / 2 ? cut.lastIndexOf(" ") : cut.length)}…`;
};

export const getTopicByIdService = async (id: string) => {
  const topic = await prisma.graduationTopic.findUnique({
    where: { id },
    include: {
      professor: { include: { user: { select: userSelect } } },
      specialization: true,
      academicYear: true,
      // The co-supervisor and the type (core/topic/topic-extras); the summary is a column.
      coSupervisor: topicExtrasSelect.coSupervisor,
      type: topicExtrasSelect.type,
      // `projectGroup: true` returned the group row and nothing else, so the
      // detail page could not name the students it was reporting a count of.
      projectGroup: {
        include: {
          members: {
            orderBy: { isLeader: "desc" },
            include: { student: { include: { user: { select: userSelect } } } },
          },
        },
      },
      // الطلباتُ المعلّقة — عليها يُقاس سقفُ الطلبات على الصفحة.
      _count: { select: { groupRequests: { where: COUNTED_ON_CAP } } },
      // A pending request now blocks publishing, rejecting and archiving, so
      // the page has to show what it is being blocked by. Without this the
      // screen said "no group has formed yet", offered three buttons, and all
      // three failed — with no way to see that a team was waiting.
      //
      // ولا يُوسَّع هذا المرشِّح ليشمل المرفوضة: الصفحة تحسب منه «الموضوع
      // محجوز» وتُطفئ أزرار النشر والرفض والأرشفة. محاولةٌ رُفضت قبل شهر
      // كانت ستُطفئها جميعاً. والمرفوضةُ تأتي في `pastRequests` منفصلةً.
      // وعدّة فرقٍ قد تنتظر معاً، بترتيب وصولها: الأسبقُ أوّلاً.
      groupRequests: {
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        include: {
          leader: { select: { id: true, registrationNumber: true } },
          members: {
            include: {
              student: {
                select: {
                  id: true,
                  registrationNumber: true,
                  user: { select: userSelect },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!topic)
    throw new NotFoundException(
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // نفس حكم القائمة على صفحة التفصيل، من نفس الجدول. الصفحة كانت تعرض زرّ
  // الحذف بلا أي شرط، فيفشل ولا يعرف المستخدم أن البديل هو الأرشفة.
  const occ = await readOccupancy(prisma, id);

  /*
   * المحاولاتُ السابقة — للقراءة لا للقرار.
   *
   * صارت تُحفظ يوم كفّ الرفضُ عن الحذف: مَن تقدّم إلى هذا الموضوع قبلُ،
   * ولماذا رُدّ — أو أنّه أُلغي لأنّ فريقاً آخر اختير.
   */
  const pastRequests = await prisma.groupRequest.findMany({
    where: { topicId: id, status: "rejected" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
      leader: { select: { id: true, registrationNumber: true } },
      members: {
        select: {
          id: true,
          student: {
            select: {
              id: true,
              registrationNumber: true,
              user: { select: userSelect },
            },
          },
        },
      },
    },
  });

  return {
    ...topic,
    pastRequests,
    occupancy: {
      hasGroup: occ.hasGroup,
      groupMemberCount: occ.groupMemberCount,
      hasPendingRequest: !!occ.pendingRequestId,
      pendingRequestMemberCount: occ.pendingRequestMemberCount,
      pendingRequestCount: occ.pendingRequestCount,
      hasAcceptedRequest: !!occ.acceptedRequestId,
    },
    actions: topicActions(topic, occ),
  };
};

/**
 * Refuses to move a topic while a team is still waiting on it.
 *
 * A pending request holds a real claim: the team is waiting for an answer on
 * this topic. Publishing it would put a topic under a professor's proposal on
 * the students' list; rejecting or archiving it strands the teams' requests
 * on a topic that no longer exists as an option — pending forever.
 *
 * The request is decided first, on the screen built for it. Rejecting a
 * request deletes it and frees the topic, so this is never a dead end.
 *
 * Only `pending` is checked. An `accepted` request always sits on a `full`
 * topic — accepting creates the group and sets `full` in one transaction —
 * and the status rules already say what may happen to a `full` topic, which
 * includes archiving it. Checking `accepted` here would forbid that.
 */
/**
 * يمنع الإجراء إن كان جدول القواعد يمنعه، برسالة الجدول نفسها.
 *
 * كان كل إجراء يحمل حارسه الخاصّ — قائمة حالات مسموحة هنا، وفحص طلب حيّ
 * هناك — والواجهة تُقلّد هذه القواعد بشرطٍ ثالث عندها. ثلاث نسخ تتباعد عند
 * أول تعديل. الحارس والعرض يقرآن الآن من `topicActions` وحدها.
 */
const gateTopicAction = async (id: string, action: TopicActionKey) => {
  const topic = await prisma.graduationTopic.findUnique({ where: { id } });
  if (!topic)
    throw new NotFoundException(
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const occ = await readOccupancy(prisma, id);
  const actions = topicActions(topic, occ);
  const allowed = {
    approve: actions.canApprove,
    reject: actions.canReject,
    publish: actions.canPublish,
    unpublish: actions.canUnpublish,
    archive: actions.canArchive,
    unarchive: actions.canUnarchive,
    delete: actions.canDelete,
    assignGroup: actions.canAssignGroup,
  }[action];

  if (!allowed)
    throw new BadRequestException(
      actions.blockedReasons[action]!, // كلّ إجراءٍ ممنوع يُسجَّل سببه معه
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  return topic;
};

/** يسجّل القرار بعد أن يتأكّد أنه جائز. */
const setTopicStatus = async (
  id: string,
  action: TopicActionKey,
  decision: TopicDecision,
  rejectionReason?: string | null,
) => {
  await gateTopicAction(id, action);
  await setTopicDecision(prisma, id, decision, { rejectionReason });
  return prisma.graduationTopic.findUniqueOrThrow({ where: { id } });
};

export const approveTopicService = async (id: string) => {
  // Approval is a decision on a proposal, so it starts from an undecided one.
  const topic = await setTopicStatus(id, "approve", "approved");
  const userId = await getTopicProfessorUserId(topic.id);
  await createNotification({
    userId,
    type: "topic_approved",
    title: { key: "notif.topicApproved.title" },
    message: { key: "notif.topicApproved.message", params: { title: topic.title } },
    link: "/professor/topics",
  });
  return topic;
};

/**
 * Archiving takes a *decided* topic out of circulation.
 *
 * A `pending` or `rejected` topic is refused because unarchiving cannot know
 * where it came from: it restores `full` when a group exists and `approved`
 * otherwise, so an unreviewed proposal would return approved — approved
 * without anyone having read it. Those are decided by approving or rejecting
 * them, not by filing them away.
 *
 * One consequence is deliberate: an archived `open` topic comes back
 * `approved`, not published. That is the safe direction — it must be
 * published again on purpose.
 */
export const archiveTopicService = async (id: string) =>
  setTopicStatus(id, "archive", "archived");

/**
 * Brings an archived topic back.
 *
 * This used to guess where the topic had come from — `full` when a group
 * existed, `approved` otherwise — which silently unpublished every archived
 * topic that had been open. It no longer guesses: archiving never cleared
 * `publishedAt`, so projecting the "approved" decision over it restores the
 * exact state the topic was filed away in.
 */
export const unarchiveTopicService = async (id: string) => {
  await gateTopicAction(id, "unarchive");
  await setTopicDecision(prisma, id, "approved");
  return prisma.graduationTopic.findUniqueOrThrow({ where: { id } });
};

/**
 * يحذف موضوعاً لا يُفقِد حذفُه شيئاً.
 *
 * الحارس على المجموعة كان قائماً، لكن الطلب الحيّ لم يكن محروساً: كان الحذف
 * يمسح `groupRequest`s جملةً — بما فيها طلب فريقٍ ينتظر قراراً — فيختفي الطلب
 * من صفحة الطلبة بلا رفض ولا سبب ولا إشعار. `topicActions` يمنع الحالتين
 * الآن، ويقول أيّهما.
 *
 * ويبقى الحذف يمسح الطلبات المرفوضة والتطبيقات القديمة: تلك سجلّات ميّتة على
 * موضوع لم يعد له وجود، ولا شاشة تعرضها بعد أن يذهب.
 */
export const deleteTopicService = async (id: string) => {
  await gateTopicAction(id, "delete");

  await prisma.$transaction(async (tx) => {
    // التطبيقات الفردية (لا cascade على علاقة الموضوع).
    await tx.topicApplication.deleteMany({ where: { topicId: id } });
    // طلبات الفرق المنتهية (أعضاؤها يُحذفون بالـ cascade على GroupRequestMember).
    await tx.groupRequest.deleteMany({ where: { topicId: id } });
    // وأخيراً الموضوع نفسه.
    await tx.graduationTopic.delete({ where: { id } });
  });

  return { message: "Topic deleted" };
};

export const rejectTopicService = async (id: string, data: RejectTopicDTO) => {
  // `full` is excluded by the rules table on purpose: a project has formed on
  // it, with members, milestones and possibly a defence. Rejecting the topic
  // would not undo any of that — it would only mislabel it. Archive it instead.
  const topic = await setTopicStatus(id, "reject", "rejected", data.reason);
  const userId = await getTopicProfessorUserId(topic.id);
  await createNotification({
    userId,
    type: "topic_rejected",
    title: { key: "notif.topicRejected.title" },
    message: data.reason
      ? { key: "notif.topicRejected.messageReason", params: { title: topic.title, reason: data.reason } }
      : { key: "notif.topicRejected.message", params: { title: topic.title } },
    link: "/professor/topics",
  });
  return topic;
};

// ─── PUBLISH / UNPUBLISH (two-stage admin flow) ───────────────
// approve = initial acceptance (quality OK) but NOT visible publicly.
// publish = move approved → open, which makes it appear on the public
// landing page and opens it for student requests.
export const publishTopicService = async (id: string) => {
  // The rules table refuses anything but `approved`, and refuses a topic a
  // team has already claimed — publishing that offers students something none
  // of them can take, since the reservation turns down every further request.
  await gateTopicAction(id, "publish");
  // `publishedAt` is what survives `full` and `archived`, so the topic can
  // come back to "published" later instead of to a guess.
  await setTopicPublished(prisma, id, true);
  return prisma.graduationTopic.findUniqueOrThrow({ where: { id } });
};

// Pull a published topic back to approved-but-hidden (only if no group has
// formed yet, i.e. it's still "open", not "full").
export const unpublishTopicService = async (id: string) => {
  await gateTopicAction(id, "unpublish");
  await setTopicPublished(prisma, id, false);
  return prisma.graduationTopic.findUniqueOrThrow({ where: { id } });
};

//
// ════════ APPLICATIONS ════════
//

// ─── ACCEPT APPLICATION (admin decision) ──────────────────────

// ─── REJECT APPLICATION (admin decision) ──────────────────────

//
// ════════ PROJECTS (groups) ════════
//
export const listProjectsService = async (q: ListProjectsDTO) => {
  // Filters are combined with AND: each one narrows what the others left.
  const and: Record<string, unknown>[] = [];

  if (q.search) {
    const term = q.search;
    const byName = nameSearchFilter(term, (f) => ({ user: f }));
    and.push({
      OR: [
        { topic: { title: { contains: term } } },
        {
          members: {
            some: {
              student: {
                OR: [
                  ...(byName ? [byName] : []),
                  { registrationNumber: { contains: term } },
                ],
              },
            },
          },
        },
      ],
    });
  }

  if (q.professorId) and.push({ topic: { professorId: q.professorId } });
  if (q.academicYearId)
    and.push({ topic: { academicYearId: q.academicYearId } });

  // Most specific wins, matching the other list endpoints.
  if (q.specializationId) {
    and.push({ topic: { specializationId: q.specializationId } });
  } else if (q.filiereId) {
    and.push({ topic: { specialization: { filiereId: q.filiereId } } });
  } else if (q.departmentId) {
    and.push({
      topic: { specialization: { filiere: { departmentId: q.departmentId } } },
    });
  } else if (q.facultyId) {
    and.push({
      topic: {
        specialization: { filiere: { department: { facultyId: q.facultyId } } },
      },
    });
  }

  if (q.defense === "none") and.push({ defense: { is: null } });
  else if (q.defense) and.push({ defense: { status: q.defense } });

  // «متأخرة» بعلامتها أو بتاريخها — كما يعدّها فضاءا الأستاذ والطالب. كانت هذه
  // الصفحة تعدّ العلامة وحدها، فمرحلةٌ فات موعدها ولم يحدّثها أحد لم تكن
  // تظهر متأخرةً إلا للإدارة… أي لا تظهر للجهة الوحيدة التي تتابع الجميع.
  const lateMilestone = {
    status: { not: "completed" as const },
    OR: [{ status: "overdue" as const }, { deadline: { lt: new Date() } }],
  };
  if (q.health === "late") and.push({ milestones: { some: lateMilestone } });
  else if (q.health === "noPlan") and.push({ milestones: { none: {} } });

  const where = and.length > 0 ? { AND: and } : {};

  // "Defence soonest" has to put groups that have one first; Prisma sorts
  // nulls last on a descending relation order, so ascending date with the
  // relation is the closest honest ordering.
  const orderBy =
    q.sort === "oldest"
      ? ({ createdAt: "asc" } as const)
      : q.sort === "defenseSoon"
        ? ({ defense: { date: "asc" } } as const)
        : q.sort === "title"
          ? ({ topic: { title: "asc" } } as const)
          : ({ createdAt: "desc" } as const);

  /** The active filter plus one more condition, for the summary counts. */
  const narrowed = (extra: Record<string, unknown>) => ({
    AND: [...and, extra],
  });

  // The summary is computed over the *filtered* set, not the whole table, so
  // the tiles always describe the grid underneath them. They are counts, not
  // a second page of rows, so they cost four cheap aggregates.
  const [
    items,
    total,
    defenseScheduled,
    defenseDone,
    noDefense,
    withOverdue,
    noPlan,
  ] = await Promise.all([
      prisma.projectGroup.findMany({
        where,
        include: {
          topic: {
            include: {
              professor: { include: { user: { select: userSelect } } },
              // Neither of these was fetched before, so the card could not show
              // — or filter by — where the project sits academically.
              specialization: true,
              academicYear: true,
            },
          },
          // المسؤول أوّلاً: هو من تبدأ به البطاقة صفّ الوجوه.
          members: {
            orderBy: { isLeader: "desc" },
            include: { student: { include: { user: { select: userSelect } } } },
          },
          _count: { select: { milestones: true } },
          defense: { include: { _count: { select: { committee: true } } } },
        },
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.projectGroup.count({ where }),
      prisma.projectGroup.count({
        where: narrowed({ defense: { status: "scheduled" } }),
      }),
      prisma.projectGroup.count({
        where: narrowed({ defense: { status: "completed" } }),
      }),
      prisma.projectGroup.count({ where: narrowed({ defense: { is: null } }) }),
      prisma.projectGroup.count({
        where: narrowed({ milestones: { some: lateMilestone } }),
      }),
      prisma.projectGroup.count({
        where: narrowed({ milestones: { none: {} } }),
      }),
    ]);

  // Progress is the point of this page, and a bare milestone count cannot
  // express it. One query covers the whole page rather than one per project,
  // and carries what the card needs beyond the ratio: the next deadline, the
  // work handed in, and when the team last showed a sign of life.
  const ids = items.map((p) => p.id);
  const now = new Date();
  const plan = ids.length
    ? await prisma.milestone.findMany({
        where: { groupId: { in: ids } },
        select: {
          groupId: true,
          title: true,
          status: true,
          deadline: true,
          _count: { select: { submissions: true } },
          submissions: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { deadline: "asc" },
      })
    : [];

  type Progress = {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    submissions: number;
    nextDeadline: { title: string; deadline: Date } | null;
    lastActivityAt: Date | null;
  };
  const progressByGroup = new Map<string, Progress>();
  const blank = (): Progress => ({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    submissions: 0,
    nextDeadline: null,
    lastActivityAt: null,
  });
  for (const id of ids) progressByGroup.set(id, blank());

  for (const m of plan) {
    const acc = progressByGroup.get(m.groupId)!; // مراحل مجموعات هذه الصفحة وحدها
    acc.total += 1;
    if (m.status === "completed") acc.completed += 1;
    else if (m.status === "overdue" || m.deadline < now) acc.overdue += 1;
    else if (m.status === "in_progress") acc.inProgress += 1;
    // Ordered by deadline, so the first open one ahead of today is the next.
    if (m.status !== "completed" && m.deadline >= now && !acc.nextDeadline)
      acc.nextDeadline = { title: m.title, deadline: m.deadline };
    acc.submissions += m._count.submissions;
    const last = m.submissions[0]?.createdAt;
    if (last && (!acc.lastActivityAt || last > acc.lastActivityAt))
      acc.lastActivityAt = last;
  }

  return {
    items: items.map((p) => ({
      ...p,
      progress: progressByGroup.get(p.id)!,
    })),
    total,
    stats: {
      total,
      defenseScheduled,
      defenseDone,
      noDefense,
      withOverdue,
      noPlan,
    },
    page: q.page,
    limit: q.limit,
  };
};

export const getProjectByIdService = async (id: string) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id },
    include: {
      topic: {
        include: {
          professor: {
            include: {
              user: { select: userSelect },
              department: { select: { id: true, name: true } },
            },
          },
          specialization: {
            include: {
              filiere: {
                include: { department: { include: { faculty: true } } },
              },
            },
          },
          // Missing before, so the detail view could not say which year the
          // project belongs to.
          academicYear: true,
        },
      },
      members: {
        orderBy: { isLeader: "desc" },
        include: {
          student: {
            include: {
              user: { select: userSelect },
              // Where each member sits academically. Nothing enforces that a
              // group's members share the topic's specialization, so showing
              // it per person is the only way a mismatch becomes visible.
              specialization: {
                include: {
                  filiere: {
                    include: { department: { include: { faculty: true } } },
                  },
                },
              },
              academicYear: true,
            },
          },
        },
      },
      milestones: {
        orderBy: { order: "asc" },
        // The latest files of each milestone travel with it, so the page can
        // show — and open — what the team handed in without a second trip.
        // The count stays the true total when a milestone has more.
        include: {
          _count: { select: { submissions: true } },
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: submissionSelect,
          },
        },
      },
      defense: {
        // The jury: previously the defence came back without it, so the page
        // could announce a date but never who would be sitting on it.
        include: {
          committee: {
            include: {
              professor: { include: { user: { select: userSelect } } },
            },
          },
        },
      },
    },
  });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const submissions = group.milestones.reduce(
    (n, m) => n + m._count.submissions,
    0,
  );
  const lastSubmissionAt =
    group.milestones
      .flatMap((m) => m.submissions.map((x) => x.createdAt))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  // How the group came to be: a team request the administration accepted, or
  // an assignment made directly. The page says which, and since when.
  const origin = await prisma.groupRequest.findFirst({
    where: { topicId: group.topicId, status: "accepted" },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  // The same guard the dissolve endpoint applies, said up front — so the
  // button can explain itself instead of failing on click.
  const dissolveBlockers = {
    submissions,
    defense: !!group.defense,
  };

  return {
    ...group,
    insights: {
      submissions,
      lastSubmissionAt,
      origin: origin
        ? { kind: "request" as const, requestId: origin.id, since: origin.updatedAt }
        : { kind: "assignment" as const, requestId: null, since: group.createdAt },
    },
    actions: {
      canDissolve: submissions === 0 && !group.defense,
      dissolveBlockers,
    },
  };
};

export const changeSupervisorService = async (
  id: string,
  data: ChangeSupervisorDTO,
) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id },
    include: { topic: true },
  });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const prof = await prisma.professor.findUnique({
    where: { id: data.professorId },
  });
  if (!prof)
    throw new NotFoundException(
      tr("notFound.professor"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (group.topic.professorId === data.professorId)
    throw new BadRequestException(
      tr("project.sameSupervisor"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const previous = await prisma.professor.findUnique({
    where: { id: group.topic.professorId },
    select: { userId: true },
  });

  await prisma.graduationTopic.update({
    where: { id: group.topicId },
    data: { professorId: data.professorId },
  });

  // Both ends of the handover learn of it: one gains a team, the other loses
  // one from their space without having done anything.
  try {
    await createNotifications([
      {
        userId: prof.userId,
        type: "general",
        title: { key: "notif.supervisionAssigned.title" },
        message: { key: "notif.supervisionAssigned.message", params: { title: group.topic.title } },
        link: `/professor/groups/${id}`,
      },
      // المشرف السابق موجود (الموضوع لا يخلو من أستاذ)، وغير الجديد — رُدّ «المشرف نفسه» أعلاه.
      {
        userId: previous!.userId,
        type: "general",
        title: { key: "notif.supervisionMoved.title" },
        message: { key: "notif.supervisionMoved.message", params: { title: group.topic.title } },
        link: "/professor/groups",
      },
    ]);
  } catch {
    // A notification must never fail the write it is reporting.
  }

  return getProjectByIdService(id);
};

export const assignStudentService = async (
  id: string,
  data: AssignStudentDTO,
) => {
  const group = await prisma.projectGroup.findUnique({ where: { id } });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
  });
  if (!student)
    throw new NotFoundException(
      tr("notFound.student"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const existing = await prisma.projectMember.findUnique({
    where: { groupId_studentId: { groupId: id, studentId: data.studentId } },
  });
  if (existing)
    throw new BadRequestException(
      tr("project.studentAlreadyIn"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // طالب واحد لمشروع واحد — نفس القاعدة التي يفرضها مسار الإسناد.
  const elsewhere = await prisma.projectMember.findFirst({
    where: { studentId: data.studentId, groupId: { not: id } },
  });
  if (elsewhere)
    throw new BadRequestException(
      tr("project.studentInOther"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // والحدّ الأقصى للموضوع يُحترم هنا كما يُحترم عند قبول الطلب.
  const [count, topic] = await Promise.all([
    prisma.projectMember.count({ where: { groupId: id } }),
    prisma.graduationTopic.findUnique({
      where: { id: group.topicId },
      select: { maxStudents: true },
    }),
  ]);
  if (topic && count >= topic.maxStudents)
    throw new BadRequestException(
      tr("project.full", { max: topic.maxStudents }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.projectMember.create({
    data: {
      groupId: id,
      studentId: data.studentId,
      // أوّل عضو في مجموعة بلا قائد يصير قائدها؛ وإلا فعضو عادي.
      isLeader: count === 0,
    },
  });

  // الطالب يجد مشروعاً في فضائه لم يطلبه — فليعرف من أين جاء.
  try {
    const topicTitle = (
      await prisma.graduationTopic.findUniqueOrThrow({
        where: { id: group.topicId },
        select: { title: true },
      })
    ).title;
    await createNotification({
      userId: student.userId,
      type: "general",
      title: { key: "notif.addedToProject.title" },
      message: { key: "notif.addedToProject.message", params: { title: topicTitle } },
      link: "/student/project",
    });
  } catch {
    // A notification must never fail the write it is reporting.
  }

  return getProjectByIdService(id);
};

/**
 * يعيّن قائد المشروع — وهو الإجراء الذي لم يكن موجوداً.
 *
 * تصحيح المرسِل كان ممكناً على الطلب وحده وقبل القبول فقط، فإذا تشكّلت
 * المجموعة أُغلق البابان: `setGroupRequestLeaderService` يرفض بعد القبول، ولا
 * نظير له على المشروع. وهذا يعمل على أي مجموعة مهما تشكّلت — من طلب فريق أو
 * بإسناد إداري — لأن القائد صفة المجموعة القائمة لا صفة الطلب الذي مضى.
 */
export const setProjectLeaderService = async (
  groupId: string,
  studentId: string,
) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: { members: { select: { studentId: true } } },
  });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (!group.members.some((m) => m.studentId === studentId))
    throw new BadRequestException(
      tr("project.leaderMustBeMember"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // في معاملة واحدة، وإلا مرّت لحظة بقائدين أو بلا قائد.
  await prisma.$transaction(async (tx) => {
    await tx.projectMember.updateMany({
      where: { groupId },
      data: { isLeader: false },
    });
    await tx.projectMember.update({
      where: { groupId_studentId: { groupId, studentId } },
      data: { isLeader: true },
    });
  });

  return getProjectByIdService(groupId);
};

/**
 * ينهي الطلب المقبول الذي أنشأ المجموعة، ثم يُعيد حساب حالة الموضوع.
 *
 * المجموعة والطلب الذي أنشأها واقعة واحدة مسجَّلة مرّتين: المجموعة تحمل
 * الطلبة، والطلب المقبول يحجز الموضوع. وحذف المجموعة دون إنهاء الطلب كان
 * يترك الحجز قائماً فوق لا شيء: الموضوع يقول «معتمد» وهو محجوب عن كل طالب،
 * ويرفض كل فريق جديد، ولا شاشة تستطيع تحريره.
 *
 * يُعلَّم الطلب `rejected` لا يُحذف: هذا ما يُفرِج عن الموضوع، ويُبقي للفريق
 * أثر ما طلبوه وما آل إليه. والسبب المسجَّل يقول إن المجموعة فُسخت، فلا
 * تُقرأ «مرفوض» على أنها ردّ على طلبهم.
 */
const releaseTopicOccupancy = async (
  tx: Prisma.TransactionClient,
  topicId: string,
  reason: string,
) => {
  await tx.groupRequest.updateMany({
    where: { topicId, status: "accepted" },
    data: {
      status: "rejected",
      rejectionReason: reason,
    },
  });
  return computeTopicStatus(tx, topicId);
};

export const removeProjectMemberService = async (
  groupId: string,
  studentId: string,
) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        select: { studentId: true, isLeader: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  const target = group.members.find((m) => m.studentId === studentId);
  if (!target)
    throw new BadRequestException(
      tr("project.notMember"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const remaining = group.members.length - 1;

  /**
   * إزالة آخر عضو ليست إزالة عضو، بل فسخٌ للمشروع كلّه.
   *
   * كانت تفعل ذلك ضمناً: تُحذف المجموعة ومراحلها ومناقشتها لأن الإدارة ضغطت
   * «إزالة» على اسم طالب — بلا سؤال، وبلا سبب مسجَّل، وبلا إشعار لأحد. الفسخ
   * الآن إجراء قائم بذاته، محروسٌ بما يمنع ضياع عمل قائم، ويُطلب بالاسم.
   */
  if (remaining === 0)
    throw new BadRequestException(
      tr("project.lastMember"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.delete({
      where: { groupId_studentId: { groupId, studentId } },
    });

    // إخراج القائد يترك المجموعة بلا قائد، وهي حالة لا تعرف الشاشة كيف تعرضها
    // ولا الخادم من يخاطب. أقدم الباقين يخلفه، والإدارة تغيّره بعدها إن شاءت.
    if (target.isLeader) {
      // يبقى عضوٌ واحدٌ على الأقلّ — رُدّت إزالة الأخير أعلاه.
      const heir = group.members.find((m) => m.studentId !== studentId)!;
      await tx.projectMember.update({
        where: { groupId_studentId: { groupId, studentId: heir.studentId } },
        data: { isLeader: true },
      });
    }
  });

  // مشروعه اختفى من صفحته؛ فلا يصحّ أن يختفي بلا خبر.
  try {
    const [who, topic] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { userId: true },
      }),
      prisma.graduationTopic.findUnique({
        where: { id: group.topicId },
        select: { title: true },
      }),
    ]);
    // خرجت عضويته وحدها: الطالب والموضوع باقيان.
    await createNotification({
      userId: who!.userId,
      type: "general",
      title: { key: "notif.removedFromProject.title" },
      message: { key: "notif.removedFromProject.message", params: { title: topic!.title } },
      link: "/student/requests",
    });
  } catch {
    // A notification must never fail the write it is reporting.
  }

  return {
    remaining,
    dissolved: false,
    topicId: group.topicId,
    leaderChanged: target.isLeader,
  };
};

/**
 * يفسخ مشروعاً قائماً: يحذف المجموعة، ويحرّر الموضوع، ويُعلم الطلبة.
 *
 * هذا هو الباب الوحيد للتراجع عن اكتمال وقع بالخطأ. وهو مُحكَم عمداً: يرفض
 * الفسخ إن كان للمجموعة تسليمات أو مناقشة، لأن تلك أعمال طلبة وقرارات لجان
 * لا يصحّ أن تختفي في إجراء واحد. إزالتها تسبق الفسخ وتُطلب من شاشاتها، فلا
 * يقع الفقدان سهواً في نقرة واحدة.
 *
 * أمّا المراحل بلا تسليمات فهي خطّة لا عمل، وتُحذف مع المجموعة، ويُبلَّغ
 * عددها في الردّ حتى لا يختفي شيء بلا ذكر.
 */
export const dissolveProjectService = async (
  groupId: string,
  data: DissolveProjectDTO = {},
) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { select: { studentId: true } },
      topic: { select: { id: true, title: true } },
      defense: { select: { id: true } },
      milestones: { select: { id: true } },
    },
  });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const submissions = await prisma.submission.count({
    where: { milestone: { groupId } },
  });

  const blockers: string[] = [];
  if (submissions > 0) blockers.push(tr("count.submissions", { count: submissions }));
  if (group.defense) blockers.push(tr("project.scheduledDefense"));
  if (blockers.length)
    throw new BadRequestException(
      tr("project.dissolveBlocked", { what: listOf(blockers) }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const reason = data.reason?.trim()
    ? data.reason.trim()
    : "فسخت الإدارة المذكرة.";

  await prisma.$transaction(async (tx) => {
    await tx.milestone.deleteMany({ where: { groupId } });
    await tx.projectMember.deleteMany({ where: { groupId } });
    await tx.projectGroup.delete({ where: { id: groupId } });
    await releaseTopicOccupancy(tx, group.topic.id, reason);
  });

  // أعلِم كل عضو — المشروع اختفى من صفحته، فلا يصحّ أن يختفي بلا خبر.
  const memberUserIds = (
    await prisma.student.findMany({
      where: { id: { in: group.members.map((m) => m.studentId) } },
      select: { userId: true },
    })
  ).map((s) => s.userId);
  for (const userId of memberUserIds) {
    await createNotification({
      userId,
      type: "general",
      title: { key: "notif.groupDissolved.title" },
      message: data.reason?.trim()
        ? { key: "notif.groupDissolved.messageReason", params: { title: group.topic.title, reason } }
        : { key: "notif.groupDissolved.message", params: { title: group.topic.title } },
      link: "/student/requests",
    });
  }

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: group.topic.id },
    select: { id: true, status: true },
  });

  return {
    dissolved: true,
    topicId: group.topic.id,
    topicStatus: topic?.status,
    removedMembers: group.members.length,
    removedMilestones: group.milestones.length,
  };
};

//
// ════════ MILESTONES (read-only) ════════
//
/** Loads a group or fails; the admin scope is every group, unlike the
 *  professor endpoints which are limited to the ones they supervise. */
const requireGroup = async (groupId: string) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
  });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return group;
};

export const listGroupMilestonesService = async (
  groupId: string,
  q: ListMilestonesDTO,
) => {
  await requireGroup(groupId);

  const where: Record<string, unknown> = { groupId };
  if (q.status) where.status = q.status;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search } },
      { description: { contains: q.search } },
    ];
  }

  return prisma.milestone.findMany({
    where,
    orderBy: { order: "asc" },
    include: {
      _count: { select: { submissions: true } },
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: submissionSelect,
      },
    },
  });
};

export const createGroupMilestoneService = async (
  groupId: string,
  data: AdminCreateMilestoneDTO,
) => {
  await requireGroup(groupId);

  // Order is a position in a list, so leaving it to the caller invites two
  // milestones claiming the same slot. When omitted it continues the group's
  // own sequence.
  let order = data.order;
  if (order === undefined) {
    const last = await prisma.milestone.findFirst({
      where: { groupId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = (last?.order ?? 0) + 1;
  }

  const milestone = await prisma.milestone.create({
    data: {
      title: data.title,
      description: data.description,
      deadline: data.deadline,
      order,
      groupId,
      status: data.status ?? "pending",
    },
  });

  // The supervisor owns this timeline too; they should not discover a change
  // to it by accident.
  await notifySupervisorOfMilestone(groupId, "notif.milestoneAdded.title");

  return milestone;
};

export const updateGroupMilestoneService = async (
  id: string,
  data: AdminUpdateMilestoneDTO,
) => {
  const existing = await prisma.milestone.findUnique({ where: { id } });
  if (!existing)
    throw new NotFoundException(
      tr("notFound.milestone"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const milestone = await prisma.milestone.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  await notifySupervisorOfMilestone(
    existing.groupId,
    "notif.milestoneUpdated.title",
  );

  return milestone;
};

export const deleteGroupMilestoneService = async (id: string) => {
  const existing = await prisma.milestone.findUnique({
    where: { id },
    include: { _count: { select: { submissions: true } } },
  });
  if (!existing)
    throw new NotFoundException(
      tr("notFound.milestone"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // Deleting would cascade away work the students already handed in. Refuse
  // and say so, rather than destroying submissions as a side effect.
  if (existing._count.submissions > 0)
    throw new BadRequestException(
      tr("milestone.hasSubmissions"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.milestone.delete({ where: { id } });
  await notifySupervisorOfMilestone(
    existing.groupId,
    "notif.milestoneDeleted.title",
  );

  return { message: "Milestone deleted" };
};

/** Tells the supervising professor that administration touched the timeline. */
const notifySupervisorOfMilestone = async (groupId: string, title: MessageKey) => {
  try {
    const group = await prisma.projectGroup.findUnique({
      where: { id: groupId },
      select: {
        topic: {
          select: { title: true, professor: { select: { userId: true } } },
        },
      },
    });
    // المجموعة قائمة، ولموضوعها أستاذٌ دائماً.
    const { topic } = group!;
    const userId = topic.professor.userId;

    await createNotification({
      userId,
      type: "general",
      title: { key: title },
      message: { key: "notif.milestone.message", params: { title: topic.title } },
      // كان «/professor/projects» — مسارٌ لا وجود له، فيفتح الإشعار صفحةً فارغة.
      link: `/professor/groups/${groupId}`,
    });
  } catch {
    // A notification must never fail the write it is reporting.
  }
};

//
// ════════ DEFENSES ════════
//
/**
 * من تعنيه المناقشة: طلبة الفريق، ومشرفهم، وأعضاء اللجنة — كلٌّ برابط فضائه.
 * تُجمع قبل الكتابة عند الحذف، إذ لا يبقى بعده ما يُسأل عنه.
 */
const defenseAudience = async (defenseId: string) => {
  try {
    const d = await prisma.defense.findUniqueOrThrow({
      where: { id: defenseId },
      select: {
        date: true,
        room: true,
        group: {
          select: {
            id: true,
            topic: {
              select: { title: true, professor: { select: { userId: true } } },
            },
            members: { select: { student: { select: { userId: true } } } },
          },
        },
        committee: { select: { professor: { select: { userId: true } } } },
      },
    });
    const recipients = new Map<string, string>();
    for (const m of d.group.members)
      recipients.set(m.student.userId, "/student/project");
    recipients.set(d.group.topic.professor.userId, `/professor/groups/${d.group.id}`);
    for (const c of d.committee)
      if (!recipients.has(c.professor.userId))
        recipients.set(c.professor.userId, "/professor");

    // اليوم يُكتب بلغة كلّ قارئ وبتوقيت الجامعة (catalog/notifications).
    return {
      recipients,
      message: {
        key: "notif.defense.message",
        params: { title: d.group.topic.title, date: d.date.toISOString(), room: d.room },
      } satisfies NotifyText,
    };
  } catch {
    return null;
  }
};

const notifyDefense = async (
  audience: Awaited<ReturnType<typeof defenseAudience>>,
  title: MessageKey,
  type: "defense_scheduled" | "defense_graded" | "general" = "defense_scheduled",
) => {
  if (!audience) return;
  try {
    await createNotifications(
      [...audience.recipients].map(([userId, link]) => ({
        userId,
        link,
        type,
        title: { key: title },
        message: audience.message,
      })),
    );
  } catch {
    // A notification must never fail the write it is reporting.
  }
};

export const createDefenseService = async (data: CreateDefenseDTO) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: data.groupId },
  });
  if (!group)
    throw new NotFoundException(
      tr("notFound.project"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const exists = await prisma.defense.findUnique({
    where: { groupId: data.groupId },
  });
  if (exists)
    throw new BadRequestException(
      tr("defense.alreadyScheduled"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const defense = await prisma.defense.create({
    data: {
      groupId: data.groupId,
      date: new Date(data.date),
      durationMinutes: data.durationMinutes,
      room: data.room,
      grade: data.grade,
      status: data.status,
      notes: data.notes,
      // Create committee members alongside the defense if provided.
      committee: data.committee?.length
        ? {
            create: data.committee.map((m) => ({
              professorId: m.professorId,
              role: m.role as never,
            })),
          }
        : undefined,
    },
    include: {
      committee: {
        include: { professor: { include: { user: { select: userSelect } } } },
      },
    },
  });

  // The team, their supervisor and the jury learn the date from the
  // platform, not from a corridor.
  await notifyDefense(await defenseAudience(defense.id), "notif.defenseScheduled.title");
  return defense;
};

export const updateDefenseService = async (
  id: string,
  data: UpdateDefenseDTO,
) => {
  const found = await prisma.defense.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.defense"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // If a committee list is provided, replace the existing one wholesale —
  // in one transaction, or a refused new list would leave no jury at all.
  const defense = await prisma.$transaction(async (tx) => {
    if (data.committee) {
      await tx.defenseCommitteeMember.deleteMany({
        where: { defenseId: id },
      });
    }

    return tx.defense.update({
      where: { id },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        durationMinutes: data.durationMinutes,
        room: data.room,
        grade: data.grade,
        status: data.status,
        notes: data.notes,
        committee: data.committee?.length
          ? {
              create: data.committee.map((m) => ({
                professorId: m.professorId,
                role: m.role as never,
              })),
            }
          : undefined,
      },
      include: {
        committee: {
          include: {
            professor: { include: { user: { select: userSelect } } },
          },
        },
      },
    });
  });

  // Only what changes someone's day is announced; a corrected note is not.
  const moved =
    (data.date !== undefined &&
      new Date(data.date).getTime() !== found.date.getTime()) ||
    (data.room !== undefined && data.room !== found.room);
  const statusChanged =
    data.status !== undefined && data.status !== found.status;

  if (statusChanged && data.status === "cancelled")
    await notifyDefense(await defenseAudience(id), "notif.defenseCancelled.title", "general");
  else if (statusChanged && data.status === "completed")
    await notifyDefense(
      await defenseAudience(id),
      "notif.defenseCompleted.title",
      "defense_graded",
    );
  else if (moved || (statusChanged && data.status === "scheduled"))
    await notifyDefense(await defenseAudience(id), "notif.defenseMoved.title");
  else if (data.committee)
    await notifyDefense(await defenseAudience(id), "notif.defenseCommittee.title");

  return defense;
};

export const deleteDefenseService = async (id: string) => {
  const found = await prisma.defense.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      tr("notFound.defense"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  // Gathered first: once the row is gone there is no one left to ask.
  const audience =
    found.status === "scheduled" ? await defenseAudience(id) : null;
  await prisma.defense.delete({ where: { id } });
  await notifyDefense(audience, "notif.defenseDeleted.title", "general");
  return { message: "Defense deleted" };
};

//
// ════════ GROUP REQUESTS (admin decision — the heart of the flow) ════════
//

export const removeGroupRequestMemberService = async (
  requestId: string,
  studentId: string,
) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id: requestId },
    include: { members: true },
  });
  if (!request)
    throw new NotFoundException(
      tr("notFound.groupRequest"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (request.status === "accepted")
    throw new BadRequestException(
      tr("request.membersLocked"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (request.leaderStudentId === studentId)
    throw new BadRequestException(
      tr("request.cantRemoveLeader"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  const member = request.members.find((m) => m.studentId === studentId);
  if (!member)
    throw new BadRequestException(
      tr("request.notMember"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (request.members.length <= 1)
    throw new BadRequestException(
      tr("request.keepOne"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.groupRequestMember.delete({ where: { id: member.id } });
  return getGroupRequestService(requestId);
};

export const setGroupRequestLeaderService = async (
  requestId: string,
  studentId: string,
) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id: requestId },
    include: { members: true },
  });
  if (!request)
    throw new NotFoundException(
      tr("notFound.groupRequest"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (request.status === "accepted")
    throw new BadRequestException(
      tr("request.leaderLocked"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (!request.members.some((m) => m.studentId === studentId))
    throw new BadRequestException(
      tr("request.leaderMustBeMember"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.groupRequest.update({
    where: { id: requestId },
    data: { leaderStudentId: studentId },
  });
  return getGroupRequestService(requestId);
};

/**
 * The filters of the group-requests page, shared by its two views — the flat
 * list and the topics with their requests — so both answer to the same
 * search, status, professor, academic chain and dates.
 */
const groupRequestFilters = (q: ListQueryDTO) => {
  const {
    status: statusFilter,
    professorId,
    facultyId,
    departmentId,
    filiereId,
    specializationId,
    dateFrom,
    dateTo,
  } = q as {
    status?: string;
    professorId?: string;
    facultyId?: string;
    departmentId?: string;
    filiereId?: string;
    specializationId?: string;
    dateFrom?: string;
    dateTo?: string;
  };

  /*
   * شرطان لا واحد.
   *
   * `where` للقائمة، و`whereAnyStatus` للعدّادات — وهو هو ناقصاً شرط الحالة.
   * فشريط الأرقام يجب أن يبقى يعرض الثلاثة كلّها وأنت مُرشِّحٌ بحالةٍ واحدة،
   * وإلّا صار عديم الفائدة: يقول «١ معلّقة» وأنت تنظر إلى المعلّقات وحدها.
   *
   * وكانت الواجهة تحسبها بثلاثة نداءات إضافية بـ`limit: 1` تقرأ `total` —
   * **بلا تمرير الفلاتر**. فترشيحٌ بأستاذٍ أو تاريخ يُضيّق القائمة ويترك
   * الشريط على الإجمالي العامّ: أرقامٌ تناقض ما تحتها مباشرةً.
   */
  const whereAnyStatus: Record<string, unknown> = {};
  const where: Record<string, unknown> = {};

  if (statusFilter && statusFilter !== "all") where.status = statusFilter;

  if (q.search) {
    whereAnyStatus.OR = where.OR = [
      { topic: { title: { contains: q.search } } },
      {
        leader: {
          registrationNumber: { contains: q.search },
        },
      },
      {
        leader: {
          user: { firstName: { contains: q.search } },
        },
      },
      {
        leader: {
          user: { lastName: { contains: q.search } },
        },
      },
    ];
  }

  // فلاتر تمرّ عبر علاقة الموضوع (أستاذ / تخصّص / السلسلة الأكاديمية)
  const topicWhere: Record<string, unknown> = {};
  if (professorId) topicWhere.professorId = professorId;
  if (specializationId) topicWhere.specializationId = specializationId;
  else if (filiereId) topicWhere.specialization = { filiereId };
  else if (departmentId)
    topicWhere.specialization = { filiere: { departmentId } };
  else if (facultyId)
    topicWhere.specialization = { filiere: { department: { facultyId } } };
  if (Object.keys(topicWhere).length > 0)
    whereAnyStatus.topic = where.topic = topicWhere;

  // مدى التاريخ
  if (dateFrom || dateTo) {
    whereAnyStatus.createdAt = where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
    };
  }

  return { where, whereAnyStatus };
};

/** The three statuses, zeros included: the strip never loses a number. */
const statusCounts = (grouped: { status: string; _count: { _all: number } }[]) => {
  const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
  return {
    pending: byStatus.get("pending") ?? 0,
    accepted: byStatus.get("accepted") ?? 0,
    rejected: byStatus.get("rejected") ?? 0,
    all: [...byStatus.values()].reduce((a, b) => a + b, 0),
  };
};

type Placement = { topicId: string; topic: string; name: string };

/**
 * أين وُضع كلّ طالبٍ من هؤلاء: المشروعُ الذي هو فيه، بموضوعه.
 *
 * طالبٌ له مشروع لا يُقبل في طلبٍ آخر — فتُقرأ مواضعُ أعضاء كلّ طلبٍ يُعرض
 * أو يُقبل، بنداءٍ واحدٍ للصفحة كلّها.
 */
const placementsOf = async (
  db: Prisma.TransactionClient | typeof prisma,
  studentIds: string[],
): Promise<Map<string, Placement>> => {
  if (!studentIds.length) return new Map();
  const rows = await db.projectMember.findMany({
    where: { studentId: { in: [...new Set(studentIds)] } },
    select: {
      studentId: true,
      student: { select: { user: { select: { firstName: true, lastName: true } } } },
      group: { select: { topic: { select: { id: true, title: true } } } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.studentId,
      {
        topicId: r.group.topic.id,
        topic: r.group.topic.title,
        name: [r.student.user.firstName, r.student.user.lastName].filter(Boolean).join(" "),
      },
    ]),
  );
};

/** أوّلُ عضوٍ في الطلب له مشروعٌ على موضوعٍ غير موضوعه — لجدول القواعد. */
const placedIn = (
  placements: Map<string, Placement>,
  request: { topicId: string; members: { studentId: string }[] },
) => {
  for (const m of request.members) {
    const p = placements.get(m.studentId);
    if (p && p.topicId !== request.topicId) return { name: p.name, topic: p.topic };
  }
  return null;
};

export const listGroupRequestsService = async (q: ListQueryDTO) => {
  const { where, whereAnyStatus } = groupRequestFilters(q);

  const [items, total, grouped] = await Promise.all([
    prisma.groupRequest.findMany({
      where,
      include: {
        topic: {
          include: {
            professor: { include: { user: { select: userSelect } } },
            specialization: true,
            // بدونه يبقى `hasGroup` كاذباً أبداً، فيصير جدول القواعد أسوأ
            // من غيابه: يقول «يجوز» عن إجراءٍ يردّه الخادم.
            projectGroup: { select: { id: true } },
          },
        },
        leader: { include: { user: { select: userSelect } } },
        members: {
          include: { student: { include: { user: { select: userSelect } } } },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.groupRequest.count({ where }),
    prisma.groupRequest.groupBy({
      by: ["status"],
      where: whereAnyStatus,
      _count: { _all: true },
    }),
  ]);

  /*
   * جدول القواعد يُرفَق بكل طلب. وبدونه تُخمّن الشاشة من حالة الطلب وحدها
   * بينما ثلاثةٌ من شروط الخادم الأربعة لا تصلها أصلاً — فتعرض أزراراً
   * لإجراءاتٍ مستحيلة.
   */
  const placements = await placementsOf(
    prisma,
    items.flatMap((r) => r.members.map((m) => m.studentId)),
  );
  const withActions = items.map((r) => ({
    ...r,
    actions: requestActions({
      status: r.status,
      memberCount: r.members.length,
      topic: {
        status: r.topic.status,
        maxStudents: r.topic.maxStudents,
        hasGroup: !!r.topic.projectGroup,
      },
      placed: placedIn(placements, r),
    }),
  }));

  // الحالات الثلاث معلنةٌ ولو بأصفار: شريطٌ يختفي منه رقمٌ تتزحزح بقيّته،
  // والصفر خبرٌ لا غياب.
  const counts = statusCounts(grouped);

  return { items: withActions, total, counts, page: q.page, limit: q.limit };
};

/**
 * The same requests, gathered under their topics.
 *
 * Several teams now ask for one topic at once and the administration picks
 * one — so the decision is made per topic, with its competing teams side by
 * side, not request by request in a flat list where a topic's teams sit pages
 * apart. Pages count topics, so a topic's requests are never split between
 * two. The topics with the most teams waiting come first.
 *
 * Inside each topic: the requests that pass the filters, oldest first (the
 * order they arrived in), each with what may be done with it; and the topic's
 * own count per status — all of its requests, so "3 rejected" stays true
 * while the list shows only the pending ones.
 *
 * `focus` is the topic the page was opened for, from its own page ("decide on
 * the request"). Among many topics with one team waiting it could fall on any
 * page, and the reader would never find it; so it heads the first page and is
 * left out of the rest — never shown twice. `total` counts it once; the pages
 * are counted on the others (`pageTotal`).
 */
export const listGroupRequestsByTopicService = async (q: ListQueryDTO) => {
  const { where, whereAnyStatus } = groupRequestFilters(q);
  const topicWhere = { groupRequests: { some: where } } as Prisma.GraduationTopicWhereInput;
  const focus = q.focus;
  const listWhere: Prisma.GraduationTopicWhereInput = focus
    ? { AND: [topicWhere, { id: { not: focus } }] }
    : topicWhere;

  const select = {
    id: true,
    title: true,
    status: true,
    maxStudents: true,
    maxRequests: true,
    pendingRequestCount: true,
    professor: { include: { user: { select: userSelect } } },
    specialization: { select: { id: true, name: true } },
    projectGroup: { select: { id: true } },
    groupRequests: {
      where: where as Prisma.GroupRequestWhereInput,
      orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
      include: {
        leader: { include: { user: { select: userSelect } } },
        members: {
          include: { student: { include: { user: { select: userSelect } } } },
        },
      },
    },
  } satisfies Prisma.GraduationTopicSelect;

  const [focused, focusMatches, topics, pageTotal, grouped] = await Promise.all([
    focus && q.page === 1
      ? prisma.graduationTopic.findFirst({ where: { id: focus, groupRequests: { some: {} } }, select })
      : null,
    focus ? prisma.graduationTopic.count({ where: { AND: [topicWhere, { id: focus }] } }) : 0,
    prisma.graduationTopic.findMany({
      where: listWhere,
      orderBy: [{ pendingRequestCount: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select,
    }),
    prisma.graduationTopic.count({ where: listWhere }),
    prisma.groupRequest.groupBy({
      by: ["status"],
      where: whereAnyStatus,
      _count: { _all: true },
    }),
  ]);
  const total = pageTotal + focusMatches;
  const shown = focused ? [focused, ...topics] : topics;

  const perTopic = shown.length
    ? await prisma.groupRequest.groupBy({
        by: ["topicId", "status"],
        where: { topicId: { in: shown.map((t) => t.id) } },
        _count: { _all: true },
      })
    : [];

  const placements = await placementsOf(
    prisma,
    shown.flatMap((t) => t.groupRequests.flatMap((r) => r.members.map((m) => m.studentId))),
  );
  const items = shown.map(({ groupRequests, ...topic }) => ({
    ...topic,
    focused: topic.id === focus,
    counts: statusCounts(perTopic.filter((g) => g.topicId === topic.id)),
    requests: groupRequests.map((r) => ({
      ...r,
      actions: requestActions({
        status: r.status,
        memberCount: r.members.length,
        topic: {
          status: topic.status,
          maxStudents: topic.maxStudents,
          hasGroup: !!topic.projectGroup,
        },
        placed: placedIn(placements, r),
      }),
    })),
  }));

  return { items, total, pageTotal, counts: statusCounts(grouped), page: q.page, limit: q.limit };
};

/**
 * One request, with what the decision rests on.
 *
 * Beyond the request itself, each member comes with what else they are part
 * of — a project already, or another request still waiting — and with their
 * specialization, so a team from another specialization is seen before it is
 * accepted rather than after. The topic brings how many requests it has
 * used against its cap.
 */
export const getGroupRequestService = async (id: string) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id },
    include: {
      topic: {
        include: {
          professor: { include: { user: { select: userSelect } } },
          specialization: true,
          academicYear: true,
          projectGroup: { select: { id: true } },
          _count: {
            select: { groupRequests: { where: COUNTED_ON_CAP } },
          },
        },
      },
      leader: { include: { user: { select: userSelect } } },
      members: {
        include: {
          student: {
            include: {
              user: { select: userSelect },
              specialization: { select: { id: true, name: true } },
              academicYear: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!request)
    throw new NotFoundException(
      tr("notFound.groupRequest"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // What else each member is part of — read before deciding, not learned
  // from a refusal after it.
  const studentIds = request.members.map((m) => m.studentId);
  const [placements, otherRequests] = await Promise.all([
    prisma.projectMember.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        group: {
          select: { id: true, topic: { select: { id: true, title: true } } },
        },
      },
    }),
    prisma.groupRequestMember.findMany({
      where: {
        studentId: { in: studentIds },
        requestId: { not: id },
        request: { status: "pending" },
      },
      select: {
        studentId: true,
        request: {
          select: {
            id: true,
            createdAt: true,
            topic: { select: { id: true, title: true } },
          },
        },
      },
    }),
  ]);

  const members = request.members.map((m) => ({
    ...m,
    project:
      placements.find((p) => p.studentId === m.studentId)?.group ?? null,
    otherPending: otherRequests
      .filter((o) => o.studentId === m.studentId)
      .map((o) => o.request),
  }));

  // العضوُ الذي له مشروعٌ على موضوعٍ آخر يُطفئ «قبول» — من الصفوف نفسها.
  const placedMember = members.find((m) => m.project && m.project.topic.id !== request.topicId);

  // نفس الجدول الذي تقرأه القائمة، فلا تختلف صفحة التفصيل عنها في ما تعرضه.
  return {
    ...request,
    members,
    actions: requestActions({
      status: request.status,
      memberCount: request.members.length,
      topic: {
        status: request.topic.status,
        maxStudents: request.topic.maxStudents,
        hasGroup: !!request.topic.projectGroup,
      },
      placed: placedMember
        ? {
            name: [placedMember.student.user.firstName, placedMember.student.user.lastName]
              .filter(Boolean)
              .join(" "),
            topic: placedMember.project!.topic.title,
          }
        : null,
    }),
  };
};

export const acceptGroupRequestService = async (id: string) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id },
    include: {
      topic: { include: { projectGroup: true } },
      members: true,
    },
  });
  if (!request)
    throw new NotFoundException(
      tr("notFound.groupRequest"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  const topic = request.topic;
  const memberIds = request.members.map((m) => m.studentId);
  const team = new Set(memberIds);

  /*
   * الحارس هو جدول القواعد نفسه الذي تقرأه الشاشة. وكان هنا أربعة فحوصٍ
   * مكتوبةً بيد، والشاشة تُخمّن مقابلها من حالة الطلب وحدها — فتباعدا.
   * الآن موضعٌ واحد: ما يمنع هنا هو ما يُطفئ الزرّ هناك، بالنصّ نفسه.
   */
  const gate = requestActions({
    status: request.status,
    memberCount: request.members.length,
    topic: {
      status: topic.status,
      maxStudents: topic.maxStudents,
      hasGroup: !!topic.projectGroup,
    },
    placed: placedIn(await placementsOf(prisma, memberIds), request),
  });
  if (!gate.canAccept)
    throw new BadRequestException(
      gate.blockedReasons.accept!,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const result = await prisma.$transaction(async (tx) => {
    /*
     * أعضاءُ الطلب مقفلون حتى نهاية المعاملة. قبولان معاً لطلبين يشتركان في
     * طالب — على موضوعين مختلفين، فلا يجمعهما شيءٌ آخر — كان كلٌّ منهما يقرأ
     * «لا مشروع له» قبل أن يكتب الآخر، فيصير له مشروعان. الآن يصطفّان هنا،
     * ويقرأ الثاني ما كتبه الأوّل فيُردّ.
     *
     * والقفلُ أوّلُ ما في المعاملة عمداً: لقطةُ القراءة تؤخذ عند أوّل قراءةٍ
     * عادية، فتأتي بعده فترى ما كتبه السابق.
     */
    if (memberIds.length)
      await tx.$queryRaw`SELECT id FROM Student WHERE id IN (${Prisma.join(memberIds)}) ORDER BY id FOR UPDATE`;
    const placedNow = placedIn(await placementsOf(tx, memberIds), request);
    if (placedNow)
      throw new BadRequestException(
        tr("gate.memberPlaced", placedNow),
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    const fresh = await tx.graduationTopic.findUnique({
      where: { id: topic.id },
      include: { projectGroup: true },
    });
    if (
      !fresh ||
      (fresh.status !== "pending" &&
        fresh.status !== "approved" &&
        fresh.status !== "open" &&
        fresh.status !== "full")
    )
      throw new BadRequestException(
        tr("request.topicGone"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    if (fresh.projectGroup)
      throw new BadRequestException(
        tr("request.otherAccepted"),
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    const group = await tx.projectGroup.create({
      data: { topicId: topic.id },
    });

    // المرسِل ينتقل مع الفريق قائداً للمجموعة.
    //
    // كان هذا السطر ينسخ الأعضاء بلا `isLeader`، فتنشأ كل مجموعة من طلبٍ بلا
    // قائد إطلاقاً — والمرسِل مسجَّل في الطلب وحده حيث لا تقرؤه شاشة المشروع.
    // ثم لا سبيل لتصحيحه: تعديل مرسِل الطلب ممنوع بعد القبول.
    await tx.projectMember.createMany({
      data: request.members.map((m) => ({
        groupId: group.id,
        studentId: m.studentId,
        isLeader: m.studentId === request.leaderStudentId,
      })),
      skipDuplicates: true,
    });

    const updated = await tx.groupRequest.update({
      where: { id: request.id },
      data: { status: "accepted" },
    });

    // Two kinds of pending request end here, each told why:
    //
    //  - the other teams that asked for this topic at the same time — the
    //    topic is taken, so they can choose another;
    //  - the requests, on other topics, of anyone in this team — a student
    //    is in one project only. Mostly the team's own lower priorities; or
    //    a request another team sent with one of these students in it.
    //
    // Left pending, the second kind could be accepted too, and its members
    // would end in two projects. Each also holds a place under its topic's
    // cap, so releasing it gives that topic back to other teams.
    const others = await tx.groupRequest.findMany({
      where: {
        status: "pending",
        id: { not: request.id },
        OR: [{ topicId: topic.id }, { members: { some: { studentId: { in: memberIds } } } }],
      },
      select: {
        id: true,
        topicId: true,
        topic: { select: { title: true } },
        members: {
          select: {
            studentId: true,
            student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    const superseded = others.filter((o) => o.topicId === topic.id);
    const released = others
      .filter((o) => o.topicId !== topic.id)
      .map((o) => ({
        ...o,
        sameTeam: o.members.every((m) => team.has(m.studentId)),
        names: o.members
          .filter((m) => team.has(m.studentId))
          .map((m) => [m.student.user.firstName, m.student.user.lastName].filter(Boolean).join(" "))
          .join("، "),
      }));

    if (superseded.length)
      await tx.groupRequest.updateMany({
        where: { id: { in: superseded.map((o) => o.id) } },
        data: { status: "rejected", rejectionReason: tr("request.supersededReason") },
      });
    for (const r of released)
      await tx.groupRequest.update({
        where: { id: r.id },
        data: {
          status: "rejected",
          rejectionReason: r.sameTeam
            ? tr("request.teamPlacedReason", { title: topic.title })
            : tr("request.memberPlacedReason", { names: r.names, title: topic.title }),
        },
      });

    // The group now exists, so the projection reads `full` on its own — and
    // the pending count drops to nothing with the others released. The
    // literal that used to be written here is what erased "was it
    // published?" and left every exit from `full` guessing. The topics the
    // released requests were on each lose one from their pending count.
    await computeTopicStatus(tx, topic.id);
    for (const topicId of new Set(released.map((r) => r.topicId)))
      await computeTopicStatus(tx, topicId);

    return {
      updated,
      supersededUserIds: [...new Set(superseded.flatMap((o) => o.members.map((m) => m.student.userId)))],
      released,
    };
  });

  // إشعار كلّ عضو في الفريق بالموافقة.
  const memberUserIds = (
    await prisma.student.findMany({
      where: { id: { in: request.members.map((m) => m.studentId) } },
      select: { userId: true },
    })
  ).map((s) => s.userId);
  for (const userId of memberUserIds) {
    await createNotification({
      userId,
      type: "general",
      title: { key: "notif.groupAccepted.title" },
      message: { key: "notif.groupAccepted.message", params: { title: topic.title } },
      link: "/student/project",
    });
  }

  // And every member of the teams released by this choice.
  for (const userId of result.supersededUserIds) {
    await createNotification({
      userId,
      type: "general",
      title: { key: "notif.groupSuperseded.title" },
      message: { key: "notif.groupSuperseded.message", params: { title: topic.title } },
      link: "/topics",
    });
  }

  // And every member of the requests cancelled on other topics: this team's
  // own members are told their team was accepted; anyone else, who left.
  for (const r of result.released) {
    for (const m of r.members) {
      await createNotification({
        userId: m.student.userId,
        type: "general",
        title: { key: "notif.groupReleased.title" },
        message: team.has(m.studentId)
          ? { key: "notif.groupReleased.message", params: { accepted: topic.title, title: r.topic.title } }
          : {
              key: "notif.groupMemberPlaced.message",
              params: { names: r.names, accepted: topic.title, title: r.topic.title },
            },
        link: "/student/requests",
      });
    }
  }

  return result.updated;
};

/**
 * يحذف طلباً **منتهياً** من السجلّ.
 *
 * والحذفُ غيرُ الرفض: الرفضُ قرارٌ يُبلَّغ صاحبُه ويُسجَّل سببُه ويبقى أثرُه
 * في «محاولاتٌ سابقة». وهذا مسحٌ للأثر — لسطرٍ أُنشئ خطأً، أو لتنظيف قائمةٍ
 * امتلأت بمحاولاتٍ قديمة.
 *
 * ولذلك لا يُحذف إلّا ما انتهى:
 *
 *   - `pending` يُبَتّ فيه ولا يُمحى. وحذفُه يُسقط الطلبَ من تحت فريقٍ
 *     ينتظر بلا خبرٍ ولا سبب — والرفضُ يُبلّغهم ويُحرّر الموضوع معاً.
 *   - `accepted` تحته مشروعٌ قائم بأعضائه ومراحله. ومحوُ الطلب يترك
 *     المشروع بلا أصلٍ يُفسّر من أين جاء. يُفسَخ المشروع أوّلاً.
 *
 * والأعضاء يذهبون بالـcascade، ولا تُمسّ حالةُ الموضوع.
 *
 * وكان هنا `computeTopicStatus` — «حساباً احتياطياً» — وهو خطأ. الدالّةُ
 * تُعيد اشتقاق الحالة من الإسقاط وتكتبها إن خالفت المخزَّن، فإن كان بينهما
 * انحرافٌ سابق صحّحته **في أثناء الحذف**: موضوعٌ مكتوبٌ `approved` وقد بقي
 * `publishedAt` مضبوطاً يصير `open` — أي أنّ حذف سطرٍ مرفوض يُعيد نشر
 * الموضوع على الطلبة. قِيس ذلك فعلاً: `approved` ← `open`.
 *
 * والطلبُ المنتهي لا يحجز شيئاً أصلاً، فلا شيء يُعاد حسابه. وتصحيحُ
 * الانحراف — إن وُجد — بابُه الإجراءُ الذي يخصّه، لا عمليةٌ لا علاقة لها به.
 */
export const deleteGroupRequestService = async (id: string) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id },
    select: { id: true, status: true, topicId: true },
  });
  if (!request)
    throw new NotFoundException(
      tr("notFound.groupRequest"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  if (request.status !== "rejected")
    throw new BadRequestException(
      request.status === "accepted"
        ? tr("request.deleteAccepted")
        : tr("request.deletePending"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.groupRequest.delete({ where: { id } });

  return { id, topicId: request.topicId };
};

export const rejectGroupRequestService = async (
  id: string,
  rejectionReason?: string,
) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id },
    include: { topic: { include: { projectGroup: { select: { id: true } } } } },
  });
  if (!request)
    throw new NotFoundException(
      tr("notFound.groupRequest"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  /**
   * رفض طلب صار مشروعاً قائماً ليس رفضاً، بل حذفٌ للأثر من تحت مشروع حيّ.
   *
   * كان هذا ينجح بصمت: يُحذف الطلب، وتبقى المجموعة بأعضائها ومراحلها
   * ومناقشتها، ويبقى الموضوع `full` — بلا أي سجلّ يشرح من أين جاء هذا
   * المشروع، ويفقد الطلبة كل أثر للطلب الذي أنشأه.
   *
   * الشرط على المجموعة لا على حالة الطلب: طلبٌ `accepted` فُسخت مجموعته
   * (حالة عالقة من بيانات قديمة) يجب أن يبقى رفضه ممكناً — فهو الإصلاح.
   */
  const gate = requestActions({
    status: request.status,
    memberCount: 0, // لا يدخل في قاعدة الرفض
    topic: {
      status: request.topic.status,
      maxStudents: request.topic.maxStudents,
      hasGroup: !!request.topic.projectGroup,
    },
  });
  if (!gate.canReject)
    throw new BadRequestException(
      gate.blockedReasons.reject!,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const leaderUserId = await getStudentUserId(request.leaderStudentId);
  const topicId = request.topicId;

  await prisma.$transaction(async (tx) => {
    /*
     * يُعلَّم الطلب `rejected` ولا يُحذف — كما يفعل `releaseTopicOccupancy`
     * للطلب المقبول. وكان يُحذف، فيذهب معه ثلاثة أشياء:
     *
     *   ١. السببُ المكتوب. الشاشة تسأل الإدارة عنه ثمّ تمحوه، وصفحةُ الطالب
     *      تعرض «سبب الرفض» على صفٍّ لم يعد موجوداً — عرضٌ لا يُرى أبداً.
     *   ٢. سقفُ الطلبات. يَعدّ صفوف الطلبات، والحذف يُعيد العدّاد إلى ما
     *      كان، فلا يبلغ السقفُ شيئاً مهما رُفض الفريق.
     *   ٣. أثرُ المحاولة. لا تعرف الإدارة أنّ هذا الموضوع رُفض عليه فريقان
     *      قبل الثالث، ولا لماذا.
     *
     * والرفضُ يُفرِج عن خانة الفريق من سقف الموضوع، فيتقدّم إليه غيرُه.
     *
     * والأعضاء يبقون في `GroupRequestMember` بدل أن يذهبوا بالـ cascade،
     * وهم جزءُ الأثر: «مَن طلبه» لا يقلّ عن «لماذا رُفض».
     */
    await tx.groupRequest.update({
      where: { id },
      data: {
        status: "rejected",
        rejectionReason: rejectionReason ?? null,
      },
    });

    // ثم أعِد حساب الحالة وعدّاد السقف من الإشغال الباقي. كان هنا فرعٌ يكتب "open"
    // حرفياً، وبشرط أن يكون الموضوع `full` — فكان الباب الآخر (فسخ
    // المجموعة) يكتب "approved" لنفس الموقف. البابان الآن يمرّان من هنا.
    await computeTopicStatus(tx, topicId);
  });

  // أعلِم مرسِل الفريق بالرفض.
  await createNotification({
    userId: leaderUserId,
    type: "general",
    title: { key: "notif.groupRejected.title" },
    message: rejectionReason
      ? { key: "notif.groupRejected.messageReason", params: { reason: rejectionReason } }
      : { key: "notif.groupRejected.message" },
    link: "/student/requests",
  });

  return { id, topicId, status: "rejected" as const };
};
