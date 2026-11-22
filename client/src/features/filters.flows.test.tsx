import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../i18n/i18n";
import { fake } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import * as F from "../test/fixtures";

/**
 * فلاتر القوائم: مواضيع الإدارة، والمواضيع العامّة، وصفحة التخصّصات.
 *
 * يُحرس في كلٍّ منها: أنّ اختيار المستوى الأعلى يُفرغ ما تحته؛ وأنّ كلّ فلترٍ
 * يصل الخادم (أو يحصر القائمة إن كانت محلّية)؛ وأنّ الصفحات تتقدّم وتتراجع؛
 * وأنّ «مسح» يعيد كلّ شيء.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
/** معاملات آخر طلبٍ إلى المسار — بلا ما تُرك فارغاً (axios لا يرسله). */
const lastQuery = (path: string) =>
  Object.fromEntries(Object.entries(fake.find("get", path).at(-1)!.query).filter(([, v]) => v !== undefined && v !== ""));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function choose(app: ReturnType<typeof renderApp>, name: string, option: string) {
  await app.user.click(screen.getByRole("combobox", { name }));
  await app.user.click(await screen.findByRole("option", { name: esc(option) }));
}

describe("مواضيع الإدارة", () => {
  it("البنية من الكلّية إلى التخصّص تصل الخادم، والكلّية تُفرغ ما تحتها، و«مسح الفلاتر» يعيد الكلّ", async () => {
    // تخصّصٌ بلا مواضيع: يظهر «مسح الفلاتر» في مكان الجدول.
    fake.on("get", "/admin/topics", (r) => ({ items: r.query.specializationId ? [] : F.topics, total: r.query.specializationId ? 0 : F.topics.length, page: 1, limit: 20 }));
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.filters")) })[0]!);
    await choose(app, t("admin.allFaculties"), F.faculty.name);
    await choose(app, t("admin.allDepartments"), F.department.name);
    await choose(app, t("admin.allFilieres"), F.filiere.name);
    await choose(app, t("admin.allSpecializations"), F.specialization.name);
    await waitFor(() => expect(lastQuery("/admin/topics")).toMatchObject({ facultyId: F.ID.fac1, specializationId: F.ID.spec1 }));

    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.clearFilters")) }));
    for (const name of ["admin.allFaculties", "admin.allDepartments", "admin.allFilieres", "admin.allSpecializations"])
      expect(screen.getByRole("combobox", { name: t(name) })).toHaveTextContent(t(name));

    // والكلّية وحدها تُفرغ ما تحتها.
    await choose(app, t("admin.allFaculties"), F.faculty.name);
    await choose(app, t("admin.allDepartments"), F.department.name);
    await choose(app, t("admin.allFaculties"), t("admin.allFaculties"));
    expect(screen.getByRole("combobox", { name: t("admin.allDepartments") })).toHaveTextContent(t("admin.allDepartments"));
  });

  it("الصفحة التالية والسابقة", async () => {
    fake.on("get", "/admin/topics", (r) => ({ items: F.topics, total: 60, page: Number(r.query.page ?? 1), limit: 20 }));
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    await waitFor(() => expect(lastQuery("/admin/topics")).toMatchObject({ page: 2 }));
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    expect(screen.getByRole("button", { name: t("admin.proj.prev") })).toBeDisabled();
  });
});

