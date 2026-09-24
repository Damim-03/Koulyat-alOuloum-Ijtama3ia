import { prisma } from "../../core/prisma/client";
import {
  AVAILABLE_TO_STUDENTS,
  CAP_ATTEMPTS,
} from "../../core/topic/topic-status";
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { CreateGroupRequestDTO, ListTopicsDTO } from "./student.validation";
import { publicUser } from "../../core/prisma/selects";
import { notifyAdminsQuietly } from "../notification/notification.service";

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
      professor: { include: { user: publicUser } },
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
      professor: { include: { user: publicUser } },
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
//  STUDENT LOOKUP  (live teammate search by registration number)
// ═══════════════════════════════════════════════════════════════
//

// Returns the student (id + name) matching a registration number, or
// null if none. Used by the group-request dialog for live validation.
export const lookupStudentByRegistrationService = async (
  userId: string,
  registration: string,
) => {
  await getStudent(userId); // only an authenticated student may search

  const reg = registration.trim();
  if (!reg) {
    throw new BadRequestException(
      "رقم التسجيل مطلوب",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  return prisma.student.findUnique({
    where: { registrationNumber: reg },
    select: {
      id: true,
      registrationNumber: true,
      user: { select: { firstName: true, lastName: true } },
      specialization: { select: { name: true } },
    },
  });
};

//
// ═══════════════════════════════════════════════════════════════
//  GROUP REQUESTS  (the leader assembles a team and submits)
// ═══════════════════════════════════════════════════════════════
//

/**
 * True when a write lost the race for a topic — the unique index on
 * `GroupRequest.activeTopicId` refused it.
 *
 * The index name reaches us in different shapes depending on the driver: as
 * `meta.target` on some, nested under the adapter's error on the MariaDB one.
 * It is always in the message, so both are searched rather than picking one
 * and hoping.
 */
const isReservationClash = (e: unknown) => {
  const err = e as { code?: string; meta?: unknown; message?: string };
  if (err.code !== "P2002") return false;
  return `${JSON.stringify(err.meta ?? "")} ${err.message ?? ""}`.includes(
    "activeTopicId",
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
          ? "طلبك على هذا الموضوع قُبل بالفعل — هو مشروعك."
          : "فريقك مقبولٌ على هذا الموضوع — هو مشروعكم."
        : isLeader
          ? "لك طلبٌ على هذا الموضوع ما يزال بانتظار قرار الإدارة."
          : "أرسل فريقك طلباً على هذا الموضوع، وهو بانتظار قرار الإدارة.",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 1.b الموضوع يُحجز عند أول طلب: امنع أي طلب جديد إن لم يعد متاحاً.
  const available = await prisma.graduationTopic.findFirst({
    where: { id: topic.id, ...AVAILABLE_TO_STUDENTS },
    select: { id: true },
  });
  if (!available) {
    throw new BadRequestException(
      "هذا الموضوع محجوز بالفعل",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 1.c سقفُ المحاولات، إن وضعت الإدارة له سقفاً.
  //
  // ويُعدّ **كلُّ** ما وصل الموضوع لا الحيَّ منه: الفهرسُ الفريد على
  // `activeTopicId` لا يسمح بأكثر من طلبٍ حيٍّ واحد أصلاً، فعدُّ الحيّ
  // يجعل السقف بلا أثر. والمقصود منعُ فريقٍ يُعيد الطلب كلّما رُفض.
  if (topic.maxRequests !== null) {
    const attempts = await prisma.groupRequest.count({
      where: { topicId: topic.id, ...CAP_ATTEMPTS },
    });
    if (attempts >= topic.maxRequests)
      throw new BadRequestException(
        `بلغ هذا الموضوع سقف الطلبات المسموح به (${topic.maxRequests}).`,
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
  // Two teams can still arrive together — the read above cannot prevent
  // that, only give a clear message in the ordinary case. The unique index
  // is what settles it, and this turns its error into the same sentence.
  let request;
  try {
    request = await prisma.groupRequest.create({
    data: {
      topicId: topic.id,
      // Reserves the topic. The read above is only there to give a clear
      // message first; this is what actually settles a race.
      activeTopicId: topic.id,
      leaderStudentId: leader.id,
      priority: data.priority,
      status: "pending",
      members: {
        create: memberStudentIds.map((studentId) => ({ studentId })),
      },
    },
    include: {
      topic: { select: { id: true, title: true } },
      members: { include: { student: { include: { user: publicUser } } } },
    },
    });
  } catch (e) {
    if (isReservationClash(e))
      throw new BadRequestException(
        "هذا الموضوع محجوز بالفعل",
        ErrorCodeEnum.VALIDATION_ERROR,
      );
    throw e;
  }

  // الطلب يحجز الموضوع ويقف بانتظار قرار الإدارة. وكلّما طال انتظاره تعطّل
  // فريقٌ كامل عن موضوعٍ آخر — فالتبليغ هنا ليس ترفاً.
  await notifyAdminsQuietly({
    type: "general",
    title: "طلبُ مجموعة جديد",
    message: `وصل طلبُ مجموعة على موضوع: «${request.topic.title}».`,
    link: "/admin/group-requests",
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
      members: { include: { student: { include: { user: publicUser } } } },
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
            include: { professor: { include: { user: publicUser } } },
          },
          members: { include: { student: { include: { user: publicUser } } } },
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
