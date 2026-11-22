import { ASSIGNED_COLUMNS, ASSIGNED_SPEC, STUDENT_KEYS } from "./columns";
import { topicSheet, type TopicTemplateInput } from "../topic-import/template";
import { FIRST, LAST } from "../import-kit/template-kit";

/**
 * نموذج استيراد المواضيع المُسنَدة: ورقة المواضيع نفسها (الأستاذ والموضوع
 * والبيانات الجامعية بقوائمها)، ومقاعد الطلبة برقم تسجيلهم بعدها.
 *
 * ورقم التسجيل خانةُ نصّ — فلا يحذف Excel صفراً ولا يكتبه 2.02E+11 — ولا
 * يتكرّر في المقاعد كلّها: الطالب في مذكرةٍ واحدة، فتكراره في صفّين يُلوّن
 * الخانتين بالأحمر قبل أن يقوله الخادم.
 */
export async function buildAssignedTopicImportTemplate(input: TopicTemplateInput): Promise<Buffer> {
  const t = topicSheet(input, ASSIGNED_SPEC.sheetName, ASSIGNED_COLUMNS, { textKeys: STUDENT_KEYS });

  // المقاعد متجاورة: من مقعد الطالب الأوّل إلى الأخير، في الملف كلّه.
  const first = t.L("student1");
  const last = t.L(STUDENT_KEYS[STUDENT_KEYS.length - 1]!);
  const block = `$${first}$${FIRST}:$${last}$${LAST}`;

  for (const k of STUDENT_KEYS) {
    const c = `${t.L(k)}${FIRST}`;
    t.dv(k, {
      type: "custom",
      formulae: [`AND(ISNUMBER(--${c}),LEN(${c})>=6,LEN(${c})<=20,COUNTIF(${block},${c})=1)`],
      errorTitle: "رقم تسجيل غير صالح",
      error: "أرقامٌ فقط (6 إلى 20 رقماً)، ولا يتكرّر في الملف — الطالب في مذكرةٍ واحدة.",
      promptTitle: k === "student1" ? "الطالب 1 — المرسِل" : "رقم تسجيل الطالب",
      prompt:
        k === "student1"
          ? "إلزامي. رقم تسجيله — وهو المرسِل باسم الفريق."
          : "اختياري. رقم تسجيله — أو اتركه إن كان الفريق أصغر.",
    });
  }

  return t.finish((cf) => {
    // طالبٌ في مقعدين — في الصفّ نفسه أو في صفّين.
    const at = `${first}${FIRST}`;
    cf.rule(`${first}${FIRST}:${last}${LAST}`, `AND(LEN(${at})>0,COUNTIF(${block},${at})>1)`);
  });
}