describe("المواضيع العامّة", () => {
  it("القسم ثمّ التخصّص، والمشرف والسنة والحجم، والترتيب — في الرابط والطلب", async () => {
    const app = renderApp("/ar/topics", { as: "student" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByTestId("topics-filters-toggle"));
    await screen.findByTestId("topics-filters-panel");
    await choose(app, t("public.browse.department"), F.department.name);
    await choose(app, t("public.browse.specialization"), F.specialization.name);
    await choose(app, t("public.browse.supervisor"), "كريم");
    await choose(app, t("public.browse.year"), F.year.title);
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ departmentId: F.ID.dep1, specializationId: F.ID.spec1, professorId: F.prof1.id, academicYearId: F.ID.y1 }));
    expect(app.location()).toContain(`spec=${F.ID.spec1}`);

    await choose(app, t("public.browse.sort"), t("public.browse.sortTitle"));
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ sort: "title" }));

    const chips = screen.getByTestId("topics-active-filters");
    for (const x of within(chips).getAllByRole("button").filter((b) => b.getAttribute("aria-label"))) await app.user.click(x);
    await waitFor(() => expect(lastQuery("/public/topics")).not.toHaveProperty("specializationId"));
  });

  it("تبويبات التوفّر، والبحث، و«تخصّصي»", async () => {
    fake.on("get", "/public/topic-filters", { ...F.publicFilters, mine: { specializationId: F.ID.spec1, specializationName: F.specialization.name, departmentId: F.ID.dep1, academicYearId: F.ID.y1 } });
    const app = renderApp("/ar/topics", { as: "student" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByTestId("topics-tab-available"));
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ availability: "available" }));
    await app.user.click(screen.getByTestId("topics-tab-reserved"));
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ availability: "reserved" }));
    await app.user.type(screen.getByTestId("topics-search"), "الرقمنة");
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ search: "الرقمنة" }));
    await app.user.click(screen.getByRole("button", { name: t("public.browse.clearSearch") }));
    await app.user.click(await screen.findByTestId("topics-my-spec"));
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ specializationId: F.ID.spec1 }));
  });

  it("صفحاتٌ كثيرة: رقم الصفحة، والتالي والسابق", async () => {
    fake.on("get", "/public/topics", (r) => ({ items: F.publicTopics, total: 50, page: Number(r.query.page ?? 1), limit: 12, counts: { all: 50, available: 30, reserved: 20 } }));
    const app = renderApp("/ar/topics", { as: "student" });
    const pager = await screen.findByTestId("topics-pagination");
    await app.user.click(within(pager).getByRole("button", { name: t("public.browse.pageN", { n: 3 }) }));
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ page: 3 }));
    await app.user.click(within(pager).getByRole("button", { name: t("public.browse.prevPage") }));
    await waitFor(() => expect(lastQuery("/public/topics")).toMatchObject({ page: 2 }));
    // الصفحة الثالثة في الذاكرة: لا طلب، والرابط يكفي شاهداً.
    await app.user.click(within(pager).getByRole("button", { name: t("public.browse.nextPage") }));
    await waitFor(() => expect(app.location()).toContain("page=3"));
  });

  it("موضوعٌ محجوزٌ لغير فريقي ⇒ بطاقته تفتح نافذةً تقول ذلك بدل صفحته", async () => {
    fake.on("get", "/public/topics", { items: [{ ...F.publicTopics[1]!, isMine: false }], total: 1, page: 1, limit: 12, counts: { all: 1, available: 0, reserved: 1 } });
    const app = renderApp("/ar/topics", { as: "student" });
    const card = await screen.findByTestId(`topic-card-${F.topicFull.id}`);
    await app.user.click(card);
    expect((await screen.findAllByRole("dialog")).length).toBeGreaterThan(0);
    expect(app.location()).toBe("/ar/topics");
  });
});

