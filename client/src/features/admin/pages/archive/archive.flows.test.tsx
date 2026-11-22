import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * أرشيف السنوات: سجلّ كلّ سنةٍ بأقسامه، وإغلاق السنة الجارية، وإعادة فتح
 * سنةٍ أُغلقت.
 *
 * الإغلاق لا رجعة سهلة فيه: يمرّ بقائمة ما بقي معلّقاً، ثمّ يختار ما بعده
 * (سنةٌ جديدة باسمها، أو موجودة، أو لا شيء)، ثمّ يُكتب عنوان السنة بيده
 * تأكيداً. وكلّ ذلك يصل الخادم كما اختير.
 */
beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function archive(path = "/ar/admin/academic-years") {
  const app = renderApp(path, { as: "admin" });
  await screen.findAllByTestId("archive-year");
  return app;
}

describe("السجلّ", () => {
  it("كلّ تبويبٍ بقائمته، والبحث فيها، والسنة المؤرشفة من الأرشيف لا من الحيّ", async () => {
    const app = await archive();
    await screen.findByTestId("archive-tab-students");
    for (const tab of ["students", "topics", "projects", "defenses", "supervisors"]) {
      await app.user.click(screen.getByTestId(`archive-tab-${tab}`));
      expect(app.location()).toContain(`tab=${tab}`);
    }
    await app.user.click(screen.getByTestId("archive-tab-students"));
    await app.user.type(screen.getByTestId("archive-search"), "ليلى");
    await waitFor(() => expect(screen.queryAllByText("أمين حداد")).toEqual([]));
    expect(screen.getAllByText(/ليلى/).length).toBeGreaterThan(0);

    const past = screen.getAllByTestId("archive-year").find((b) => b.textContent?.includes(F.pastYear.title))!;
    await app.user.click(past);
    await waitFor(() => expect(fake.find("get", `/admin/archive/years/${F.pastYear.id}`)).toHaveLength(1));
    expect((await screen.findAllByTestId("record-source"))[0]).toBeInTheDocument();
  });
});

