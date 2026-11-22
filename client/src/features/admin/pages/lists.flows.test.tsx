import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../i18n/i18n";
import { fake } from "../../../test/fake-api";
import { renderApp } from "../../../test/render-app";
import * as F from "../../../test/fixtures";

/**
 * قوائم الإدارة الكبيرة — المشاريع والمناقشات: فلاترها في الرابط، فتُشارَك
 * وتُستعاد بزرّ «رجوع»، وكلّ فلترٍ يصل الخادم في طلب القائمة نفسه.
 *
 * يُحرس: أنّ بطاقات الأرقام فلاترُ تُفعَّل وتُلغى بالنقرة نفسها؛ وأنّ البحث
 * يُرسل بعد التوقّف عن الكتابة لا مع كلّ حرف؛ وأنّ طريقة العرض تُحفظ؛ وأنّ
 * إلغاء مناقشةٍ وحذفها يُسأل عنهما أوّلاً.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const last = (path: string) => fake.find("get", path).at(-1)!.query;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("المشاريع", () => {
  it("بطاقة «بلا مناقشة» فلترٌ يُفعَّل ويُلغى، ويصل الخادم", async () => {
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    await screen.findAllByText(F.topicFull.title);
    const tile = () => screen.getByRole("button", { name: esc(t("admin.proj.stat.noDefense")) });
    await app.user.click(tile());
    await waitFor(() => expect(app.location()).toContain("defense=none"));
    await waitFor(() => expect(last("/admin/projects")).toMatchObject({ defense: "none" }));
    await app.user.click(tile());
    await waitFor(() => expect(app.location()).not.toContain("defense="));

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.stat.late")) }));
    await waitFor(() => expect(app.location()).toContain("health=late"));
  });

  it("البحث يُرسل بعد التوقّف، والترتيب في الرابط", async () => {
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    await app.user.type(await screen.findByTestId("projects-search"), "الهجرة");
    await waitFor(() => expect(app.location()).toContain(`q=${encodeURIComponent("الهجرة")}`));
    await waitFor(() => expect(last("/admin/projects")).toMatchObject({ search: "الهجرة" }));

    await app.user.click(screen.getByRole("combobox", { name: t("admin.proj.sortLabel") }));
    const options = await screen.findAllByRole("option");
    await app.user.click(options.at(-1)!);
    await waitFor(() => expect(app.location()).toContain("sort="));
  });

  it("الجدول بدل البطاقات، ويُحفظ الاختيار للزيارة التالية", async () => {
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    await screen.findByTestId("projects-grid");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.viewTable")) }));
    expect(await screen.findByTestId("projects-table")).toBeInTheDocument();
    app.unmount();

    renderApp("/ar/admin/projects", { as: "admin" });
    expect(await screen.findByTestId("projects-table")).toBeInTheDocument();
  });

  it("فلاتر البنية تحت «المزيد»: تظهر شرائح، وتُزال واحدةً أو كلّها", async () => {
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    await screen.findAllByText(F.topicFull.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.moreFilters")) }));
    const faculty = screen.getAllByRole("combobox").find((c) => c.textContent?.includes(t("admin.proj.allFaculties")))!;
    await app.user.click(faculty);
    await app.user.click(await screen.findByRole("option", { name: esc(F.faculty.name) }));
    await waitFor(() => expect(app.location()).toContain(`facultyId=${F.ID.fac1}`));
    const chips = await screen.findByTestId("projects-active-filters");
    await app.user.click(within(chips).getAllByRole("button", { name: t("admin.proj.removeFilter") })[0]!);
    await waitFor(() => expect(app.location()).not.toContain("facultyId="));
  });

  it("صفحاتٌ كثيرة ⇒ التالي يطلب الثانية", async () => {
    fake.on("get", "/admin/projects", (r) => ({ items: [F.project, F.project2], total: 40, page: Number(r.query.page ?? 1), limit: 12, stats: { total: 40, defenseScheduled: 1, defenseDone: 0, noDefense: 39, withOverdue: 0, noPlan: 0 } }));
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    await screen.findAllByText(F.topicFull.title);
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    await waitFor(() => expect(app.location()).toContain("page=2"));
    await waitFor(() => expect(last("/admin/projects")).toMatchObject({ page: 2 }));
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    await waitFor(() => expect(app.location()).not.toContain("page="));
  });

  it("لا نتائج بفلتر ⇒ «امسح الفلاتر» يعيد القائمة", async () => {
    const app = renderApp("/ar/admin/projects?q=xyz", { as: "admin" });
    fake.on("get", "/admin/projects", (r) => ({ items: r.query.search ? [] : [F.project], total: r.query.search ? 0 : 1, page: 1, limit: 12, stats: { total: 1, defenseScheduled: 1, defenseDone: 0, noDefense: 0, withOverdue: 0, noPlan: 0 } }));
    const clear = await screen.findAllByRole("button", { name: esc(t("admin.clearFilters")) });
    await app.user.click(clear.at(-1)!);
    await waitFor(() => expect(app.location()).toBe("/ar/admin/projects"));
  });
});

describe("المناقشات", () => {
  it("البطاقات فلاتر الزمن والحالة، واحدةٌ في كلّ مرّة", async () => {
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    await screen.findAllByTestId("defense-card");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defensesPage.stat.week")) }));
    await waitFor(() => expect(app.location()).toContain("when=week"));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defensesPage.stat.completed")) }));
    await waitFor(() => expect(app.location()).toContain("status=completed"));
    expect(app.location()).not.toContain("when=");
    await waitFor(() => expect(last("/admin/defenses")).toMatchObject({ status: "completed" }));
  });

  it("الجدول، والبحث بعد التوقّف", async () => {
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    await screen.findAllByTestId("defense-card");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defensesPage.viewTable")) }));
    expect(await screen.findByTestId("defenses-table")).toBeInTheDocument();
    await app.user.type(screen.getByTestId("defenses-search"), "قاعة");
    await waitFor(() => expect(last("/admin/defenses")).toMatchObject({ search: "قاعة" }));
  });

  it("إلغاء مناقشةٍ يُسأل عنه ثمّ تُحفظ حالتها «ملغاة»؛ والحذف كذلك", async () => {
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    const card = (await screen.findAllByTestId("defense-card"))[0]!;
    await app.user.click(within(card).getByRole("button", { name: t("admin.defensesPage.cancelAction") }));
    expect(fake.writes).toEqual([]);
    await app.user.click((await screen.findAllByRole("button", { name: t("admin.defensesPage.cancelAction") })).at(-1)!);
    await waitFor(() => expect(fake.find("patch", `/admin/defenses/${F.defense.id}`)[0]?.body).toEqual({ status: "cancelled" }));

    await app.user.click(within(card).getByTestId("defense-delete"));
    await app.user.click(await screen.findByRole("button", { name: t("admin.confirmDelete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/defenses/${F.defense.id}`)).toHaveLength(1));
  });

  it("«تسجيل النتيجة» يفتح النموذج على «انتهت» والعلامة ظاهرة", async () => {
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    const card = (await screen.findAllByTestId("defense-card"))[0]!;
    await app.user.click(within(card).getByTestId("defense-result"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: esc(t("admin.proj.defenseState.completed")) })).toHaveAttribute("aria-checked", "true");
    await app.user.type(within(dialog).getByTestId("defense-grade"), "16.5");
    await app.user.click(within(dialog).getByTestId("defense-save"));
    await waitFor(() => expect(fake.find("patch", `/admin/defenses/${F.defense.id}`)[0]?.body).toMatchObject({ status: "completed", grade: 16.5 }));
  });

  it("مناقشةٌ ملغاة ⇒ «استعادة» تعيدها مبرمجة", async () => {
    fake.on("get", "/admin/defenses", (r) => ({ items: [{ ...F.defense, status: "cancelled", group: F.project }], total: 1, page: 1, limit: Number(r.query.limit ?? 20), stats: F.defenseStats }));
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    const card = (await screen.findAllByTestId("defense-card"))[0]!;
    await app.user.click(within(card).getByRole("button", { name: t("admin.defensesPage.restore") }));
    await waitFor(() => expect(fake.find("patch", `/admin/defenses/${F.defense.id}`)[0]?.body).toMatchObject({ status: "scheduled" }));
  });

  it("مشروعٌ جاهزٌ للبرمجة من اللوحة الجانبية ⇒ نموذجٌ عليه", async () => {
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    const panel = await screen.findByTestId("ready-panel");
    await app.user.click((await within(panel).findAllByRole("button", { name: esc(t("admin.defensesPage.scheduleShort")) }))[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByTestId("defense-date"), { target: { value: "2026-11-25T08:30" } });
    await app.user.type(within(dialog).getByTestId("defense-room"), "قاعة 7");
    await app.user.click(within(dialog).getByTestId("defense-save"));
    await waitFor(() => expect(fake.find("post", "/admin/defenses")[0]?.body).toMatchObject({ groupId: F.ID.g2, room: "قاعة 7" }));
  });
});

describe("المناقشات: ما حول القائمة", () => {
  const list = (items: object[], total = items.length) => (r: { query: Record<string, unknown> }) => ({
    items,
    total,
    page: Number(r.query.page ?? 1),
    limit: 20,
    stats: F.defenseStats,
  });

  it("الحالة والترتيب والمشرف في الرابط وفي الطلب؛ و«مسح الكلّ» يُبقي طريقة العرض", async () => {
    const app = renderApp("/ar/admin/defenses?view=table", { as: "admin" });
    await screen.findByTestId("defenses-table");
    await app.user.click(screen.getByRole("combobox", { name: t("admin.statusLabel") }));
    await app.user.click(await screen.findByRole("option", { name: t("admin.proj.defenseState.completed") }));
    await app.user.click(screen.getByRole("combobox", { name: t("admin.proj.sortLabel") }));
    await app.user.click(await screen.findByRole("option", { name: t("admin.defensesPage.sortDesc") }));
    const picker = screen.getAllByRole("button").find((b) => b.getAttribute("aria-haspopup") === "listbox")!;
    await app.user.click(picker);
    await app.user.type(await screen.findByPlaceholderText(t("admin.searchProfessorAny")), "كريم");
    await app.user.click(await screen.findByRole("option", { name: /كريم/ }));
    await waitFor(() => expect(last("/admin/defenses")).toMatchObject({ status: "completed", sort: "dateDesc", professorId: F.prof1.id }));

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.clearAll")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/defenses?view=table"));
    // والعودة إلى الأجندة لا تُبقي «view» في الرابط.
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defensesPage.viewAgenda")) }));
    await waitFor(() => expect(app.location()).not.toContain("view="));
  });

  it("تعذّر التحميل ⇒ سببه و«إعادة» تطلب من جديد", async () => {
    fake.fail("get", "/admin/defenses", 500, "خطأ");
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    const msg = await screen.findByText(t("admin.defensesPage.loadFailed"));
    const before = fake.find("get", "/admin/defenses").length;
    await app.user.click(within(msg.parentElement!).getAllByRole("button")[0]!);
    await waitFor(() => expect(fake.find("get", "/admin/defenses").length).toBeGreaterThan(before));
  });

  it("لا مناقشات أصلاً ⇒ «برمجة» تفتح نموذجاً فارغاً؛ ولا نتائج لفلتر ⇒ «امسح الفلاتر»", async () => {
    fake.on("get", "/admin/defenses", list([]));
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    expect(await screen.findByText(t("admin.noDefenses"))).toBeInTheDocument();
    const empty = screen.getByText(t("admin.defensesPage.emptyHint")).parentElement!;
    await app.user.click(within(empty).getByRole("button", { name: esc(t("admin.defensesPage.schedule")) }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("لا نتائج لفلتر ⇒ «امسح الفلاتر» يعيد الرابط نظيفاً", async () => {
    fake.on("get", "/admin/defenses", list([]));
    const app = renderApp("/ar/admin/defenses?status=cancelled", { as: "admin" });
    expect(await screen.findByText(t("admin.noResultsFilters"))).toBeInTheDocument();
    const empty = screen.getByText(t("admin.proj.emptyFilteredHint")).parentElement!;
    await app.user.click(within(empty).getByRole("button", { name: esc(t("admin.clearFilters")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/defenses"));
  });

  it("من البطاقة ومن الجدول: «تعديل» يفتح النموذج عليها، والحذف من الجدول بتأكيد", async () => {
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    const card = (await screen.findAllByTestId("defense-card"))[0]!;
    await app.user.click(within(card).getByTestId("defense-edit"));
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("defense-room")).toHaveValue(F.defense.room);
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defensesPage.viewTable")) }));
    const table = await screen.findByTestId("defenses-table");
    await app.user.click(within(table).getByRole("button", { name: t("admin.proj.editDefense") }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("defense-room")).toHaveValue(F.defense.room);
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(within(table).getByRole("button", { name: t("admin.proj.deleteDefense") }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.confirmDelete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/defenses/${F.defense.id}`)).toHaveLength(1));
  });

  it("بلا فريقٍ ولا لجنة وعليها تعارضات ⇒ «—» و«بلا لجنة» وشارتا التعارض بعدديهما", async () => {
    const clashes = {
      room: [{ id: "x1", title: "موضوعٌ آخر", date: F.defense.date }],
      professors: [
        { id: "x2", name: "سمير", title: "موضوعٌ ثالث", date: F.defense.date },
        { id: "x3", name: "كريم", title: "موضوعٌ رابع", date: F.defense.date },
      ],
    };
    fake.on("get", "/admin/defenses", list([{ ...F.defense, committee: [], clashes, group: { ...F.project, members: [] } }]));
    renderApp("/ar/admin/defenses", { as: "admin" });
    const card = (await screen.findAllByTestId("defense-card"))[0]!;
    expect(within(card).getByText(t("admin.noCommittee"))).toBeInTheDocument();
    expect(within(card).getByTestId("clash-room")).toHaveTextContent(t("admin.defensesPage.clashRoomBadge", { n: 1 }));
    expect(within(card).getByText(t("admin.defensesPage.clashProfBadge", { n: 2 }))).toBeInTheDocument();
    expect(within(card).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("صفحاتٌ كثيرة ⇒ التالي والسابق، ويُصعد إلى أعلى الصفحة", async () => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    fake.on("get", "/admin/defenses", list([{ ...F.defense, group: F.project }], 45));
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    await screen.findAllByTestId("defense-card");
    expect(screen.getByRole("button", { name: t("admin.proj.prev") })).toBeDisabled();
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    await waitFor(() => expect(app.location()).toContain("page=2"));
    await waitFor(() => expect(last("/admin/defenses")).toMatchObject({ page: 2 }));
    expect(scroll).toHaveBeenCalled();
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    await waitFor(() => expect(app.location()).toContain("page=1"));
    scroll.mockRestore();
  });
});

describe("المشاريع: ما حول القائمة", () => {
  const list = (items: object[], total = items.length) => (r: { query: Record<string, unknown> }) => ({
    items,
    total,
    page: Number(r.query.page ?? 1),
    limit: 12,
    stats: { total, defenseScheduled: 1, defenseDone: 0, noDefense: 0, withOverdue: 0, noPlan: 0 },
  });
  async function pick(app: ReturnType<typeof renderApp>, field: string, option: string) {
    await app.user.click(screen.getByRole("combobox", { name: field }));
    await app.user.click(await screen.findByRole("option", { name: esc(option) }));
  }

  it("فلاتر «المزيد» والمشرف: كلٌّ شريحةٌ باسم ما اختير، وكلّها في الرابط", async () => {
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    await screen.findAllByText(F.topicFull.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.moreFilters")) }));
    await pick(app, t("admin.faculty"), F.faculty.name);
    await pick(app, t("admin.department"), F.department.name);
    await pick(app, t("admin.specialization"), F.specialization.name);
    await pick(app, t("admin.academicYear"), F.year.title);
    await pick(app, t("admin.proj.col.defense"), t("admin.proj.defenseState.completed"));
    const picker = screen.getAllByRole("button").find((b) => b.getAttribute("aria-haspopup") === "listbox")!;
    await app.user.click(picker);
    await app.user.type(await screen.findByPlaceholderText(t("admin.searchProfessorAny")), "كريم");
    await app.user.click(await screen.findByRole("option", { name: /كريم/ }));

    await waitFor(() => expect(last("/admin/projects")).toMatchObject({
      facultyId: F.ID.fac1,
      departmentId: F.ID.dep1,
      specializationId: F.ID.spec1,
      academicYearId: F.ID.y1,
      defense: "completed",
      professorId: F.prof1.id,
    }));
    const chips = await screen.findByTestId("projects-active-filters");
    for (const text of [F.faculty.name, F.department.name, F.specialization.name, F.year.title, t("admin.proj.defenseState.completed"), "كريم"])
      expect(chips).toHaveTextContent(text);

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.stat.total")) }));
    await waitFor(() => expect(app.location()).not.toContain("defense="));
  });

  it("تعذّر التحميل ⇒ سببه، و«إعادة» تطلب من جديد", async () => {
    fake.fail("get", "/admin/projects", 500, "خطأ");
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    const msg = await screen.findByText(t("admin.projectsLoadFailed"));
    const before = fake.find("get", "/admin/projects").length;
    await app.user.click(within(msg.parentElement!).getAllByRole("button")[0]!);
    await waitFor(() => expect(fake.find("get", "/admin/projects").length).toBeGreaterThan(before));
  });

  it("وسم المناقشة على البطاقة: انتهت بعلامتها، وانتهت بلا علامة، وأُلغيت", async () => {
    const withDefense = (id: string, title: string, defense: object) => ({ ...F.project, id, topic: { ...F.project.topic, id: `t-${id}`, title }, defense: { ...F.project.defense, ...defense } });
    fake.on("get", "/admin/projects", list([
      withDefense("pA", "مذكرةٌ أولى", { status: "completed", grade: 15 }),
      withDefense("pB", "مذكرةٌ ثانية", { status: "completed", grade: null }),
      withDefense("pC", "مذكرةٌ ثالثة", { status: "cancelled" }),
    ]));
    renderApp("/ar/admin/projects", { as: "admin" });
    const grid = await screen.findByTestId("projects-grid");
    await within(grid).findByText("مذكرةٌ أولى");
    const card = async (title: string) => Array.from(grid.children).find((c) => c.textContent?.includes(title)) as HTMLElement;
    expect(await card("مذكرةٌ أولى")).toHaveTextContent(/15/);
    expect(await card("مذكرةٌ أولى")).toHaveTextContent(t("admin.proj.card.defenseDone", { grade: "" }).replace("/20", "").trim());
    expect(await card("مذكرةٌ ثانية")).toHaveTextContent(t("admin.proj.defenseState.completed"));
    expect(await card("مذكرةٌ ثالثة")).toHaveTextContent(t("admin.proj.defenseState.cancelled"));
  });

  it("صفحاتٌ كثيرة ⇒ رقم الصفحة ينقل إليها، والسابق يعود؛ و«البطاقات» تعيد العرض", async () => {
    fake.on("get", "/admin/projects", list([F.project], 120));
    localStorage.setItem("admin.projects.view", "table");
    const app = renderApp("/ar/admin/projects", { as: "admin" });
    await screen.findAllByText(F.topicFull.title);
    // الترقيم يُعاد رسمه مع كلّ صفحة، فيُطلب من جديد في كلّ خطوة.
    const pager = async () => within(await screen.findByRole("navigation", { name: t("admin.proj.pagination") }));
    const go = async (name: string) => app.user.click((await pager()).getByRole("button", { name }));

    // ١ ٢ … ١٠: ما حول الصفحة الحاليّة، والأولى والأخيرة.
    expect((await pager()).getByText("…")).toBeInTheDocument();
    await go("2");
    await waitFor(() => expect(app.location()).toContain("page=2"));
    await go("3");
    await waitFor(() => expect(app.location()).toContain("page=3"));
    await waitFor(() => expect(last("/admin/projects")).toMatchObject({ page: 3 }));
    await go(t("admin.proj.prev"));
    await waitFor(() => expect(app.location()).toContain("page=2"));

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.viewGrid")) }));
    expect(await screen.findByTestId("projects-grid")).toBeInTheDocument();
  });
});