describe("صفحة التخصّصات", () => {
  it("بطاقات الأطوار والشرائح فلاتر، والكلّية والشعبة كذلك، و«مسح الكلّ»", async () => {
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    await screen.findByTestId("spec-grid");
    const licence = screen.getAllByRole("button", { name: esc(t("admin.proj.level.licence")) })[0]!;
    await app.user.click(licence);
    await waitFor(() => expect(app.location()).toContain("level=licence"));
    await waitFor(() => expect(within(screen.getByTestId("spec-grid")).queryByText(F.specialization.name)).toBeNull());

    await choose(app, t("admin.faculty"), F.faculty.name);
    await waitFor(() => expect(app.location()).toContain(`faculty=${F.ID.fac1}`));
    await choose(app, t("admin.filiere"), F.filiere.name);
    await waitFor(() => expect(app.location()).toContain(`filiere=${F.filiere.id}`));
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.proj.clearAll")) })[0]!);
    await waitFor(() => expect(app.location()).toBe("/ar/admin/specializations"));
  });

  it("صفحاتٌ كثيرة من التخصّصات", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...F.specialization2, id: `5e3${String(i).padStart(5, "0")}-0000-4000-8000-000000000000`, name: `تخصّص ${i + 1}` }));
    fake.on("get", "/admin/specializations", { specializations: many });
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    await screen.findByTestId("spec-grid");
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    await waitFor(() => expect(app.location()).toContain("page=2"));
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    await waitFor(() => expect(app.location()).not.toContain("page=2"));
  });
});

/** القائمة باسمها الحاليّ (عنوانها قبل الاختيار) ⇒ الخيار. */
async function chooseFrom(app: ReturnType<typeof renderApp>, current: string, option: string) {
  await app.user.click(screen.getAllByRole("combobox").find((c) => c.getAttribute("title") === current || c.textContent?.trim() === current)!);
  await app.user.click(await screen.findByRole("option", { name: esc(option) }));
}
const removeChip = (label: RegExp) => screen.getByRole("button", { name: new RegExp(`${t("admin.proj.removeFilter")}: .*${label.source}`) });

describe("قائمة الطلبة", () => {
  it("الاسم والرقم والبنية تصل الخادم شرائح، تُزال واحدةً واحدة، و«مسح الكلّ»", async () => {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await screen.findAllByText(F.student1.registrationNumber);
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByNamePlaceholder")), "أمين");
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByRegNumberPlaceholder")), "2020");
    await chooseFrom(app, t("admin.allFacultiesShort"), F.faculty.name);
    await chooseFrom(app, t("admin.allDepartments"), F.department.name);
    await chooseFrom(app, t("admin.allFilieresShort"), F.filiere.name);
    await chooseFrom(app, t("admin.allLevels"), t("admin.levelMaster"));
    await chooseFrom(app, t("admin.allSpecializations"), F.specialization.name);
    await waitFor(() => expect(lastQuery("/admin/students")).toMatchObject({ specializationId: F.ID.spec1 }));

    await app.user.click(removeChip(new RegExp(F.specialization.name)));
    await app.user.click(removeChip(/أمين/));
    // الشريحة من البحث المؤجَّل: تزول حين يلحقه.
    await waitFor(() => expect(screen.queryByRole("button", { name: new RegExp(`${t("admin.proj.removeFilter")}: .*أمين`) })).toBeNull());
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.clearAll")) }));
    expect(screen.getByPlaceholderText(t("admin.searchByRegNumberPlaceholder"))).toHaveValue("");
  });
});

describe("قائمة الطلبات", () => {
  it("البنية والتاريخ شرائح تُزال، و«مسح الكلّ»", async () => {
    const app = renderApp("/ar/admin/group-requests", { as: "admin" });
    await screen.findAllByTestId("request-topic");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.filters")) })[0]!);
    await chooseFrom(app, t("admin.allFacultiesShort"), F.faculty.name);
    await chooseFrom(app, t("admin.allDepartments"), F.department.name);
    const dates = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dates[0]!, { target: { value: "2026-09-01" } });
    fireEvent.change(dates[1]!, { target: { value: "2026-10-31" } });
    await waitFor(() => expect(lastQuery("/admin/group-requests/by-topic")).toMatchObject({ dateFrom: "2026-09-01" }));
    await app.user.click(removeChip(/2026-10-31/));
    await app.user.click(removeChip(/2026-09-01/));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.clearAll")) }));
    await waitFor(() => expect(screen.queryByRole("button", { name: esc(t("admin.clearAll")) })).toBeNull());
  });
});
