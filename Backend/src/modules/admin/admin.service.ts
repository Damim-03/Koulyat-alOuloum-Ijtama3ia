import { prisma } from "../../core/prisma/client";
import bcrypt from "bcryptjs";
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
  RejectTopicDTO,
  ChangeSupervisorDTO,
  AssignStudentDTO,
  CreateDefenseDTO,
  UpdateDefenseDTO,
  ListProfessorsDTO,
  ListProjectsDTO,
  ListMilestonesDTO,
  AdminCreateMilestoneDTO,
  AdminUpdateMilestoneDTO,
  CreateDomainDTO,
  UpdateDomainDTO,
  CreateAssignedTopicDTO,
  UpdateAssignedTopicDTO,
} from "./admin.validation";
import { Role } from "../../generated/prisma";
import { createNotification } from "../notification/notification.service";

// Cost factor is configurable and defaults to 12. bcrypt stores the cost in
// the hash, so raising it does not invalidate existing passwords.
const SALT_ROUNDS = config.BCRYPT_ROUNDS;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
  avatarUrl: true, // ← جديد
  role: true,
  status: true,
  isVerified: true,
  lastLoginAt: true,
  createdAt: true,
};

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
const getTopicProfessorUserId = async (topicId: string) => {
  const t = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
    select: { professor: { select: { userId: true } } },
  });
  return t?.professor.userId ?? null;
};

