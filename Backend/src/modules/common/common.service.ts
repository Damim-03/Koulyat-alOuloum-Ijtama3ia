import { prisma } from "../../core/prisma/client";

/**
 * Shared read-only lookups, available to any authenticated user
 * (professors, students) for populating dropdowns/filters.
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

// Specializations, optionally filtered by department.
export const listSpecializationsService = async (departmentId?: string) => {
  return prisma.specialization.findMany({
    where: departmentId ? { departmentId } : undefined,
    select: {
      id: true,
      name: true,
      level: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
};

// Academic years (active first, then newest).
export const listAcademicYearsService = async () => {
  return prisma.academicYear.findMany({
    select: { id: true, title: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { title: "desc" }],
  });
};