describe("إغلاق السنة", () => {
  it("قائمة المعلّق، ثمّ سنةٌ جديدة باسمها، ثمّ العنوان بخطّ اليد ⇒ يُغلق", async () => {
    const app = await archive();
    await app.user.click(screen.getByTestId("year-close"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByTestId("close-year-checklist")).toBeInTheDocument();
    await waitFor(() => expect(fake.find("get", `/admin/archive/years/${F.year.id}/readiness`)).toHaveLength(1));

    await app.user.click(within(dialog).getByTestId("close-year-next"));
    await app.user.click(within(dialog).getByTestId("next-new"));
    const title = within(dialog).getByTestId("next-new-title");
    // الاسم يُقترح من السنة التي تُغلق.
    expect(title).toHaveValue("2026/2027");
    await app.user.clear(title);
    await app.user.type(title, "2026-2027");
    expect(within(dialog).getByTestId("close-year-next")).toBeDisabled();
    await app.user.clear(title);
    await app.user.type(title, "2026/2027");
    await app.user.type(within(dialog).getByTestId("close-year-note"), "بعد آخر مناقشة");
    await app.user.click(within(dialog).getByTestId("close-year-next"));

    const confirm = within(dialog).getByTestId("close-year-confirm");
    await app.user.type(within(dialog).getByTestId("close-year-typed"), "2025/2027");
    expect(confirm).toBeDisabled();
    await app.user.clear(within(dialog).getByTestId("close-year-typed"));
    await app.user.type(within(dialog).getByTestId("close-year-typed"), F.year.title);
    await app.user.click(confirm);

    await waitFor(() => expect(fake.find("post", `/admin/archive/years/${F.year.id}/close`)).toHaveLength(1));
    expect(fake.find("post", `/admin/archive/years/${F.year.id}/close`)[0]!.body).toEqual({
      confirmTitle: F.year.title,
      note: "بعد آخر مناقشة",
      nextYearTitle: "2026/2027",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("سنةٌ موجودة بعدها ⇒ تُختار من قائمتها ويُرسل معرّفها؛ وبطاقة الخيار تُختار بلوحة المفاتيح؛ و«السابق» يعود", async () => {
    // النافذة تأخذ السنوات من قائمة الأرشيف نفسها.
    const future = { ...F.archiveYears[0]!, id: "e2000000-0000-4000-8000-000000002627", title: "2026/2027", isActive: false, archivedAt: null };
    const later = { ...future, id: "e3000000-0000-4000-8000-000000002728", title: "2027/2028" };
    fake.on("get", "/admin/archive/years", { items: [...F.archiveYears, future, later] });
    const app = await archive();
    await app.user.click(screen.getByTestId("year-close"));
    const dialog = await screen.findByRole("dialog");
    await app.user.click(within(dialog).getByTestId("close-year-next"));

    const existing = within(dialog).getByTestId("next-existing");
    existing.focus();
    await app.user.keyboard("{Enter}");
    // السنة التي تلي بالاسم مختارةٌ سلفاً؛ ويمكن تبديلها.
    const select = within(dialog).getByRole("combobox");
    expect(select).toHaveTextContent("2026/2027");
    await app.user.click(select);
    await app.user.click(await screen.findByRole("option", { name: /2027\/2028/ }));
    await app.user.click(within(dialog).getByTestId("close-year-next"));
    await app.user.click(within(dialog).getByRole("button", { name: new RegExp(t("admin.yearArchive.close.back")) }));
    expect(within(dialog).getByTestId("next-existing")).toBeInTheDocument();
    within(dialog).getByTestId("next-keep").focus();
    await app.user.keyboard(" ");
    within(dialog).getByTestId("next-existing").focus();
    await app.user.keyboard(" ");
    await app.user.click(within(dialog).getByTestId("close-year-next"));
    await app.user.type(within(dialog).getByTestId("close-year-typed"), F.year.title);
    await app.user.click(within(dialog).getByTestId("close-year-confirm"));
    await waitFor(() => expect(fake.find("post", `/admin/archive/years/${F.year.id}/close`)[0]?.body).toEqual({ confirmTitle: F.year.title, nextYearId: later.id }));
  });

  it("«إلغاء» يُغلق النافذة بلا طلب", async () => {
    const app = await archive();
    await app.user.click(screen.getByTestId("year-close"));
    const dialog = await screen.findByRole("dialog");
    await app.user.click(within(dialog).getAllByRole("button", { name: t("admin.cancel") }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fake.find("post", /\/close$/)).toEqual([]);
  });

  it("«لا شيء بعدها» ⇒ لا اسم ولا معرّف يُرسل", async () => {
    const app = await archive();
    await app.user.click(screen.getByTestId("year-close"));
    const dialog = await screen.findByRole("dialog");
    await app.user.click(within(dialog).getByTestId("close-year-next"));
    await app.user.click(within(dialog).getByTestId("next-keep"));
    await app.user.click(within(dialog).getByTestId("close-year-next"));
    await app.user.type(within(dialog).getByTestId("close-year-typed"), F.year.title);
    await app.user.click(within(dialog).getByTestId("close-year-confirm"));
    await waitFor(() => expect(fake.find("post", `/admin/archive/years/${F.year.id}/close`)[0]?.body).toEqual({ confirmTitle: F.year.title }));
  });
});

describe("إعادة الفتح", () => {
  it("سنةٌ مؤرشفة تُفتح، وتُجعل جاريةً إن طُلب", async () => {
    const app = await archive(`/ar/admin/academic-years?year=${F.pastYear.id}`);
    const past = screen.getAllByTestId("archive-year").find((b) => b.textContent?.includes(F.pastYear.title))!;
    await app.user.click(past);
    await app.user.click(await screen.findByTestId("year-reopen"));
    const dialog = await screen.findByRole("dialog");
    await app.user.click(within(dialog).getByTestId("reopen-year-activate"));
    await app.user.click(within(dialog).getByTestId("reopen-year-confirm"));
    await waitFor(() => expect(fake.find("post", `/admin/archive/years/${F.pastYear.id}/reopen`)[0]?.body).toEqual({ activate: true }));
  });
});

const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

describe("أقسام السجلّ", () => {
  it("اللوحات تُطوى وتُفتح واحدةً أو كلّها، وتبقى مطويّةً عند العودة", async () => {
    let app = await archive();
    const all = await screen.findByTestId("panels-toggle-all");
    const toggles = () => screen.getAllByTestId(/^panel-toggle-/);
    const first = toggles()[0]!;
    const expanded = first.getAttribute("aria-expanded");
    await app.user.click(first);
    expect(first.getAttribute("aria-expanded")).not.toBe(expanded);
    await app.user.click(all);
    const folded = toggles().map((b) => b.getAttribute("aria-expanded"));
    app.unmount();
    app = await archive();
    await screen.findByTestId("panels-toggle-all");
    expect(toggles().map((b) => b.getAttribute("aria-expanded"))).toEqual(folded);
    await app.user.click(screen.getByTestId("panels-toggle-all"));
  });

  it("«عرض الكلّ» في لوحةٍ ينقل إلى تبويبها", async () => {
    const app = await archive();
    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.yearArchive.seeAll.defenses")) }));
    await waitFor(() => expect(app.location()).toContain("tab=defenses"));
  });

  it.each(["students", "topics", "projects", "defenses"])("تبويب %s: كلّ شريحة فلترٍ تُختار", async (tab) => {
    const app = await archive(`/ar/admin/academic-years?tab=${tab}`);
    await screen.findByTestId(`archive-${tab}`);
    // شرائح القسم: المجموعة التي كلّ أزرارها تُبدَّل (aria-pressed).
    const group = screen
      .getAllByRole("group")
      .find((g) => {
        const b = within(g).queryAllByRole("button");
        return b.length > 1 && b.every((x) => x.hasAttribute("aria-pressed"));
      })!;
    // شريحةٌ بلا نتائج مطفأة: لا يُختار ما يُفرغ القائمة.
    const chips = within(group).getAllByRole("button").filter((c) => !(c as HTMLButtonElement).disabled);
    expect(chips.length).toBeGreaterThan(1);
    for (const chip of chips) {
      await app.user.click(chip);
      expect(chip).toHaveAttribute("aria-pressed", "true");
    }
  });
});

describe("سجلّاتٌ على الحدّين", () => {
  type Rec = ReturnType<typeof F.yearRecord>;
  const withRecord = (change: (r: Rec["record"]) => Rec["record"]) =>
    fake.on("get", "/admin/archive/years/:id", (r) => {
      const base = F.yearRecord(r.params.id!);
      return { ...base, record: change(base.record) };
    });

  it("سنةٌ بلا شيء ⇒ كلّ تبويبٍ يقول «لا شيء»، ولوحة المتفوّقين تقول إنّه لا علامات", async () => {
    withRecord((r) => ({
      ...r,
      summary: { ...r.summary, graded: 0, averageGrade: null, bestGrade: null, passRate: null, mentions: { excellent: 0, veryGood: 0, good: 0, fair: 0, fail: 0 } },
      students: [],
      topics: [],
      projects: [],
      defenses: [],
      supervisors: [],
      bySpecialization: [],
    }));
    const app = await archive();
    expect(await screen.findByText(t("admin.yearArchive.ov.honorEmpty"))).toBeInTheDocument();
    for (const tab of ["students", "topics", "projects", "defenses", "supervisors"]) {
      await app.user.click(await screen.findByTestId(`archive-tab-${tab}`));
      expect(await screen.findByText(t("admin.yearArchive.nothing"))).toBeInTheDocument();
    }
  });

  it("بحثٌ لا يطابق شيئاً ⇒ «لا تطابق» لا «لا شيء»", async () => {
    const app = await archive("/ar/admin/academic-years?tab=supervisors");
    await app.user.type(await screen.findByTestId("archive-search"), "zzzz");
    expect(await screen.findByText(t("admin.yearArchive.noMatch"))).toBeInTheDocument();
    await app.user.click(screen.getByTestId("archive-tab-students"));
    expect(await screen.findByText(t("admin.yearArchive.noMatch"))).toBeInTheDocument();
  });

  it("أكثر من ثلاثين ⇒ تُعرض ثلاثون و«عرض المزيد» يكشف البقيّة، في كلّ تبويب", async () => {
    const many = <T extends { id: string }>(list: T[], n: number, patch: (x: T, i: number) => Partial<T> = () => ({})) =>
      Array.from({ length: n }, (_, i) => ({ ...list[0]!, ...patch(list[0]!, i), id: `${list[0]!.id}-${i}` }));
    withRecord((r) => ({
      ...r,
      students: many(r.students, 35, (s, i) => ({ registrationNumber: `${s.registrationNumber}${i}` })),
      topics: many(r.topics, 35, (_t, i) => ({ title: `موضوع ${i}` })),
      projects: many(r.projects, 35),
      defenses: many(r.defenses, 35),
    }));
    const app = await archive();
    for (const tab of ["students", "topics", "projects", "defenses"]) {
      await app.user.click(await screen.findByTestId(`archive-tab-${tab}`));
      const more = await screen.findByRole("button", { name: esc(t("admin.yearArchive.showMore", { shown: 30, total: 35 })) });
      await app.user.click(more);
      await waitFor(() => expect(screen.queryByRole("button", { name: esc(t("admin.yearArchive.showMore", { shown: 30, total: 35 })) })).toBeNull());
    }
  });

  it("نتائج الطلبة: مبرمجةٌ، وانتهت بلا علامة، وبلا مناقشة — كلٌّ بوسمه", async () => {
    withRecord((r) => ({
      ...r,
      // النتيجة لا تُعرض إلّا لمن له مذكرة.
      students: r.students.map((s, i) => ({
        ...s,
        project: s.project ?? r.students[0]!.project,
        defense: [{ status: "scheduled", grade: null, mention: null }, { status: "completed", grade: null, mention: null }, null, s.defense][i] ?? null,
      })),
    }));
    const app = await archive();
    await app.user.click(await screen.findByTestId("archive-tab-students"));
    const table = await screen.findByTestId("archive-students");
    expect(within(table).getByText(t("admin.proj.defenseState.scheduled"))).toBeInTheDocument();
    expect(within(table).getByText(new RegExp(esc(t("admin.yearArchive.noGrade")).source))).toBeInTheDocument();
    expect(within(table).getAllByText(t("admin.proj.defenseState.none")).length).toBeGreaterThan(0);
  });

  it("تقديراتٌ متعدّدة ⇒ قطعةٌ لكلٍّ في الدائرة بعددها", async () => {
    withRecord((r) => ({ ...r, summary: { ...r.summary, graded: 4, mentions: { excellent: 1, veryGood: 2, good: 0, fair: 1, fail: 0 } } }));
    await archive();
    await screen.findByTestId("panels-toggle-all");
    await waitFor(() => expect(document.querySelectorAll("svg circle[stroke-dasharray]").length).toBeGreaterThanOrEqual(3));
  });
});
