/**
 * رسالة zod العامّة أم رسالة المخطَّط؟ — بأيّ لغة.
 *
 * كان الفرق يُعرف من أوّل كلمةٍ بالإنجليزية، فلمّا صارت رسائل zod بلغة الطلب
 * بلغت رسالته العامّة («يفترض إدخال array…») المستخدمَ العربيّ بلا اسم الحقل.
 */
import { z } from "zod";

import { withLang } from "./index";
import { isZodDefaultMessage, zmsg } from "./zod";

const schema = z.object({
  recipientIds: z.array(z.string()),
  title: z.string().min(1, zmsg("v.titleRequired")),
});

const firstIssue = (value: unknown) => {
  const r = schema.safeParse(value);
  if (r.success) throw new Error("expected a failure");
  return r.error.issues[0]!;
};

describe("isZodDefaultMessage", () => {
  it.each(["ar", "en", "fr"] as const)("رسالة zod العامّة معلَّمة (%s)", (lang) => {
    const issue = withLang(lang, () => firstIssue({ title: "x" }));
    expect(issue.path).toEqual(["recipientIds"]);
    expect(isZodDefaultMessage(issue)).toBe(true);
  });

  it.each(["ar", "en", "fr"] as const)("ورسالة المخطَّط غير معلَّمة (%s)", (lang) => {
    const issue = withLang(lang, () => firstIssue({ recipientIds: [], title: "" }));
    expect(issue.path).toEqual(["title"]);
    expect(isZodDefaultMessage(issue)).toBe(false);
  });

  it("والعلامة لا تظهر فيما يُرسَل", () => {
    const issue = firstIssue({ title: "x" });
    expect(JSON.stringify(issue)).not.toMatch(/zod-default/);
    expect(Object.keys(issue)).not.toContain("zod-default-message");
  });
});
