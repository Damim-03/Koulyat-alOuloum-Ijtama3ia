import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * الطلبة بلا موضوع: من لم يدخل فريقاً بعد، مضيَّقين بالبنية والسنة.
 *
 * يُحرس: أنّ الطلب يحمل «unassigned» دائماً ومعه كلّ فلتر؛ وأنّ تغيير الأعلى
 * يُفرغ ما تحته؛ وأنّ الصفّ يفتح الطالب.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const last = () =>
  Object.fromEntries(Object.entries(fake.find("get", "/admin/students").at(-1)!.query).filter(([, v]) => v !== undefined && v !== ""));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function page() {
  const app = renderApp("/ar/admin/students/unassigned", { as: "admin" });
  await screen.findAllByText(F.student2.registrationNumber);
  return app;
}
async function pick(app: ReturnType<typeof renderApp>, field: string, option: string) {
  await app.user.click(screen.getByRole("combobox", { name: field }));
  await app.user.click(await screen.findByRole("option", { name: esc(option) }));
}

describe("الطلبة بلا موضوع", () => {
  it("البحث والبنية والسنة تصل الخادم مع «unassigned»، والأعلى يُفرغ ما تحته", async () => {
    const app = await page();
    expect(last()).toMatchObject({ unassigned: "true", page: 1 });
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByNameOrReg")), "سارة");
    await waitFor(() => expect(last()).toMatchObject({ search: "سارة", unassigned: "true" }));

    await pick(app, t("admin.faculty"), F.faculty.name);
    await pick(app, t("admin.department"), F.department.name);
    await pick(app, t("admin.filiere"), F.filiere.name);
    await pick(app, t("admin.specialization"), F.specialization.name);
    await pick(app, t("admin.academicYear"), F.year.title);
    await waitFor(() => expect(last()).toMatchObject({
      facultyId: F.ID.fac1,
      departmentId: F.ID.dep1,
      filiereId: F.filiere.id,
      specializationId: F.ID.spec1,
      academicYearId: F.ID.y1,
    }));

    await pick(app, t("admin.filiere"), F.filiere.name);
    await waitFor(() => expect(last()).not.toHaveProperty("specializationId"));
    await pick(app, t("admin.department"), F.department.name);
    await waitFor(() => expect(last()).not.toHaveProperty("filiereId"));
    await pick(app, t("admin.faculty"), F.faculty.name);
    await waitFor(() => expect(last()).not.toHaveProperty("departmentId"));
    expect(last()).toMatchObject({ facultyId: F.ID.fac1, academicYearId: F.ID.y1 });
  });

  it("الصفّ يفتح الطالب", async () => {
    const app = await page();
    await app.user.click(screen.getAllByText(F.student2.registrationNumber)[0]!.closest("tr")!);
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/students/${F.student2.id}`));
  });

  it("صفحاتٌ كثيرة ⇒ التالي والسابق", async () => {
    fake.on("get", "/admin/students", (r) => ({ items: [F.student2], total: 30, page: Number(r.query.page ?? 1), limit: 12 }));
    const app = await page();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    await waitFor(() => expect(last()).toMatchObject({ page: 2 }));
    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    // الأولى في الذاكرة: لا طلب، فالعلامة العدّاد.
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
  });

  it("لا أحد ⇒ يقال؛ وتعذّرٌ ⇒ «إعادة»", async () => {
    fake.on("get", "/admin/students", { items: [], total: 0, page: 1, limit: 12 });
    let app = renderApp("/ar/admin/students/unassigned", { as: "admin" });
    expect(await screen.findByText(t("admin.noUnassignedStudents"))).toBeInTheDocument();
    app.unmount();

    fake.fail("get", "/admin/students", 500, "خطأ");
    app = renderApp("/ar/admin/students/unassigned", { as: "admin" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", "/admin/students").length;
    await app.user.click(retry);
    await waitFor(() => expect(fake.find("get", "/admin/students").length).toBeGreaterThan(before));
  });
});
