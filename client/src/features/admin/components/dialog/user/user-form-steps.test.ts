/**
 * اختبارات خطوات إنشاء الحساب.
 *
 * أهمّ ما فيها الأخير: مخطّطات zod هي التي تقرّر ما هو مطلوب، والخطوات هي
 * التي تحرسه. فإن أضاف أحدٌ حقلاً مطلوباً إلى مخطّطٍ ونسي أن يضعه في خطوة،
 * صار حقلاً **لا تحرسه خطوة**: يمرّ المستخدم الخطوات كلّها خضراء، ثم يُردّ
 * عند «حفظ البيانات» بخطأٍ عن حقلٍ لم يره قطّ — وقد يكون في خطوةٍ ورائه.
 *
 * فبدل أن أكتب قائمة المطلوب بيدي هنا (فتشيخ)، أستخرجها من المخطّط نفسه.
 */
import { describe, it, expect } from "vitest";
import {
  academicFields,
  academicLabelKey,
  personalFields,
  stepsFor,
  type Role,
} from "./user-form-steps";
import {
  createProfessorSchema,
  createStudentSchema,
  createUserSchema,
} from "../../../validation/admin.schema";

describe("عدد الخطوات وترتيبها", () => {
  it("بلا دورٍ مثبّت ⇒ أربع خطوات، أوّلها اختيار الدور وآخرها المراجعة", () => {
    const steps = stepsFor("student");

    expect(steps.map((s) => s.key)).toEqual([
      "role",
      "personal",
      "academic",
      "review",
    ]);
  });

  /**
   * الشاشة تُفتح أحياناً من «إضافة طالب» — والسؤال محسوم. وخطوةٌ سؤالها
   * محسومٌ أسوأ من ألّا تكون: تُوهم بأن ثمّة قراراً.
   */
  it("ومع دورٍ مثبّت ⇒ ثلاث، بلا خطوة دور", () => {
    const steps = stepsFor("student", "student");

    expect(steps.map((s) => s.key)).toEqual(["personal", "academic", "review"]);
  });

  it("والمراجعة لا تحرس حقلاً — هي عرضٌ لا إدخال", () => {
    const steps = stepsFor("professor");

    expect(steps.at(-1)).toMatchObject({ key: "review", fields: [] });
  });
});

describe("الخطوة الثالثة تتبدّل بالدور", () => {
  it.each([
    ["student", "admin.universityData"],
    ["professor", "admin.universityData"],
    ["admin", "admin.sectionAdmin"],
  ] as [Role, string][])("«%s» ⇒ عنوانها %s", (role, labelKey) => {
    expect(academicLabelKey(role)).toBe(labelKey);
    expect(stepsFor(role)[2]!.labelKey).toBe(labelKey);
  });

  /**
   * لا حقلاً جامعياً واحداً للإداريّ: لا تخصّص ولا قسم ولا سنة. خطوته
   * بيانات دخولٍ لا انتماء.
   */
  it.each(["admin"] as Role[])("و«%s» لا يُسأل عن شيءٍ جامعيّ", (role) => {
      const fields = academicFields(role);

      expect(fields).toEqual(["email", "username"]);
      for (const academic of [
        "specializationId",
        "academicYearId",
        "registrationNumber",
        "departmentId",
      ])
        expect(fields).not.toContain(academic);
    },
  );

  it("والطالب يُسأل عن رقم تسجيله وسنته وتخصّصه", () => {
    expect(academicFields("student")).toEqual([
      "registrationNumber",
      "academicYearId",
      "specializationId",
    ]);
  });

  it("والأستاذ عن بريده الجامعيّ وقسمه", () => {
    expect(academicFields("professor")).toEqual([
      "universityEmail",
      "departmentId",
    ]);
  });
});

describe("الخطوة الشخصية", () => {
  /**
   * بريد الإداريّ مُعرّف دخوله لا بريده الشخصيّ، فمكانه خطوة الحساب. ولو
   * سُئل عنه هنا لسُئل عنه مرّتين.
   */
  it.each(["admin"] as Role[])("«%s» لا يُسأل عن بريدٍ شخصيّ هنا", (role) => {
      expect(personalFields(role)).not.toContain("email");
      expect(academicFields(role)).toContain("email");
    },
  );

  it("والهاتف للطالب وحده", () => {
    expect(personalFields("student")).toContain("phone");
    expect(personalFields("professor")).not.toContain("phone");
  });

  it("وكلمة المرور في كل دور", () => {
    for (const role of ["student", "professor", "admin"] as Role[])
      expect(personalFields(role)).toContain("password");
  });
});

//
// ═══ الحارس: لا حقل مطلوبٍ بلا خطوة ═══
//

/** ما يشترطه المخطّط فعلاً، مستخرجاً منه لا مكتوباً بيدي. */
const requiredOf = (schema: {
  safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } };
}): string[] => {
  const res = schema.safeParse({});
  const paths = (res.error?.issues ?? [])
    .map((i) => i.path[0])
    .filter((p): p is string => typeof p === "string");
  return [...new Set(paths)];
};

describe("كل حقلٍ يشترطه المخطّط تحرسه خطوة", () => {
  it.each([
    ["student", createStudentSchema],
    ["professor", createProfessorSchema],
    ["admin", createUserSchema],
  ] as [Role, Parameters<typeof requiredOf>[0]][])(
    "«%s»",
    (role, schema) => {
      const guarded = new Set(stepsFor(role).flatMap((s) => s.fields));
      const required = requiredOf(schema);

      // المخطّط يشترط شيئاً فعلاً — وإلّا كان الاختبار يمرّ بلا أن يفحص.
      expect(required.length).toBeGreaterThan(0);
      for (const field of required) expect([...guarded]).toContain(field);
    },
  );
});
