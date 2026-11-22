import type { ImportColumn, ImportSpec } from "../import-kit/columns";
import { AUTO_UNKNOWN, TOPIC_COLUMNS } from "../topic-import/columns";
import type { TopicFieldKey } from "../topic-import/checks";

/**
 * أعمدة ملفّ استيراد المواضيع المُسنَدة — كنافذة «إنشاء موضوع وإسناده»:
 * خانات الموضوع نفسها التي في استيراد المواضيع (بلا الحالة: الموضوع المُسنَد
 * «مسند» بطلبته)، ثم مقاعد الطلبة برقم تسجيلهم.
 *
 * ملفٌّ ونموذجٌ مستقلّان عن استيراد المواضيع: عمود «الحالة» هناك وأعمدة
 * الطلبة هنا، فلا يُقرأ أحدهما بالآخر.
 */

/** مقاعد الطلبة في الصفّ. والأكبر منها يُسنَد من النافذة. */
export const STUDENT_SLOTS = 5;

export type StudentKey = "student1" | "student2" | "student3" | "student4" | "student5";
export const STUDENT_KEYS: StudentKey[] = ["student1", "student2", "student3", "student4", "student5"];

export type AssignedKey = TopicFieldKey | StudentKey;

const STUDENT_COLUMNS: ImportColumn<StudentKey>[] = STUDENT_KEYS.map((key, i) =>
  i === 0
    ? {
        key,
        header: "الطالب 1 (المرسِل)",
        kind: "req",
        width: 20,
        group: "students",
        note: "رقم تسجيله. وهو المرسِل باسم الفريق، كأوّل مقعدٍ في نافذة «إنشاء موضوع وإسناده».",
      }
    : {
        key,
        header: `الطالب ${i + 1}`,
        kind: "opt",
        width: 18,
        group: "students",
        note: "رقم تسجيله — أو اتركه إن كان الفريق أصغر.",
      },
);

export const ASSIGNED_COLUMNS: ImportColumn<AssignedKey>[] = [
  ...TOPIC_COLUMNS.filter((c): c is ImportColumn<TopicFieldKey> => c.key !== "status"),
  ...STUDENT_COLUMNS,
];

export const ASSIGNED_SPEC: ImportSpec<AssignedKey> = {
  sheetName: "المواضيع المسندة",
  columns: ASSIGNED_COLUMNS,
  anchor: "title",
  autoUnknown: AUTO_UNKNOWN,
  noun: "topic",
};
