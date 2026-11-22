import { prisma } from "../../core/prisma/client";

/**
 * Shared read-only lookups, available to any authenticated user
 * (professors, students) for populating dropdowns/filters.
 *
 * Academic hierarchy: Faculty → Department → Filiere → Specialization.
 */

// All faculties (id + name + code).
export const listFacultiesService = async () => {
  return prisma.faculty.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
};

// Departments, optionally filtered by faculty.
export const listDepartmentsService = async (facultyId?: string) => {
  return prisma.department.findMany({
    where: facultyId ? { facultyId } : undefined,
    select: {
      id: true,
      name: true,
      code: true,
      facultyId: true,
    },
    orderBy: { name: "asc" },
  });
};

// Specializations, optionally filtered by filiere and/or department.
// `departmentId` is resolved through the filiere relation, and the output
// is flattened so consumers still receive a top-level `departmentId`
// (backward compatible) alongside the new `filiereId`.
export const listSpecializationsService = async ({
  filiereId,
  departmentId,
}: {
  filiereId?: string;
  departmentId?: string;
}) => {

  const specializations = await prisma.specialization.findMany({
    where: {
      ...(filiereId ? { filiereId } : {}),
      ...(departmentId ? { filiere: { departmentId } } : {}),
    },
    select: {
      id: true,
      name: true,
      level: true,
      filiereId: true,
      filiere: {
        select: {
          id: true,
          name: true,
          departmentId: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return specializations.map((s) => ({
    id: s.id,
    name: s.name,
    level: s.level,
    filiereId: s.filiereId,
    departmentId: s.filiere.departmentId,
    filiere: { id: s.filiere.id, name: s.filiere.name },
  }));
};

// Academic years (active first, then newest).
export const listAcademicYearsService = async () => {
  return prisma.academicYear.findMany({
    // Closed years hold a record, not new work.
    where: { archivedAt: null },
    // والفترة: يعرف بها الأستاذ لأيّ سنةٍ يقترح الآن، ومتى.
    // And the number of students per topic, by level, when the administration set it: the form follows it.
    select: { id: true, title: true, isActive: true, proposalsOpenAt: true, proposalsCloseAt: true, teamSizes: true },
    orderBy: [{ isActive: "desc" }, { title: "desc" }],
  });
};