// Resolve a student's userId (for notifications).
const getStudentUserId = async (studentId: string) => {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  });
  return s?.userId ?? null;
};

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
          select: { user: { select: { firstName: true, lastName: true } } },
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
            user: { select: { firstName: true, lastName: true } },
          },
        },
        members: {
          select: {
            student: {
              select: {
                registrationNumber: true,
                user: { select: { firstName: true, lastName: true } },
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
          select: { user: { select: { firstName: true, lastName: true } } },
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
  const activeUsers = healthMap.get("active") ?? 0;
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

export const createAssignedTopicService = async (
  data: CreateAssignedTopicDTO,
) => {
  const {
    title,
    description,
    requirements = [],
    objectives = [],
    maxStudents,
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
      "Professor not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
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

  // 2) تأكّد من وجود كل الطلبة.
  const students = await prisma.student.findMany({
    where: { id: { in: memberStudentIds } },
    select: { id: true, userId: true },
  });
  if (students.length !== memberStudentIds.length)
    throw new BadRequestException(
      "بعض الطلبة غير موجودين",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // 3) امنع إسناد طالب لديه مشروع بالفعل.
  const already = await prisma.projectMember.findFirst({
    where: { studentId: { in: memberStudentIds } },
  });
  if (already)
    throw new BadRequestException(
      "أحد الطلبة المُسنَدين لديه مشروع بالفعل",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // 4) أنشئ الموضوع + المجموعة + الأعضاء (مع المرسِل) + اضبط الحالة full — في معاملة واحدة.
  const topic = await prisma.$transaction(async (tx) => {
    const created = await tx.graduationTopic.create({
      data: {
        title,
        description,
        requirements,
        objectives,
        maxStudents,
        status: "full", // محجوز، مقبول، لا يُنشَر
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

    return created;
  });

  // 5) أعلِم الطلبة المُسنَدين.
  for (const s of students) {
    await createNotification({
      userId: s.userId,
      type: "general",
      title: "تم إسنادكم إلى موضوع",
      message: `أسندت الإدارة لكم موضوع: «${topic.title}».`,
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
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // 2) تحقّق من المراجع المُرسَلة.
  if (professorId) {
    const p = await prisma.professor.findUnique({ where: { id: professorId } });
    if (!p)
      throw new NotFoundException(
        "Professor not found",
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
  }
  if (specializationId) {
    const s = await prisma.specialization.findUnique({
      where: { id: specializationId },
    });
    if (!s)
      throw new NotFoundException(
        "Specialization not found",
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
  }
  if (academicYearId) {
    const y = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    if (!y)
      throw new NotFoundException(
        "Academic year not found",
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
  }

  const effectiveMax = maxStudents ?? topic.maxStudents;
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
        "الحدّ الأقصى أقلّ من عدد الطلبة المُسنَدين حالياً",
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
        "يجب أن تبقى المجموعة تضمّ طالباً واحداً على الأقل",
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    if (!leaderStudentId || !memberStudentIds.includes(leaderStudentId))
      throw new BadRequestException(
        "المرسِل يجب أن يكون ضمن الطلبة المُسنَدين",
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    if (new Set(memberStudentIds).size !== memberStudentIds.length)
      throw new BadRequestException(
        "يوجد طالب مكرّر في القائمة",
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    if (memberStudentIds.length > effectiveMax)
      throw new BadRequestException(
        "عدد الطلبة يتجاوز الحدّ الأقصى",
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    const students = await prisma.student.findMany({
      where: { id: { in: memberStudentIds } },
      select: { id: true },
    });
    if (students.length !== memberStudentIds.length)
      throw new BadRequestException(
        "بعض الطلبة غير موجودين",
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
          "أحد الطلبة الجدد لديه مشروع بالفعل",
          ErrorCodeEnum.VALIDATION_ERROR,
        );
    }
  }

  // 4) طبّق كل شيء في معاملة واحدة.
  await prisma.$transaction(async (tx) => {
    await tx.graduationTopic.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(requirements !== undefined ? { requirements } : {}),
        ...(objectives !== undefined ? { objectives } : {}),
        ...(maxStudents !== undefined ? { maxStudents } : {}),
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
          "المرسِل يجب أن يكون ضمن أعضاء المجموعة",
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
        title: "تم إسنادكم إلى موضوع",
        message: `أسندت الإدارة لكم موضوع: «${title ?? topic.title}».`,
        link: "/student/project",
      });
    }
  }

  return getTopicByIdService(id);
};

//
// ════════ USERS ════════
//
/**
 * Name search, one word at a time.
 *
 * Each word must appear in the first name or the last name, and the caller
 * does not have to know which is which: "خالد مرابط" and "مرابط خالد" both find the same
 * person, and two letters of each ("خا مر") are enough. Matching every word
 * rather than any of them keeps a two-word query from widening the results.
 */
const nameSearchFilter = (
  search: string,
  /** Places the name fields where the model keeps them: at the top level for
   *  User, under `user` for the records that point at one. */
  wrap: (f: Record<string, unknown>) => Record<string, unknown> = (f) => f,
) => {
  const words = search.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return {
    AND: words.map((word) => ({
      OR: [
        wrap({ firstName: { contains: word } }),
        wrap({ lastName: { contains: word } }),
      ],
    })),
  };
};

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
      "User not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return user;
};

export const createUserService = async (data: CreateUserDTO) => {
  if (!data.email && !data.username) {
    throw new BadRequestException(
      "Either email or username is required",
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
      role: data.role as Role,
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

export const updateUserStatusService = async (
  id: string,
  data: UpdateUserStatusDTO,
) => {
  await getUserByIdService(id);
  const user = await prisma.user.update({
    where: { id },
    data: { status: data.status },
    select: userSelect,
  });
  return user;
};

export const resetUserPasswordService = async (
  id: string,
  data: ResetPasswordDTO,
) => {
  await getUserByIdService(id);
  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  return { message: "Password reset" };
};

export const deleteUserService = async (id: string) => {
  const user = await getUserByIdService(id);
  if (user.student)
    throw new BadRequestException(
      "هذا الحساب طالب؛ احذفه من إدارة الطلبة لتُنظَّف بياناته المرتبطة.",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (user.professor)
    throw new BadRequestException(
      "هذا الحساب أستاذ؛ احذفه من إدارة الأساتذة.",
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
  const where: Record<string, unknown> = {};

  if (q.specializationId) where.specializationId = q.specializationId;
  if (q.academicYearId) where.academicYearId = q.academicYearId;

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

  // Hierarchical filters resolved through the specialization → filiere chain.
  // (Prisma lets us filter on nested relations.)
  if (q.filiereId) {
    where.specialization = { filiereId: q.filiereId };
  } else if (q.departmentId) {
    where.specialization = { filiere: { departmentId: q.departmentId } };
  } else if (q.facultyId) {
    where.specialization = {
      filiere: { department: { facultyId: q.facultyId } },
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
      "Student not found",
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
      "Registration number already exists",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);

  const student = await prisma.student.create({
    data: {
      registrationNumber: data.registrationNumber,
      specialization: { connect: { id: data.specializationId } },
      academicYear: { connect: { id: data.academicYearId } },
      user: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          avatarUrl: data.avatarUrl,
          password: hashed,
          role: "student" as Role,
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
        "Registration number already exists",
        ErrorCodeEnum.VALIDATION_ERROR,
      );
  }

  const updateData: Record<string, unknown> = {};
  if (data.registrationNumber !== undefined)
    updateData.registrationNumber = data.registrationNumber;
  if (data.specializationId !== undefined)
    updateData.specialization = { connect: { id: data.specializationId } };
  if (data.academicYearId !== undefined)
    updateData.academicYear = { connect: { id: data.academicYearId } };

  const userUpdate: Record<string, unknown> = {};
  if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
  if (data.lastName !== undefined) userUpdate.lastName = data.lastName;
  if (data.email !== undefined) userUpdate.email = data.email;
  if (data.phone !== undefined) userUpdate.phone = data.phone;
  if (data.avatarUrl !== undefined) userUpdate.avatarUrl = data.avatarUrl;
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
      "Student not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  await prisma.$transaction(async (tx) => {
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
  if (q.grade) where.grade = { has: q.grade };

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
          _count: { select: { groupRequests: true } },
        },
      },
    },
  });
  if (!professor)
    throw new NotFoundException(
      "Professor not found",
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
    newCodes.push({ code: data.faculty.code, label: "الكلية" });
  for (const d of data.departments)
    newCodes.push({ code: d.code, label: `القسم «${d.name}»` });
  for (const d of data.domains)
    newCodes.push({ code: d.code, label: `الميدان «${d.name}»` });
  for (const f of data.filieres)
    newCodes.push({ code: f.code, label: `الشعبة «${f.name}»` });

  // تكرار داخل الحمولة نفسها
  const seen = new Set<string>();
  for (const { code, label } of newCodes) {
    if (seen.has(code))
      throw new BadRequestException(
        `الرمز «${code}» مكرّر أكثر من مرّة في النموذج (${label})`,
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
        `رموز مستعملة بالفعل: ${[...new Set(taken)].join("، ")}`,
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
        "الكلية غير موجودة",
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
          `${what} يشير إلى عنصر غير موجود في النموذج`,
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
            `الميدان «${d.name}»`,
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
            `الشعبة «${f.name}»`,
          ),
          domainId: f.domain
            ? resolve(f.domain, domainIds, `الشعبة «${f.name}»`)
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
      "هذا النطاق مضاف بالفعل",
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
      "النطاق غير موجود",
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
      "النطاق غير موجود",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // لا يجوز ترك النظام بلا نطاق — لن يستطيع أحد إنشاء أستاذ بعدها.
  const total = await prisma.universityDomain.count();
  if (total <= 1)
    throw new BadRequestException(
      "لا يمكن حذف النطاق الوحيد المتبقّي",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  // ولا حذف نطاق يستعمله أساتذة، وإلّا صارت بياناتهم غير صالحة.
  const inUse = await prisma.professor.count({
    where: { universityEmail: { endsWith: `@${domain.domain}` } },
  });
  if (inUse > 0)
    throw new BadRequestException(
      `لا يمكن حذف النطاق: يستعمله ${inUse} أستاذ/أساتذة`,
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
      ? `نطاق البريد غير مسموح به. النطاقات المسموح بها: ${all
          .map((d) => `@${d.domain}`)
          .join("، ")}`
      : "لا توجد نطاقات جامعية مسجّلة — أضِف نطاقاً أوّلاً",
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

const randomEmployeeNumber = (): string => {
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
    "تعذّر توليد رقم وظيفي فريد، أعد المحاولة",
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
      "Employee number or university email already exists",
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
          email: data.email,
          password: hashed,
          role: "professor" as Role,
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
  if (data.email !== undefined) userUpdate.email = data.email;
  if (data.phone !== undefined) userUpdate.phone = data.phone;
  if (data.avatarUrl !== undefined) userUpdate.avatarUrl = data.avatarUrl;
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
      "Professor not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (professor._count.topics > 0)
    throw new BadRequestException(
      `لا يمكن حذف الأستاذ لارتباطه بـ ${professor._count.topics} موضوع. أعِد إسناد المواضيع أو أرشفتها أولاً.`,
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
      "Faculty code already exists",
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
      "Faculty not found",
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
      "Faculty not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found._count.departments > 0)
    throw new BadRequestException(
      `لا يمكن حذف الكلية لارتباطها بـ ${found._count.departments} قسم. احذف الأقسام أو انقلها أولاً.`,
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
      "Domain code already exists",
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
      "Domain not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.domain.update({
    where: { id },
    data,
    include: { department: true },
  });
};

export const deleteDomainService = async (id: string) => {
  const found = await prisma.domain.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Domain not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  // عند ربط الشعبة بالميدان أضِف هنا فحص _count.filieres كما في القسم.
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
      "Department code already exists",
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
      "Department not found",
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
      "Department not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  const blockers: string[] = [];
  if (found._count.domains > 0) blockers.push(`${found._count.domains} ميدان`);
  if (found._count.filieres > 0) blockers.push(`${found._count.filieres} شعبة`);
  if (found._count.professors > 0)
    blockers.push(`${found._count.professors} أستاذ`);
  if (blockers.length)
    throw new BadRequestException(
      `لا يمكن حذف القسم لارتباطه بـ ${blockers.join(" و ")}.`,
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
      "Filiere code already exists",
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
        "Domain not found",
        ErrorCodeEnum.RESOURCE_NOT_FOUND,
      );
    departmentId = domain.departmentId;
  }
  if (!departmentId)
    throw new BadRequestException(
      "departmentId or domainId is required",
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
      "Filiere not found",
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
        "Domain not found",
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
      "Filiere not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found._count.specializations > 0)
    throw new BadRequestException(
      `لا يمكن حذف الشعبة لارتباطها بـ ${found._count.specializations} تخصص.`,
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
      "Specialization not found",
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
      "Specialization not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  const blockers: string[] = [];
  if (found._count.students > 0) blockers.push(`${found._count.students} طالب`);
  if (found._count.topics > 0) blockers.push(`${found._count.topics} موضوع`);
  if (blockers.length)
    throw new BadRequestException(
      `لا يمكن حذف التخصص لارتباطه بـ ${blockers.join(" و ")}.`,
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
      "Academic year already exists",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return prisma.academicYear.create({ data });
};

export const updateAcademicYearService = async (
  id: string,
  data: UpdateAcademicYearDTO,
) => {
  const found = await prisma.academicYear.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.academicYear.update({ where: { id }, data });
};

export const activateAcademicYearService = async (id: string) => {
  const found = await prisma.academicYear.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
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
      "Academic year not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found.isActive)
    throw new BadRequestException(
      "لا يمكن حذف السنة الجامعية النشطة. فعِّل سنة أخرى أولاً.",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  const blockers: string[] = [];
  if (found._count.students > 0) blockers.push(`${found._count.students} طالب`);
  if (found._count.topics > 0) blockers.push(`${found._count.topics} موضوع`);
  if (blockers.length)
    throw new BadRequestException(
      `لا يمكن حذف السنة الجامعية لارتباطها بـ ${blockers.join(" و ")}.`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  await prisma.academicYear.delete({ where: { id } });
  return { message: "Academic year deleted" };
};

//
// ════════ TOPICS ════════
//
export const listTopicsService = async (q: ListTopicsDTO) => {
  const where: Record<string, unknown> = {};
  if (q.status) where.status = q.status;
  if (q.professorId) where.professorId = q.professorId;
  if (q.academicYearId) where.academicYearId = q.academicYearId;
  if (q.specializationId) where.specializationId = q.specializationId;
  else if (q.filiereId) where.specialization = { filiereId: q.filiereId };
  else if (q.departmentId)
    where.specialization = { filiere: { departmentId: q.departmentId } };
  else if (q.facultyId)
    where.specialization = {
      filiere: { department: { facultyId: q.facultyId } },
    };
  if (q.search) {
    where.OR = [
      { title: { contains: q.search } },
      { description: { contains: q.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.graduationTopic.findMany({
      where,
      include: {
        professor: { include: { user: { select: userSelect } } },
        specialization: true,
        academicYear: true,
        _count: { select: { groupRequests: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.graduationTopic.count({ where }),
  ]);

  return { items, total, page: q.page, limit: q.limit };
};

export const getTopicByIdService = async (id: string) => {
  const topic = await prisma.graduationTopic.findUnique({
    where: { id },
    include: {
      professor: { include: { user: { select: userSelect } } },
      specialization: true,
      academicYear: true,
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
    },
  });
  if (!topic)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return topic;
};

const setTopicStatus = async (
  id: string,
  status: string,
  rejectionReason?: string | null,
) => {
  const found = await prisma.graduationTopic.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.graduationTopic.update({
    where: { id },
    data: {
      status: status as never,
      // Persist the reason on reject; clear it otherwise.
      rejectionReason: status === "rejected" ? (rejectionReason ?? null) : null,
    },
  });
};

export const approveTopicService = async (id: string) => {
  const topic = await setTopicStatus(id, "approved");
  const userId = await getTopicProfessorUserId(topic.id);
  if (userId)
    await createNotification({
      userId,
      type: "topic_approved",
      title: "تمت الموافقة على موضوعك",
      message: `تمت الموافقة على الموضوع: «${topic.title}».`,
      link: "/professor/topics",
    });
  return topic;
};

export const archiveTopicService = (id: string) =>
  setTopicStatus(id, "archived");

export const unarchiveTopicService = async (id: string) => {
  const found = await prisma.graduationTopic.findUnique({
    where: { id },
    include: { projectGroup: { select: { id: true } } },
  });
  if (!found)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found.status !== "archived")
    throw new BadRequestException(
      "لا يمكن إلغاء الأرشفة إلا لموضوع مؤرشف",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  // إن كان للموضوع مجموعة طلبة فهو مكتمل؛ وإلا يعود «معتمداً».
  return prisma.graduationTopic.update({
    where: { id },
    data: { status: found.projectGroup ? "full" : "approved" },
  });
};

export const deleteTopicService = async (id: string) => {
  const topic = await prisma.graduationTopic.findUnique({
    where: { id },
    include: { projectGroup: { select: { id: true } } },
  });
  if (!topic)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // حارس: لا يُحذف موضوع تشكّلت له مجموعة مشروع — يُؤرشَف بدلاً من ذلك.
  if (topic.projectGroup)
    throw new BadRequestException(
      "لا يمكن حذف موضوع تشكّلت له مجموعة مشروع؛ أرشفه بدلاً من ذلك.",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.$transaction(async (tx) => {
    // التطبيقات الفردية (لا cascade على علاقة الموضوع).
    await tx.topicApplication.deleteMany({ where: { topicId: id } });
    // طلبات الفرق (أعضاؤها يُحذفون تلقائياً عبر cascade على GroupRequestMember).
    await tx.groupRequest.deleteMany({ where: { topicId: id } });
    // وأخيراً الموضوع نفسه.
    await tx.graduationTopic.delete({ where: { id } });
  });

  return { message: "Topic deleted" };
};

export const rejectTopicService = async (id: string, data: RejectTopicDTO) => {
  const topic = await setTopicStatus(id, "rejected", data.reason);
  const userId = await getTopicProfessorUserId(topic.id);
  if (userId)
    await createNotification({
      userId,
      type: "topic_rejected",
      title: "تم رفض موضوعك",
      message: data.reason
        ? `تم رفض الموضوع «${topic.title}». السبب: ${data.reason}`
        : `تم رفض الموضوع «${topic.title}».`,
      link: "/professor/topics",
    });
  return topic;
};

// ─── PUBLISH / UNPUBLISH (two-stage admin flow) ───────────────
// approve = initial acceptance (quality OK) but NOT visible publicly.
// publish = move approved → open, which makes it appear on the public
// landing page and opens it for student requests.
export const publishTopicService = async (id: string) => {
  const found = await prisma.graduationTopic.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  // Only an approved topic may be published.
  if (found.status !== "approved")
    throw new BadRequestException(
      "يجب قبول الموضوع أوّلاً قبل نشره",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return prisma.graduationTopic.update({
    where: { id },
    data: { status: "open" },
  });
};

// Pull a published topic back to approved-but-hidden (only if no group has
// formed yet, i.e. it's still "open", not "full").
export const unpublishTopicService = async (id: string) => {
  const found = await prisma.graduationTopic.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (found.status !== "open")
    throw new BadRequestException(
      "لا يمكن إلغاء النشر إلا لموضوع منشور ولم تُشكّل له مجموعة",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return prisma.graduationTopic.update({
    where: { id },
    data: { status: "approved" },
  });
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

  const where = and.length > 0 ? { AND: and } : {};

  // "Defence soonest" has to put groups that have one first; Prisma sorts
  // nulls last on a descending relation order, so ascending date with the
  // relation is the closest honest ordering.
  const orderBy =
    q.sort === "oldest"
      ? ({ createdAt: "asc" } as const)
      : q.sort === "defenseSoon"
        ? ({ defense: { date: "asc" } } as const)
        : ({ createdAt: "desc" } as const);

  /** The active filter plus one more condition, for the summary counts. */
  const narrowed = (extra: Record<string, unknown>) => ({
    AND: [...and, extra],
  });

  // The summary is computed over the *filtered* set, not the whole table, so
  // the tiles always describe the grid underneath them. They are counts, not
  // a second page of rows, so they cost four cheap aggregates.
  const [items, total, defenseScheduled, defenseDone, noDefense, withOverdue] =
    await Promise.all([
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
          members: {
            include: { student: { include: { user: { select: userSelect } } } },
          },
          _count: { select: { milestones: true } },
          defense: true,
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
        where: narrowed({ milestones: { some: { status: "overdue" } } }),
      }),
    ]);

  // Progress is the point of this page, and a bare milestone count cannot
  // express it. One grouped query covers the whole page rather than one
  // query per project.
  const ids = items.map((p) => p.id);
  const grouped = ids.length
    ? await prisma.milestone.groupBy({
        by: ["groupId", "status"],
        where: { groupId: { in: ids } },
        _count: { _all: true },
      })
    : [];

  const progressByGroup = new Map<
    string,
    { total: number; completed: number; overdue: number }
  >();
  for (const id of ids)
    progressByGroup.set(id, { total: 0, completed: 0, overdue: 0 });

  for (const row of grouped) {
    const acc = progressByGroup.get(row.groupId);
    if (!acc) continue;
    const n = row._count._all;
    acc.total += n;
    if (row.status === "completed") acc.completed += n;
    if (row.status === "overdue") acc.overdue += n;
  }

  return {
    items: items.map((p) => ({
      ...p,
      progress: progressByGroup.get(p.id) ?? {
        total: 0,
        completed: 0,
        overdue: 0,
      },
    })),
    total,
    stats: {
      total,
      defenseScheduled,
      defenseDone,
      noDefense,
      withOverdue,
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
          professor: { include: { user: { select: userSelect } } },
          specialization: { include: { filiere: { include: { department: true } } } },
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
        // The count is enough to show "3 submissions" without shipping every
        // file record to a page that only summarises them.
        include: { _count: { select: { submissions: true } } },
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
      "Project not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return group;
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
      "Project not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const prof = await prisma.professor.findUnique({
    where: { id: data.professorId },
  });
  if (!prof)
    throw new NotFoundException(
      "Professor not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  await prisma.graduationTopic.update({
    where: { id: group.topicId },
    data: { professorId: data.professorId },
  });
  return getProjectByIdService(id);
};

export const assignStudentService = async (
  id: string,
  data: AssignStudentDTO,
) => {
  const group = await prisma.projectGroup.findUnique({ where: { id } });
  if (!group)
    throw new NotFoundException(
      "Project not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
  });
  if (!student)
    throw new NotFoundException(
      "Student not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const existing = await prisma.projectMember.findUnique({
    where: { groupId_studentId: { groupId: id, studentId: data.studentId } },
  });
  if (existing)
    throw new BadRequestException(
      "Student already in this project",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.projectMember.create({
    data: { groupId: id, studentId: data.studentId },
  });
  return getProjectByIdService(id);
};

export const removeProjectMemberService = async (
  groupId: string,
  studentId: string,
) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: { members: { select: { studentId: true } } },
  });
  if (!group)
    throw new NotFoundException(
      "Project not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (!group.members.some((m) => m.studentId === studentId))
    throw new BadRequestException(
      "الطالب ليس عضواً في هذا المشروع",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const remaining = group.members.length - 1;

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.delete({
      where: { groupId_studentId: { groupId, studentId } },
    });
    if (remaining === 0) {
      // آخر طالب → فُكّ المجموعة وأعِد الموضوع «معتمداً» ليصبح قابلاً للحذف/الأرشفة.
      await tx.projectGroup.delete({ where: { id: groupId } });
      await tx.graduationTopic.update({
        where: { id: group.topicId },
        data: { status: "approved" },
      });
    }
  });

  return { remaining, dissolved: remaining === 0, topicId: group.topicId };
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
      "Project not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return group;
};

export const listGroupMilestonesService = async (
  groupId: string,
  q: ListMilestonesDTO = {},
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
    include: { _count: { select: { submissions: true } } },
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
  await notifySupervisorOfMilestone(groupId, "أضافت الإدارة مرحلة جديدة");

  return milestone;
};

export const updateGroupMilestoneService = async (
  id: string,
  data: AdminUpdateMilestoneDTO,
) => {
  const existing = await prisma.milestone.findUnique({ where: { id } });
  if (!existing)
    throw new NotFoundException(
      "Milestone not found",
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
    "عدّلت الإدارة مرحلة في مشروعكم",
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
      "Milestone not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // Deleting would cascade away work the students already handed in. Refuse
  // and say so, rather than destroying submissions as a side effect.
  if (existing._count.submissions > 0)
    throw new BadRequestException(
      "لا يمكن حذف مرحلة تحتوي على تسليمات؛ احذف التسليمات أولاً.",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.milestone.delete({ where: { id } });
  await notifySupervisorOfMilestone(
    existing.groupId,
    "حذفت الإدارة مرحلة من مشروعكم",
  );

  return { message: "Milestone deleted" };
};

/** Tells the supervising professor that administration touched the timeline. */
const notifySupervisorOfMilestone = async (groupId: string, title: string) => {
  try {
    const group = await prisma.projectGroup.findUnique({
      where: { id: groupId },
      select: {
        topic: {
          select: { title: true, professor: { select: { userId: true } } },
        },
      },
    });
    const userId = group?.topic?.professor?.userId;
    if (!userId) return;

    await createNotification({
      userId,
      type: "general",
      title,
      message: `المشروع: «${group?.topic?.title ?? ""}».`,
      link: "/professor/projects",
    });
  } catch {
    // A notification must never fail the write it is reporting.
  }
};

//
// ════════ DEFENSES ════════
//
export const listDefensesService = async (q: ListQueryDTO) => {
  const [items, total] = await Promise.all([
    prisma.defense.findMany({
      include: {
        group: {
          include: {
            topic: true,
            members: {
              include: {
                student: { include: { user: { select: userSelect } } },
              },
            },
          },
        },
        committee: {
          include: { professor: { include: { user: { select: userSelect } } } },
        },
      },
      orderBy: { date: "asc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.defense.count(),
  ]);
  return { items, total, page: q.page, limit: q.limit };
};

export const createDefenseService = async (data: CreateDefenseDTO) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: data.groupId },
  });
  if (!group)
    throw new NotFoundException(
      "Project not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const exists = await prisma.defense.findUnique({
    where: { groupId: data.groupId },
  });
  if (exists)
    throw new BadRequestException(
      "Defense already scheduled for this project",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  return prisma.defense.create({
    data: {
      groupId: data.groupId,
      date: new Date(data.date),
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
};

export const updateDefenseService = async (
  id: string,
  data: UpdateDefenseDTO,
) => {
  const found = await prisma.defense.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Defense not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // If a committee list is provided, replace the existing one wholesale.
  if (data.committee) {
    await prisma.defenseCommitteeMember.deleteMany({
      where: { defenseId: id },
    });
  }

  return prisma.defense.update({
    where: { id },
    data: {
      date: data.date ? new Date(data.date) : undefined,
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
        include: { professor: { include: { user: { select: userSelect } } } },
      },
    },
  });
};

export const deleteDefenseService = async (id: string) => {
  const found = await prisma.defense.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Defense not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  await prisma.defense.delete({ where: { id } });
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
      "Group request not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (request.status === "accepted")
    throw new BadRequestException(
      "لا يمكن تعديل الأعضاء بعد الموافقة",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (request.leaderStudentId === studentId)
    throw new BadRequestException(
      "لا يمكن إزالة المرسِل؛ غيّر المرسِل أولاً",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  const member = request.members.find((m) => m.studentId === studentId);
  if (!member)
    throw new BadRequestException(
      "الطالب ليس عضواً في هذا الطلب",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (request.members.length <= 1)
    throw new BadRequestException(
      "لا يمكن ترك الطلب بلا أعضاء",
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
      "Group request not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (request.status === "accepted")
    throw new BadRequestException(
      "لا يمكن تغيير المرسِل بعد الموافقة",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (!request.members.some((m) => m.studentId === studentId))
    throw new BadRequestException(
      "المرسِل يجب أن يكون أحد الأعضاء",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  await prisma.groupRequest.update({
    where: { id: requestId },
    data: { leaderStudentId: studentId },
  });
  return getGroupRequestService(requestId);
};

export const listGroupRequestsService = async (q: ListQueryDTO) => {
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

  const where: Record<string, unknown> = {};

  if (statusFilter && statusFilter !== "all") where.status = statusFilter;

  if (q.search) {
    where.OR = [
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
  if (Object.keys(topicWhere).length > 0) where.topic = topicWhere;

  // مدى التاريخ
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.groupRequest.findMany({
      where,
      include: {
        topic: {
          include: {
            professor: { include: { user: { select: userSelect } } },
            specialization: true,
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
  ]);
  return { items, total, page: q.page, limit: q.limit };
};

export const getGroupRequestService = async (id: string) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id },
    include: {
      topic: {
        include: {
          professor: { include: { user: { select: userSelect } } },
          specialization: true,
          academicYear: true,
        },
      },
      leader: { include: { user: { select: userSelect } } },
      members: {
        include: { student: { include: { user: { select: userSelect } } } },
      },
    },
  });
  if (!request)
    throw new NotFoundException(
      "Group request not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return request;
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
      "Group request not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (request.status === "accepted")
    throw new BadRequestException(
      "Request is already accepted",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const topic = request.topic;
  if (
    topic.status !== "approved" &&
    topic.status !== "open" &&
    topic.status !== "full"
  )
    throw new BadRequestException(
      "هذا الموضوع لم يعد متاحاً (تمّت معالجته بالفعل)",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (topic.projectGroup)
    throw new BadRequestException(
      "تمّت الموافقة على مجموعة لهذا الموضوع بالفعل",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  if (request.members.length > topic.maxStudents)
    throw new BadRequestException(
      `عدد الأعضاء يتجاوز الحد الأقصى للموضوع (${topic.maxStudents})`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.graduationTopic.findUnique({
      where: { id: topic.id },
      include: { projectGroup: true },
    });
    if (
      !fresh ||
      (fresh.status !== "approved" &&
        fresh.status !== "open" &&
        fresh.status !== "full")
    )
      throw new BadRequestException(
        "هذا الموضوع لم يعد متاحاً",
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    if (fresh.projectGroup)
      throw new BadRequestException(
        "تمّت الموافقة على مجموعة أخرى لهذا الموضوع بالفعل",
        ErrorCodeEnum.VALIDATION_ERROR,
      );

    const group = await tx.projectGroup.create({
      data: { topicId: topic.id },
    });

    await tx.projectMember.createMany({
      data: request.members.map((m) => ({
        groupId: group.id,
        studentId: m.studentId,
      })),
      skipDuplicates: true,
    });

    const updated = await tx.groupRequest.update({
      where: { id: request.id },
      data: { status: "accepted" },
    });

    await tx.graduationTopic.update({
      where: { id: topic.id },
      data: { status: "full" },
    });

    await tx.groupRequest.updateMany({
      where: { topicId: topic.id, status: "pending", id: { not: request.id } },
      data: { status: "rejected" },
    });

    return updated;
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
      title: "تمت الموافقة على مجموعتكم",
      message: `تمت الموافقة على مجموعتكم لموضوع: «${topic.title}».`,
      link: "/student/project",
    });
  }

  return result;
};

export const rejectGroupRequestService = async (
  id: string,
  rejectionReason?: string,
) => {
  const request = await prisma.groupRequest.findUnique({
    where: { id },
    include: { topic: true },
  });
  if (!request)
    throw new NotFoundException(
      "Group request not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // نلتقط بيانات الإشعار قبل الحذف.
  const leaderUserId = await getStudentUserId(request.leaderStudentId);
  const topicId = request.topicId;

  await prisma.$transaction(async (tx) => {
    // إن كان الموضوع محجوزاً (full) ولم تبقَ مجموعة ولا طلب نشط آخر → أعِده مفتوحاً.
    if (request.topic.status === "full") {
      const projectGroup = await tx.projectGroup.findUnique({
        where: { topicId },
      });
      const otherActive = await tx.groupRequest.findFirst({
        where: {
          topicId,
          status: { in: ["pending", "accepted"] },
          id: { not: id },
        },
      });
      if (!projectGroup && !otherActive) {
        await tx.graduationTopic.update({
          where: { id: topicId },
          data: { status: "open" },
        });
      }
    }

    // احذف الطلب — أعضاؤه (GroupRequestMember) يُحذفون تلقائياً بالـ cascade ⇒ الطلاب يعودون إلى 0.
    await tx.groupRequest.delete({ where: { id } });
  });

  // أعلِم مرسِل الفريق بالرفض.
  if (leaderUserId)
    await createNotification({
      userId: leaderUserId,
      type: "general",
      title: "تم رفض طلب مجموعتكم",
      message: rejectionReason
        ? `تم رفض طلب مجموعتكم. السبب: ${rejectionReason}`
        : "تم رفض طلب مجموعتكم على الموضوع.",
      link: "/student/requests",
    });

  return { id, topicId, deleted: true };
};
