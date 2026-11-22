import type { Prisma, TopicStatus } from "../../generated/prisma";

/**
 * شرط فلاتر صفحة المواضيع: الحالة، والأستاذ، والسنة الجامعية، والهرم
 * (بأدقّ ما اختير منه: التخصص قبل الشعبة قبل القسم قبل الكلية)، والمستوى
 * (ليسانس، ماستر، دكتوراه — صفةٌ للتخصص، تجتمع مع الهرم)، والبحث في العنوان
 * والوصف.
 *
 * قائمة المواضيع وتصديرها إلى Excel يقرآن الشرط نفسه من هنا — فما يراه
 * المسؤول في الجدول هو ما يجده في الملف.
 */
export interface TopicListFilter {
  search?: string;
  status?: TopicStatus;
  professorId?: string;
  academicYearId?: string;
  specializationId?: string;
  filiereId?: string;
  departmentId?: string;
  facultyId?: string;
  level?: "licence" | "master" | "doctorate";
}

export function topicListWhere(q: TopicListFilter): Prisma.GraduationTopicWhereInput {
  const where: Prisma.GraduationTopicWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.professorId) where.professorId = q.professorId;
  if (q.academicYearId) where.academicYearId = q.academicYearId;
  const spec: Prisma.SpecializationWhereInput = {};
  if (q.specializationId) where.specializationId = q.specializationId;
  else if (q.filiereId) spec.filiereId = q.filiereId;
  else if (q.departmentId) spec.filiere = { departmentId: q.departmentId };
  else if (q.facultyId) spec.filiere = { department: { facultyId: q.facultyId } };
  // The level is the specialization's: licence, master and doctorate never mix.
  if (q.level) spec.level = q.level;
  if (Object.keys(spec).length) where.specialization = spec;
  if (q.search) where.OR = [{ title: { contains: q.search } }, { description: { contains: q.search } }];
  return where;
}
