import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { CreateGroupRequestDTO, ListTopicsDTO } from "./student.validation";

//
// ─── resolve the Student row for the logged-in user ───────────
//

const getStudent = async (userId: string) => {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw new NotFoundException(
      "Student not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  return student;
};

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
      status: { in: ["approved", "open"] },
      ...(filters.specializationId
        ? { specializationId: filters.specializationId }
        : {}),
      ...(filters.academicYearId
        ? { academicYearId: filters.academicYearId }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      specialization: true,
      academicYear: true,
      professor: { include: { user: true } },
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
      professor: { include: { user: true } },
    },
  });

  if (!topic) {
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  // Students may only view published topics.
  if (topic.status !== "approved" && topic.status !== "open") {
    throw new UnauthorizedException(
      "This topic is not available",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }
  return topic;
};

//
// ═══════════════════════════════════════════════════════════════
//  GROUP REQUESTS  (the leader assembles a team and submits)
// ═══════════════════════════════════════════════════════════════
//

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
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  if (topic.status !== "approved" && topic.status !== "open") {
    throw new BadRequestException(
      "This topic is not open for requests",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

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

  // Every supplied number must match a real student.
  if (teammates.length !== regNumbers.length) {
    const found = new Set(teammates.map((s) => s.registrationNumber));
    const missing = regNumbers.filter((r) => !found.has(r));
    throw new BadRequestException(
      `أرقام تسجيل غير موجودة: ${missing.join(", ")}`,
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
      `الحد الأقصى لهذا الموضوع ${topic.maxStudents} طلاب`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 5. The leader cannot have already requested this topic.
  const existing = await prisma.groupRequest.findUnique({
    where: {
      leaderStudentId_topicId: {
        leaderStudentId: leader.id,
        topicId: topic.id,
      },
    },
  });
  if (existing) {
    throw new BadRequestException(
      "لقد أرسلت طلباً لهذا الموضوع بالفعل",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 6. None of the members may already be in an accepted group request
  //    for this same topic (prevents double-placement).
  const alreadyPlaced = await prisma.groupRequestMember.findFirst({
    where: {
      studentId: { in: memberStudentIds },
      request: { topicId: topic.id, status: "accepted" },
    },
  });
  if (alreadyPlaced) {
    throw new BadRequestException(
      "أحد الأعضاء منضمٌّ بالفعل إلى مجموعة مقبولة لهذا الموضوع",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 7. Create the request with its members (status forced to pending).
  const request = await prisma.groupRequest.create({
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
      members: { include: { student: { include: { user: true } } } },
    },
  });

  return request;
};

// List the group requests led by this student (their own submissions).
export const getMyGroupRequestsService = async (userId: string) => {
  const student = await getStudent(userId);

  return prisma.groupRequest.findMany({
    where: { leaderStudentId: student.id },
    include: {
      topic: { select: { id: true, title: true, status: true } },
      members: { include: { student: { include: { user: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
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
      "Request not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
  if (request.leaderStudentId !== student.id) {
    throw new UnauthorizedException(
      "You do not own this request",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }
  if (request.status !== "pending") {
    throw new BadRequestException(
      "لا يمكن إلغاء طلب تمت مراجعته",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  await prisma.groupRequest.delete({ where: { id: requestId } });
  return { message: "تم إلغاء الطلب" };
};

//
// ═══════════════════════════════════════════════════════════════
//  MY PROJECT  (after a request is accepted)
// ═══════════════════════════════════════════════════════════════
//

// The project group this student belongs to, with milestones & defense.
export const getMyProjectService = async (userId: string) => {
  const student = await getStudent(userId);

  const membership = await prisma.projectMember.findFirst({
    where: { studentId: student.id },
    include: {
      group: {
        include: {
          topic: {
            include: { professor: { include: { user: true } } },
          },
          members: { include: { student: { include: { user: true } } } },
          milestones: {
            orderBy: { order: "asc" },
            include: { submissions: true },
          },
          defense: true,
        },
      },
    },
  });

  return membership?.group ?? null;
};