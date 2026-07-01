import { prisma } from "../../core/prisma/client";
import bcrypt from "bcryptjs";
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
  CreateDomainDTO,
  UpdateDomainDTO,
} from "./admin.validation";
import { Role } from "../../generated/prisma";
import { createNotification } from "../notification/notification.service";

const SALT_ROUNDS = 10;

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
    pendingApplications,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.professor.count(),
    prisma.graduationTopic.count(),
    prisma.graduationTopic.count({ where: { status: "approved" } }),
    prisma.projectGroup.count(),
    prisma.defense.count(),
    prisma.topicApplication.count({ where: { status: "pending" } }),
  ]);

  return {
    students,
    professors,
    topics,
    approvedTopics,
    projects,
    defenses,
    pendingApplications,
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
    pendingApplications,
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
    prisma.topicApplication.count({ where: { status: "pending" } }),
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
        applications: { none: {} },
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
      pendingApplications,
      pendingGroupRequests,
      pendingRequests: pendingApplications + pendingGroupRequests,
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

//
// ════════ USERS ════════
//
export const listUsersService = async (q: ListUsersDTO) => {
  const where: Record<string, unknown> = {};
  if (q.role) where.role = q.role;
  if (q.status) where.status = q.status;
  if (q.search) {
    where.OR = [
      { firstName: { contains: q.search, mode: "insensitive" } },
      { lastName: { contains: q.search, mode: "insensitive" } },
      { email: { contains: q.search, mode: "insensitive" } },
      { username: { contains: q.search, mode: "insensitive" } },
    ];
  }

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

  if (q.search) {
    where.OR = [
      { registrationNumber: { contains: q.search, mode: "insensitive" } },
      { user: { firstName: { contains: q.search, mode: "insensitive" } } },
      { user: { lastName: { contains: q.search, mode: "insensitive" } } },
    ];
  }

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
      // Individual topic applications (with the topic + its status).
      applications: {
        orderBy: { priority: "asc" },
        include: {
          topic: {
            select: {
              id: true,
              title: true,
              status: true,
              professor: { include: { user: { select: userSelect } } },
            },
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
    updateData.specializationId = data.specializationId;
  if (data.academicYearId !== undefined)
    updateData.academicYearId = data.academicYearId;

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

  if (q.search) {
    where.OR = [
      { employeeNumber: { contains: q.search, mode: "insensitive" } },
      { universityEmail: { contains: q.search, mode: "insensitive" } },
      { user: { firstName: { contains: q.search, mode: "insensitive" } } },
      { user: { lastName: { contains: q.search, mode: "insensitive" } } },
    ];
  }

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
          _count: { select: { applications: true } },
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

export const createProfessorService = async (data: CreateProfessorDTO) => {
  const exists = await prisma.professor.findFirst({
    where: {
      OR: [
        { employeeNumber: data.employeeNumber },
        { universityEmail: data.universityEmail },
      ],
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
      employeeNumber: data.employeeNumber,
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
  if (data.universityEmail !== undefined)
    updateData.universityEmail = data.universityEmail;
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
  return prisma.faculty.findMany({
    include: { _count: { select: { departments: true } } },
    orderBy: { createdAt: "desc" },
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
    include: { department: true },
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
  return prisma.department.findMany({
    include: {
      faculty: true,
      _count: { select: { filieres: true, professors: true, domains: true } },
    },
    orderBy: { createdAt: "desc" },
  });
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
  if (q.specializationId) where.specializationId = q.specializationId;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: "insensitive" } },
      { description: { contains: q.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.graduationTopic.findMany({
      where,
      include: {
        professor: { include: { user: { select: userSelect } } },
        specialization: true,
        academicYear: true,
        _count: { select: { applications: true } },
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
      applications: {
        include: { student: { include: { user: { select: userSelect } } } },
      },
      projectGroup: true,
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
export const listApplicationsService = async (q: ListQueryDTO) => {
  const statusFilter = (q as { status?: string }).status;
  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all") where.status = statusFilter;
  if (q.search) {
    where.OR = [
      { topic: { title: { contains: q.search, mode: "insensitive" } } },
      {
        student: {
          registrationNumber: { contains: q.search, mode: "insensitive" },
        },
      },
      {
        student: {
          user: { firstName: { contains: q.search, mode: "insensitive" } },
        },
      },
      {
        student: {
          user: { lastName: { contains: q.search, mode: "insensitive" } },
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.topicApplication.findMany({
      where,
      include: {
        student: { include: { user: { select: userSelect } } },
        topic: {
          include: { professor: { include: { user: { select: userSelect } } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.topicApplication.count({ where }),
  ]);
  return { items, total, page: q.page, limit: q.limit };
};

// ─── ACCEPT APPLICATION (admin decision) ──────────────────────
export const acceptApplicationService = async (applicationId: string) => {
  const application = await prisma.topicApplication.findUnique({
    where: { id: applicationId },
    include: {
      topic: { include: { projectGroup: { include: { members: true } } } },
    },
  });
  if (!application)
    throw new NotFoundException(
      "Application not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (application.status === "accepted")
    throw new BadRequestException(
      "Application is already accepted",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const topic = application.topic;
  const currentMembers = topic.projectGroup?.members.length ?? 0;
  if (currentMembers >= topic.maxStudents)
    throw new BadRequestException(
      "This topic is already full",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const result = await prisma.$transaction(async (tx) => {
    const group =
      topic.projectGroup ??
      (await tx.projectGroup.create({ data: { topicId: topic.id } }));

    await tx.projectMember.upsert({
      where: {
        groupId_studentId: {
          groupId: group.id,
          studentId: application.studentId,
        },
      },
      create: { groupId: group.id, studentId: application.studentId },
      update: {},
    });

    const updated = await tx.topicApplication.update({
      where: { id: application.id },
      data: { status: "accepted" },
    });

    const memberCount = await tx.projectMember.count({
      where: { groupId: group.id },
    });
    if (memberCount >= topic.maxStudents) {
      await tx.graduationTopic.update({
        where: { id: topic.id },
        data: { status: "full" },
      });
      await tx.topicApplication.updateMany({
        where: { topicId: topic.id, status: "pending" },
        data: { status: "rejected" },
      });
    }

    return updated;
  });

  // إشعار الطالب بقبول طلبه.
  const studentUserId = await getStudentUserId(application.studentId);
  if (studentUserId)
    await createNotification({
      userId: studentUserId,
      type: "application_accepted",
      title: "تم قبول طلبك",
      message: `تم قبولك في الموضوع: «${topic.title}».`,
      link: "/student/applications",
    });

  return result;
};

// ─── REJECT APPLICATION (admin decision) ──────────────────────
export const rejectApplicationService = async (
  applicationId: string,
  rejectionReason?: string,
) => {
  const application = await prisma.topicApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application)
    throw new NotFoundException(
      "Application not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  if (application.status === "rejected")
    throw new BadRequestException(
      "Application is already rejected",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const updated = await prisma.topicApplication.update({
    where: { id: applicationId },
    data: {
      status: "rejected",
      ...(rejectionReason !== undefined ? { rejectionReason } : {}),
    },
  });

  const userId = await getStudentUserId(application.studentId);
  if (userId)
    await createNotification({
      userId,
      type: "application_rejected",
      title: "تم رفض طلبك",
      message: rejectionReason
        ? `تم رفض طلبك. السبب: ${rejectionReason}`
        : "تم رفض طلبك على الموضوع.",
      link: "/student/applications",
    });

  return updated;
};

//
// ════════ PROJECTS (groups) ════════
//
export const listProjectsService = async (q: ListQueryDTO) => {
  const [items, total] = await Promise.all([
    prisma.projectGroup.findMany({
      include: {
        topic: {
          include: { professor: { include: { user: { select: userSelect } } } },
        },
        members: {
          include: { student: { include: { user: { select: userSelect } } } },
        },
        _count: { select: { milestones: true } },
        defense: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.projectGroup.count(),
  ]);
  return { items, total, page: q.page, limit: q.limit };
};

export const getProjectByIdService = async (id: string) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id },
    include: {
      topic: {
        include: {
          professor: { include: { user: { select: userSelect } } },
          specialization: true,
        },
      },
      members: {
        include: { student: { include: { user: { select: userSelect } } } },
      },
      milestones: { orderBy: { order: "asc" } },
      defense: true,
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

//
// ════════ MILESTONES (read-only) ════════
//
export const listGroupMilestonesService = async (groupId: string) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
  });
  if (!group)
    throw new NotFoundException(
      "Project not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  return prisma.milestone.findMany({
    where: { groupId },
    orderBy: { order: "asc" },
  });
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
export const listGroupRequestsService = async (q: ListQueryDTO) => {
  const statusFilter = (q as { status?: string }).status;
  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all") where.status = statusFilter;
  if (q.search) {
    where.OR = [
      { topic: { title: { contains: q.search, mode: "insensitive" } } },
      {
        leader: {
          registrationNumber: { contains: q.search, mode: "insensitive" },
        },
      },
      {
        leader: {
          user: { firstName: { contains: q.search, mode: "insensitive" } },
        },
      },
      {
        leader: {
          user: { lastName: { contains: q.search, mode: "insensitive" } },
        },
      },
    ];
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
  if (request.status === "rejected")
    throw new BadRequestException(
      "Request is already rejected",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.groupRequest.update({
      where: { id },
      data: {
        status: "rejected",
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      },
    });

    if (request.topic.status === "full") {
      const projectGroup = await tx.projectGroup.findUnique({
        where: { topicId: request.topicId },
      });
      const otherActive = await tx.groupRequest.findFirst({
        where: {
          topicId: request.topicId,
          status: { in: ["pending", "accepted"] },
          id: { not: id },
        },
      });
      if (!projectGroup && !otherActive) {
        await tx.graduationTopic.update({
          where: { id: request.topicId },
          data: { status: "open" },
        });
      }
    }

    return updated;
  });

  // إشعار قائد الفريق برفض الطلب.
  const leaderUserId = await getStudentUserId(request.leaderStudentId);
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

  return result;
};
