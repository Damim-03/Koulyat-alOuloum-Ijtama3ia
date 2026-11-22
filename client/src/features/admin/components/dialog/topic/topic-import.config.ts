import { CheckCircle2, Clock, Eye, Layers, Send, ShieldCheck, Users } from "lucide-react";
import { adminApi } from "../../../api/admin.api";
import type { ImportDialogConfig } from "../import/import-dialog";
import type { TopicImportResult } from "../../../../../types/admin";
import { effective } from "../import/import-preview.utils";
import { TOPIC_GUIDE } from "./topic-import-columns";

/** الحالات كما يكتبها الخادم في التقرير وبعد الاستيراد — بأسمائها في الموقع (status.*). */
const PUBLISHED = "منشور";
const PENDING = "قيد الانتظار";
const APPROVED = "تمت الموافقة";

/**
 * ملمح استيراد المواضيع في نافذة الاستيراد المشتركة: الأستاذ والتخصص،
 * والتوزيع على التخصصات، وبعد الاستيراد قائمةُ ما أُنشئ — لا حسابات ولا
 * كلمات مرور.
 */
export const TOPIC_IMPORT_CONFIG: ImportDialogConfig = {
  ns: "admin.importTopic",
  files: {
    template: "topics-import.xlsx",
    errors: "topics-import-errors",
    accounts: "topics-imported",
  },
  fetchTemplate: () => adminApi.topicImportTemplate(),
  guide: TOPIC_GUIDE,
  mock: [
    ["الأستاذ", "req"],
    ["عنوان الموضوع", "req"],
    ["الأهداف", "opt"],
    ["الكلية", "auto"],
  ],
  rules: [
    ["ruleAll", Layers],
    ["rulePreview", Eye],
    ["ruleStatus", ShieldCheck],
    ["ruleExisting", Users],
  ],
  list: {
    items: (r) => (r as TopicImportResult).topics.map((t) => ({ ...t })),
    columns: [
      { key: "title", labelKey: "colTitle" },
      { key: "professor", labelKey: "colProfessor" },
      { key: "specialization", labelKey: "colSpecialization" },
      { key: "status", labelKey: "colStatus", badge: true },
    ],
    stats: [
      { labelKey: "statPublished", icon: Send, count: (xs) => xs.filter((x) => x.status === PUBLISHED).length },
      { labelKey: "statApproved", icon: CheckCircle2, count: (xs) => xs.filter((x) => x.status === APPROVED).length },
      { labelKey: "statPending", icon: Clock, count: (xs) => xs.filter((x) => x.status === PENDING).length },
    ],
  },
  preview: {
    searchKeys: ["title", "professor", "specialization", "description"],
    searchPlaceholderKey: "searchPlaceholderTopic",
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
      { labelKey: "factTopicPublished", count: (r) => effective(r.cells.status) === PUBLISHED },
      { labelKey: "factTopicApproved", count: (r) => effective(r.cells.status) === APPROVED },
      { labelKey: "factTopicPending", count: (r) => effective(r.cells.status) === PENDING },
      { labelKey: "factTopicObjectives", count: (r) => !!r.cells.objectives?.value },
      { labelKey: "factTopicReferences", count: (r) => !!r.cells.references?.value },
      { labelKey: "factTopicNoCap", count: (r) => r.cells.maxRequests?.state === "auto" },
    ],
  },
};
