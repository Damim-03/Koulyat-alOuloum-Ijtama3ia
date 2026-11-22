import { BookOpen, Eye, GraduationCap, Layers, UserCheck, Users } from "lucide-react";
import { adminApi } from "../../../api/admin.api";
import type { ImportDialogConfig } from "../import/import-dialog";
import type { AssignedTopicImportResult, StudentImportRow } from "../../../../../types/admin";
import { ASSIGNED_TOPIC_GUIDE } from "./assigned-topic-import-columns";

const SEATS = ["student1", "student2", "student3", "student4", "student5"];
/** كم طالباً في الصفّ — من المقاعد المملوءة. */
const seated = (r: StudentImportRow) => SEATS.filter((k) => r.cells[k]?.value).length;
/** أسماء الطلبة في قائمة ما أُنشئ مفصولةٌ بـ«، ». */
const studentsOf = (x: Record<string, string | null>) => (x.students ? x.students.split("، ").length : 0);

/**
 * ملمح استيراد المواضيع المُسنَدة — «إنشاء موضوع وإسناده» دفعةً — في نافذة
 * الاستيراد المشتركة: نموذجٌ ونصوصٌ مستقلّة عن استيراد المواضيع، وبعد
 * الاستيراد قائمةُ المواضيع بطلبتها.
 */
export const ASSIGNED_TOPIC_IMPORT_CONFIG: ImportDialogConfig = {
  ns: "admin.importAssigned",
  files: {
    template: "assigned-topics-import.xlsx",
    errors: "assigned-topics-import-errors",
    accounts: "assigned-topics-imported",
  },
  fetchTemplate: () => adminApi.assignedTopicImportTemplate(),
  guide: ASSIGNED_TOPIC_GUIDE,
  mock: [
    ["الأستاذ", "req"],
    ["عنوان الموضوع", "req"],
    ["الطالب 1", "req"],
    ["الطالب 2", "opt"],
  ],
  rules: [
    ["ruleAll", Layers],
    ["rulePreview", Eye],
    ["ruleStudents", Users],
    ["ruleExisting", UserCheck],
  ],
  list: {
    items: (r) => (r as AssignedTopicImportResult).topics.map((t) => ({ ...t })),
    columns: [
      { key: "title", labelKey: "colTitle" },
      { key: "professor", labelKey: "colProfessor" },
      { key: "students", labelKey: "colStudents" },
      { key: "specialization", labelKey: "colSpecialization" },
    ],
    stats: [
      { labelKey: "statTopics", icon: BookOpen, count: (xs) => xs.length },
      { labelKey: "statStudents", icon: GraduationCap, count: (xs) => xs.reduce((n, x) => n + studentsOf(x), 0) },
      { labelKey: "statProfessors", icon: Users, count: (xs) => new Set(xs.map((x) => x.professor)).size },
    ],
  },
  preview: {
    searchKeys: ["title", "professor", "specialization", ...SEATS],
    searchPlaceholderKey: "searchPlaceholderAssigned",
    distribution: {
      main: "specialization",
      path: ["faculty", "department", "filiere"],
      badge: "level",
      mono: "academicYear",
      guard: ["academicYear", "faculty", "department", "filiere", "level", "specialization"],
      headers: ["distSpec", "distLevel", "distYear"],
    },
    personFacts: false,
    extraFacts: [
      { labelKey: "factGroupOne", count: (r) => seated(r) === 1 },
      { labelKey: "factGroupTwo", count: (r) => seated(r) === 2 },
      { labelKey: "factGroupMore", count: (r) => seated(r) >= 3 },
      { labelKey: "factStudentOther", count: (r) => SEATS.some((k) => r.cells[k]?.state === "warning") },
      { labelKey: "factTopicObjectives", count: (r) => !!r.cells.objectives?.value },
      { labelKey: "factTopicReferences", count: (r) => !!r.cells.references?.value },
    ],
  },
};
