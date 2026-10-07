/**
 * شرط الانتماء الأكاديميّ للطالب: السنة الجامعية، والهرم (الكلية ← القسم ←
 * الشعبة)، والمستوى، والتخصص.
 *
 * قائمة الطلبة وتصديرها إلى Excel يقرآن الشرط نفسه من هنا — فما يراه المسؤول
 * في الجدول هو ما يجده في الملف.
 *
 * والهرم يُطبَّق بأدقّ ما اختير منه (الشعبة قبل القسم قبل الكلية)، والمستوى
 * صفةٌ للتخصص يُضاف إلى الشرط نفسه: كان كلّ فلترٍ يُسنِد `specialization`
 * كاملاً، فلو أُسند المستوى وحده لمحا الشعبة أو القسم المختار قبله.
 */
export interface StudentAcademicFilter {
  specializationId?: string;
  academicYearId?: string;
  filiereId?: string;
  departmentId?: string;
  facultyId?: string;
  level?: string;
}

export function studentAcademicWhere(q: StudentAcademicFilter): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (q.specializationId) where.specializationId = q.specializationId;
  if (q.academicYearId) where.academicYearId = q.academicYearId;

  const spec: Record<string, unknown> = {};
  if (q.filiereId) spec.filiereId = q.filiereId;
  else if (q.departmentId) spec.filiere = { departmentId: q.departmentId };
  else if (q.facultyId) spec.filiere = { department: { facultyId: q.facultyId } };
  if (q.level) spec.level = q.level;
  if (Object.keys(spec).length > 0) where.specialization = spec;

  return where;
}
