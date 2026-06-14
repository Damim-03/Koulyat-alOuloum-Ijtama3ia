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
} from "./admin.validation";
import { Role } from "../../generated/prisma";

const SALT_ROUNDS = 10;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
  role: true,
  status: true,
  isVerified: true,
  lastLoginAt: true,
  createdAt: true,
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

export const getUserByIdService = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      student: { select: { id: true, registrationNumber: true } },
      professor: {
        select: { id: true, employeeNumber: true, universityEmail: true },
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
  await getUserByIdService(id);
  await prisma.user.delete({ where: { id } });
  return { message: "User deleted" };
};

//
// ════════ STUDENTS ════════
//
export const listStudentsService = async (q: ListStudentsDTO) => {
  const where: Record<string, unknown> = {};
  if (q.specializationId) where.specializationId = q.specializationId;
  if (q.academicYearId) where.academicYearId = q.academicYearId;
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
        specialization: true,
        academicYear: true,
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
      user: { select: userSelect },
      specialization: true,
      academicYear: true,
      applications: { include: { topic: true } },
      projectMembers: { include: { group: { include: { topic: true } } } },
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

  const updateData: Record<string, unknown> = {};
  if (data.specializationId !== undefined)
    updateData.specializationId = data.specializationId;
  if (data.academicYearId !== undefined)
    updateData.academicYearId = data.academicYearId;
  if (data.firstName !== undefined || data.lastName !== undefined) {
    updateData.user = {
      update: { firstName: data.firstName, lastName: data.lastName },
    };
  }

  const student = await prisma.student.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: userSelect },
      specialization: true,
      academicYear: true,
    },
  });
  return student;
};

export const deleteStudentService = async (id: string) => {
  const student = await getStudentByIdService(id);
  await prisma.student.delete({ where: { id } });
  await prisma.user.delete({ where: { id: student.userId } });
  return { message: "Student deleted" };
};

//
// ════════ PROFESSORS ════════
//
export const listProfessorsService = async (q: ListQueryDTO) => {
  const where: Record<string, unknown> = {};
  if (q.search) {
    where.OR = [
      { employeeNumber: { contains: q.search, mode: "insensitive" } },
      { universityEmail: { contains: q.search, mode: "insensitive" } },
      { user: { firstName: { contains: q.search, mode: "insensitive" } } },
      { user: { lastName: { contains: q.search, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.professor.findMany({
      where,
      include: {
        user: { select: userSelect },
        department: true,
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
      user: { select: userSelect },
      department: true,
      topics: true,
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
    updateData.departmentId = data.departmentId;
  if (data.firstName !== undefined || data.lastName !== undefined) {
    updateData.user = {
      update: { firstName: data.firstName, lastName: data.lastName },
    };
  }

  const professor = await prisma.professor.update({
    where: { id },
    data: updateData,
    include: { user: { select: userSelect }, department: true },
  });
  return professor;
};

export const deleteProfessorService = async (id: string) => {
  const professor = await getProfessorByIdService(id);
  await prisma.professor.delete({ where: { id } });
  await prisma.user.delete({ where: { id: professor.userId } });
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
  const found = await prisma.faculty.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Faculty not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  await prisma.faculty.delete({ where: { id } });
  return { message: "Faculty deleted" };
};

//
// ════════ DEPARTMENTS ════════
//
export const listDepartmentsService = async () => {
  return prisma.department.findMany({
    include: {
      faculty: true,
      _count: { select: { specializations: true, professors: true } },
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
  const found = await prisma.department.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Department not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  await prisma.department.delete({ where: { id } });
  return { message: "Department deleted" };
};

//
// ════════ SPECIALIZATIONS ════════
//
export const listSpecializationsService = async () => {
  return prisma.specialization.findMany({
    include: {
      department: true,
      _count: { select: { students: true, topics: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const createSpecializationService = async (
  data: CreateSpecializationDTO,
) => {
  return prisma.specialization.create({ data, include: { department: true } });
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
    include: { department: true },
  });
};

export const deleteSpecializationService = async (id: string) => {
  const found = await prisma.specialization.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Specialization not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
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
  const found = await prisma.academicYear.findUnique({ where: { id } });
  if (!found)
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
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

export const approveTopicService = (id: string) =>
  setTopicStatus(id, "approved");
export const archiveTopicService = (id: string) =>
  setTopicStatus(id, "archived");

export const rejectTopicService = async (id: string, data: RejectTopicDTO) => {
  return setTopicStatus(id, "rejected", data.reason);
};

//
// ════════ APPLICATIONS ════════
//
export const listApplicationsService = async (q: ListQueryDTO) => {
  const [items, total] = await Promise.all([
    prisma.topicApplication.findMany({
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
    prisma.topicApplication.count(),
  ]);
  return { items, total, page: q.page, limit: q.limit };
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
