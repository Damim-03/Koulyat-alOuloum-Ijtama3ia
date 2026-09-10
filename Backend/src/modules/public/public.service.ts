import { prisma } from "../../core/prisma/client";
import { NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { ListPublicTopicsDTO } from "./public.validation";
import { Prisma } from "../../generated/prisma";

// Public-safe projection of a professor: only the display name, never the
// account/email internals.
const publicProfessorSelect = {
  id: true,
  user: { select: { firstName: true, lastName: true } },
};

//
// ═══════════════════════════════════════════════════════════════
//  BROWSE PUBLISHED TOPICS  (no auth — landing page)
// ═══════════════════════════════════════════════════════════════
//
// Only topics the admin has PUBLISHED are ever exposed publicly:
//   open  → "available" (published, open for requests)
//   full  → "reserved"  (shown, but locked — a group already formed)
// pending / approved (accepted but not yet published) / rejected / archived
// are NEVER returned. "approved" is the initial-acceptance stage and stays
// hidden until the admin publishes it (approved → open).

const VISIBLE_STATUSES = ["open", "full"] as const;

/** الطلب الحيّ هو ما يحجز الموضوع فعلياً — pending أو accepted. */
const LIVE_REQUEST = { status: { in: ["pending", "accepted"] } as never };

/** منشور، ولا مجموعة، ولا طلب حيّ ⇒ يقبل طلباً الآن. */
const PUBLIC_AVAILABLE: Prisma.GraduationTopicWhereInput = {
  status: "open",
  projectGroup: null,
  groupRequests: { none: LIVE_REQUEST },
};

/**
 * ظاهر للعموم لكنه مأخوذ: تشكّلت له مجموعة، أو يحجزه طلب حيّ.
 *
 * كان تبويب «محجوز» يطلب `status = full` **و** «لا طلب حيّ» معاً، وهما لا
 * يجتمعان: كل موضوع اكتمل بطلب يحمل طلباً مقبولاً، فكان التبويب يُخفيه
 * ويُظهر المواضيع المُسنَدة إدارياً وحدها — وهي التي تصل `full` بلا طلب.
 */
const PUBLIC_RESERVED: Prisma.GraduationTopicWhereInput = {
  status: { in: [...VISIBLE_STATUSES] as never },
  OR: [
    { projectGroup: { isNot: null } },
    { groupRequests: { some: LIVE_REQUEST } },
  ],
};

export const listPublicTopicsService = async (q: ListPublicTopicsDTO) => {
  // تُجمع الشروط بـ AND صريح: التبويب «محجوز» يحتاج OR داخلياً، ولو تُرك
  // مسطّحاً لابتلع OR الخاص بالبحث.
  const and: Prisma.GraduationTopicWhereInput[] = [];

  if (q.availability === "available") and.push(PUBLIC_AVAILABLE);
  else if (q.availability === "reserved") and.push(PUBLIC_RESERVED);
  else and.push({ status: { in: [...VISIBLE_STATUSES] as never } });

  if (q.specializationId) and.push({ specializationId: q.specializationId });
  // Filter by department through topic → specialization → filiere → department.
  if (q.departmentId)
    and.push({ specialization: { filiere: { departmentId: q.departmentId } } });
  if (q.academicYearId) and.push({ academicYearId: q.academicYearId });
  if (q.search)
    and.push({
      OR: [
        { title: { contains: q.search } },
        { description: { contains: q.search } },
      ],
    });

  const where: Prisma.GraduationTopicWhereInput = { AND: and };

  const [rows, total] = await Promise.all([
    prisma.graduationTopic.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        maxStudents: true,
        createdAt: true,
        specialization: { select: { id: true, name: true } },
        academicYear: { select: { id: true, title: true } },
        professor: { select: publicProfessorSelect },
        // الإشغال يُقرأ من صفوفه لا من `status`. المعرّفات لا تُعاد إلى
        // العميل — تُستهلك أدناه ثم تُسقَط من الحمولة العامّة.
        projectGroup: { select: { id: true } },
        groupRequests: { where: LIVE_REQUEST, select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.graduationTopic.count({ where }),
  ]);

  // زرّ «تقدَّم» يعتمد على الإشغال الحقيقي، لا على الحالة وحدها.
  const items = rows.map(({ projectGroup, groupRequests, ...t }) => ({
    ...t,
    isAvailable:
      t.status === "open" && !projectGroup && groupRequests.length === 0,
    isReserved: !!projectGroup || groupRequests.length > 0,
  }));

  return { items, total, page: q.page, limit: q.limit };
};

// Public single-topic detail. Mirrors the list visibility rules: a topic that
// is not published returns 404 (we don't reveal pending/rejected topics).
export const getPublicTopicService = async (id: string) => {
  const topic = await prisma.graduationTopic.findFirst({
    where: { id, status: { in: [...VISIBLE_STATUSES] as never } },
    // The lists hide a reserved topic; a saved or shared link still reaches
    // it, so the answer has to say it is taken rather than let the page
    // claim it is free and the request fail later.
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      maxStudents: true,
      requirements: true,
      objectives: true,
      // references: true,  // ← فعّله بعد إضافة عمود references + migration
      createdAt: true,
      specialization: { select: { id: true, name: true } },
      academicYear: { select: { id: true, title: true } },
      professor: { select: publicProfessorSelect },
    },
  });
  if (!topic)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // المُسنَد إدارياً يصل `full` بلا طلب، فالمجموعة وحدها تكفي لاعتباره محجوزاً.
  const [liveRequest, group] = await Promise.all([
    prisma.groupRequest.findFirst({
      where: { topicId: id, ...LIVE_REQUEST },
      select: { id: true },
    }),
    prisma.projectGroup.findUnique({
      where: { topicId: id },
      select: { id: true },
    }),
  ]);
  const reserved = !!liveRequest || !!group;

  return {
    ...topic,
    isAvailable: topic.status === "open" && !reserved,
    isReserved: reserved,
  };
};

// Specializations list for the filter dropdown (public, minimal fields).
// Optionally scoped to one department, so the UI can show only that
// department's specializations when a department is selected.
export const listPublicSpecializationsService = async (
  departmentId?: string,
) => {
  const rows = await prisma.specialization.findMany({
    where: departmentId ? { filiere: { departmentId } } : undefined,
    select: {
      id: true,
      name: true,
      filiere: { select: { departmentId: true } },
    },
    orderBy: { name: "asc" },
  });
  // احتفظ بنفس شكل المخرجات السابق للواجهة: { id, name, departmentId }
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    departmentId: s.filiere.departmentId,
  }));
};

// Departments list for the filter dropdown (public, minimal fields).
export const listPublicDepartmentsService = async () => {
  return prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
};
