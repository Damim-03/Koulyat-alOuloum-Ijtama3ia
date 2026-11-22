import {
  updateDepartmentSchema,
  updateDomainSchema,
  updateFacultySchema,
  updateFiliereSchema,
  updateSpecializationSchema,
} from "./admin.validation";

/**
 * صورة الهيكل (غلافه، وشعار الكلية): الفارغ يمسحها، وnull مثله — فيرسل
 * العميل أيّهما؛ والغائب لا يمسّها. يُحرس هذا في كلّ مخطّط تعديل، لأنّ «لا
 * شيء» و«امسح» إن اختلطا مُسحت صورةٌ لم يلمسها أحد، أو بقيت صورةٌ طُلب مسحها.
 */
const schemas = {
  domain: updateDomainSchema,
  faculty: updateFacultySchema,
  department: updateDepartmentSchema,
  filiere: updateFiliereSchema,
  specialization: updateSpecializationSchema,
};

describe.each(Object.entries(schemas))("%s: coverUrl", (_name, schema) => {
  const cover = (input: unknown) => (schema.parse({ coverUrl: input }) as { coverUrl?: string | null }).coverUrl;

  it("الفارغ (ولو مسافاتٍ) وnull ⇒ null: تُمسح", () => {
    expect(cover("")).toBeNull();
    expect(cover("   ")).toBeNull();
    expect(cover(null)).toBeNull();
  });

  it("الغائب ⇒ غائب: لا تُمسّ", () => {
    expect(schema.parse({})).not.toHaveProperty("coverUrl", null);
    expect((schema.parse({}) as { coverUrl?: unknown }).coverUrl).toBeUndefined();
  });

  it("والمسار يُحفظ بلا مسافاته؛ وغير النصّ يُرفض", () => {
    expect(cover("  /uploads/cards/a.webp ")).toBe("/uploads/cards/a.webp");
    expect(schema.safeParse({ coverUrl: 42 }).success).toBe(false);
  });
});

it("وشعار الكلية بالقواعد نفسها", () => {
  expect(updateFacultySchema.parse({ iconUrl: "" }).iconUrl).toBeNull();
  expect(updateFacultySchema.parse({ iconUrl: " /uploads/cards/i.webp" }).iconUrl).toBe("/uploads/cards/i.webp");
  expect(updateFacultySchema.parse({}).iconUrl).toBeUndefined();
});
