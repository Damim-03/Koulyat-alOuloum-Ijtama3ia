import { prisma } from "../../core/prisma/client";
import { NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { ListPublicTopicsDTO } from "./public.validation";

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

export const listPublicTopicsService = async (q: ListPublicTopicsDTO) => {
  // Map the availability filter onto concrete statuses.
  let statusWhere: { in: string[] } = { in: [...VISIBLE_STATUSES] };
  if (q.availability === "available") statusWhere = { in: ["open"] };
  else if (q.availability === "reserved") statusWhere = { in: ["full"] };

  const where = {
    status: statusWhere as never,
    ...(q.specializationId ? { specializationId: q.specializationId } : {}),
    // Filter by department through the topic → specialization → department chain.
    ...(q.departmentId
      ? { specialization: { departmentId: q.departmentId } }
      : {}),
    ...(q.academicYearId ? { academicYearId: q.academicYearId } : {}),
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: "insensitive" as const } },
            {
              description: { contains: q.search, mode: "insensitive" as const },
            },
          ],
        }
      : {}),
  };

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
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.graduationTopic.count({ where }),
  ]);

  // Derive a simple "isAvailable" flag for the card's apply button.
  const items = rows.map((t) => ({
    ...t,
    isAvailable: t.status === "open",
  }));

  return { items, total, page: q.page, limit: q.limit };
};

// Public single-topic detail. Mirrors the list visibility rules: a topic that
// is not published returns 404 (we don't reveal pending/rejected topics).
export const getPublicTopicService = async (id: string) => {
  const topic = await prisma.graduationTopic.findFirst({
    where: { id, status: { in: [...VISIBLE_STATUSES] as never } },
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
  return { ...topic, isAvailable: topic.status === "open" };
};

// Specializations list for the filter dropdown (public, minimal fields).
// Optionally scoped to one department, so the UI can show only that
// department's specializations when a department is selected.
export const listPublicSpecializationsService = async (
  departmentId?: string,
) => {
  return prisma.specialization.findMany({
    where: departmentId ? { departmentId } : undefined,
    select: { id: true, name: true, departmentId: true },
    orderBy: { name: "asc" },
  });
};

// Departments list for the filter dropdown (public, minimal fields).
export const listPublicDepartmentsService = async () => {
  return prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
};
