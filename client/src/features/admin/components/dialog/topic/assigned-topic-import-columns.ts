import type { ImportColumn } from "../../../../../types/admin";
import { TOPIC_GUIDE } from "./topic-import-columns";

/**
 * أعمدة ملفّ استيراد المواضيع المُسنَدة كما في نموذج المنصّة — لدليل الأعمدة
 * قبل الرفع: خانات الموضوع نفسها بلا الحالة (الموضوع المُسنَد «مسند» بطلبته)،
 * ثم مقاعد الطلبة. والخادم مصدرها (ASSIGNED_COLUMNS).
 */
export const ASSIGNED_TOPIC_GUIDE: Omit<ImportColumn, "letter">[] = [
  ...TOPIC_GUIDE.filter((c) => c.key !== "status"),
  { key: "student1", header: "الطالب 1 (المرسِل)", kind: "req", group: "students" },
  ...[2, 3, 4, 5].map((n) => ({
    key: `student${n}`,
    header: `الطالب ${n}`,
    kind: "opt" as const,
    group: "students" as const,
  })),
];
