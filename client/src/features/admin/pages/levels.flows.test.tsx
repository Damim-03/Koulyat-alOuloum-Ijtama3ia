import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../i18n/i18n";
import { fake } from "../../../test/fake-api";
import { renderApp } from "../../../test/render-app";
import * as F from "../../../test/fixtures";

/**
 * مستويات البنية — كلّية ← قسم ← ميدان ← شعبة ← تخصّص — كلٌّ في صفحته.
 *
 * الصفحات الأربع بنمطٍ واحد: يُضاف ابنٌ من رأسها (باسمه ورمزٍ يُولَّد)،
 * ويُعدَّل المستوى نفسه، ويُحذف بعد نافذةٍ تعدّد ما يرتبط به. فيُجرَّب النمط
 * على كلّ مستوى: أنّ الابن يُرسل إلى مساره مربوطاً بأبيه.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

const base = `/ar/admin/faculties/${F.ID.fac1}/departments/${F.ID.dep1}`;
const LEVELS = [
  {
    level: "الكلّية",
    path: `/ar/admin/faculties/${F.ID.fac1}`,
    title: F.faculty.name,
    add: "admin.addDepartment",
    childPlaceholder: "admin.departmentName",
    create: "/admin/departments",
    parent: { facultyId: F.ID.fac1 },
    self: `/admin/faculties/${F.ID.fac1}`,
  },
  {
    level: "القسم",
    path: base,
    title: F.department.name,
    add: "admin.addDomain",
    childPlaceholder: "admin.domainName",
    create: "/admin/domains",
    parent: { departmentId: F.ID.dep1 },
    self: `/admin/departments/${F.ID.dep1}`,
  },
  {
    level: "الميدان",
    path: `${base}/domains/${F.domain.id}`,
    title: F.domain.name,
    add: "admin.addFiliere",
    childPlaceholder: "admin.filiereName",
    create: "/admin/filieres",
    parent: { domainId: F.domain.id },
    self: `/admin/domains/${F.domain.id}`,
  },
  {
    level: "الشعبة",
    path: `${base}/domains/${F.domain.id}/filieres/${F.filiere.id}`,
    title: F.filiere.name,
    add: "admin.addSpecialization",
    childPlaceholder: "admin.specializationName",
    create: "/admin/specializations",
    parent: { filiereId: F.filiere.id },
    self: `/admin/filieres/${F.filiere.id}`,
  },
];

describe.each(LEVELS)("$level", (L) => {
  async function open() {
    const app = renderApp(L.path, { as: "admin" });
    await screen.findByRole("button", { name: esc(t(L.add)) });
    return app;
  }

  it("ابنٌ جديد باسمه ⇒ يُرسل مربوطاً بأبيه", async () => {
    const app = await open();
    await app.user.click(screen.getByRole("button", { name: esc(t(L.add)) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.type(within(dialog).getByPlaceholderText(t(L.childPlaceholder)), "عنصرٌ جديد");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveData")) }));
    await waitFor(() => expect(fake.find("post", L.create)).toHaveLength(1));
    expect(fake.find("post", L.create)[0]!.body).toMatchObject({ name: "عنصرٌ جديد", ...L.parent });
  });

  it("تعديل المستوى نفسه يُرسل إلى مساره", async () => {
    const app = await open();
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.edit")) })[0]!);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    const name = within(dialog).getByDisplayValue(L.title);
    await app.user.type(name, " (معدّل)");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveData")) }));
    await waitFor(() => expect(fake.find("patch", L.self)[0]?.body).toMatchObject({ name: `${L.title} (معدّل)` }));
  });
});

describe("الحذف يقول ما يمنعه", () => {
  it("قسمٌ له ميادين لا يُحذف (زرّه مقفلٌ بسببه)، وقسمٌ فارغ يُحذف بعد التأكيد", async () => {
    const app = renderApp(`/ar/admin/faculties/${F.ID.fac1}`, { as: "admin" });
    await screen.findAllByText(F.department2.name);
    const card = (name: string) => {
      let node: HTMLElement | null = screen.getAllByText(name).at(-1)!;
      while (node && !within(node).queryAllByRole("button").length) node = node.parentElement;
      return node!;
    };
    // المقفل: اسمه سبب المنع لا «حذف».
    expect(within(card(F.department.name)).queryByRole("button", { name: t("admin.delete") })).toBeNull();

    await app.user.click(within(card(F.department2.name)).getByRole("button", { name: t("admin.delete") }));
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByText(t("admin.struct.del.nothingLinked"))).toBeInTheDocument();
    await app.user.click(within(alert).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/departments/${F.ID.dep2}`)).toHaveLength(1));
  });
});

describe("صفحة التخصّصات", () => {
  it("تخصّصٌ جديد: الشعبة أوّلاً، ثمّ الاسم والطور", async () => {
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    await app.user.click(await screen.findByTestId("spec-add"));
    let dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("combobox"));
    await app.user.click(await screen.findByRole("option", { name: esc(F.filiere.name) }));
    await app.user.click(within(dialog).getByTestId("spec-pick-continue"));

    dialog = await screen.findByRole("dialog", { name: t("admin.newSpecialization") });
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.specializationName")), "علم الاجتماع الحضري");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.levelMaster")) }));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveData")) }));
    await waitFor(() => expect(fake.find("post", "/admin/specializations")[0]?.body).toMatchObject({
      name: "علم الاجتماع الحضري",
      level: "master",
      filiereId: F.filiere.id,
    }));
  });

  it("الجدول، والبحث، وحذف تخصّصٍ من صفّه", async () => {
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    await screen.findByTestId("spec-grid");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.struct.viewTable")) }));
    const table = await screen.findByTestId("spec-table");
    expect(app.location()).toContain("view=table");
    await app.user.type(screen.getByPlaceholderText(t("admin.searchSpecialization")), "العام");
    await waitFor(() => expect(within(table).queryByText(F.specialization.name)).toBeNull());
    // تخصّصٌ له طلبة: زرّ حذفه مقفلٌ واسمه السبب.
    expect(within(table).queryByRole("button", { name: t("admin.delete") })).toBeNull();
  });

  it("تخصّصٌ بلا طلبةٍ ولا مواضيع يُحذف بعد التأكيد", async () => {
    fake.on("get", "/admin/specializations", { specializations: [F.specialization, { ...F.specialization2, _count: { students: 0, topics: 0 } }] });
    const app = renderApp("/ar/admin/specializations?view=table", { as: "admin" });
    const table = await screen.findByTestId("spec-table");
    await app.user.click(within(table).getByRole("button", { name: t("admin.delete") }));
    await app.user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/specializations/${F.ID.spec2}`)).toHaveLength(1));
  });
});

describe("صفحة التخصّصات: الفلاتر والصفحات والحالات", () => {
  const specs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...(i % 2 ? F.specialization2 : F.specialization),
      id: `sp-${String(i).padStart(3, "0")}`,
      name: `تخصّص ${String(i).padStart(3, "0")}`,
      _count: { students: i % 3 === 0 ? 0 : i, topics: i % 4 === 0 ? 0 : 2 },
    }));
  /** بطاقات الأرقام أزرارٌ تُبدَّل، وفيها رقمها بخطٍّ عريض. */
  const tile = (label: string) =>
    screen.getAllByRole("button", { name: esc(label) }).find((b) => b.hasAttribute("aria-pressed") && b.querySelector("b"))!;

  it("بطاقات الأرقام فلاتر: الطور، و«بلا طلبة»، و«بلا مواضيع»، و«الكلّ» يُلغيها", async () => {
    fake.on("get", "/admin/specializations", { specializations: specs(10) });
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    await screen.findByTestId("spec-grid");

    await app.user.click(tile(t("admin.struct.health.noStudents")));
    await waitFor(() => expect(app.location()).toContain("flag=empty"));
    expect(screen.getAllByTestId("spec-card")).toHaveLength(4);
    await app.user.click(tile(t("admin.struct.health.noTopics")));
    await waitFor(() => expect(app.location()).toContain("flag=noTopics"));
    expect(screen.getAllByTestId("spec-card")).toHaveLength(3);
    await app.user.click(tile(t("admin.proj.level.master")));
    await waitFor(() => expect(app.location()).toContain("level=master"));
    await app.user.click(tile(t("admin.statSpecializations")));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/specializations"));
    expect(screen.getAllByTestId("spec-card")).toHaveLength(10);
  });

  it("الترتيب بالطلبة، وشريحة الطور، و«مسح الكلّ» يُبقي طريقة العرض", async () => {
    fake.on("get", "/admin/specializations", { specializations: specs(6) });
    const app = renderApp("/ar/admin/specializations?view=table", { as: "admin" });
    const table = await screen.findByTestId("spec-table");
    const sort = screen.getAllByRole("combobox").find((c) => c.getAttribute("title") === t("admin.sortNameAsc"))!;
    await app.user.click(sort);
    await app.user.click(await screen.findByRole("option", { name: esc(t("admin.struct.sortStudents")) }));
    await waitFor(() => expect(app.location()).toContain("sort=students"));
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("تخصّص 005");

    const chip = screen.getAllByRole("button").find((b) => b.hasAttribute("aria-pressed") && !b.querySelector("b") && b.textContent?.includes(t("admin.proj.level.licence")))!;
    await app.user.click(chip);
    await waitFor(() => expect(app.location()).toContain("level=licence"));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.clearAll")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/specializations?view=table"));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.struct.viewCards")) }));
    expect(await screen.findByTestId("spec-grid")).toBeInTheDocument();
  });

  it("مئةُ تخصّص ⇒ صفحاتٌ بأرقامها وفجواتها، والسابق والتالي", async () => {
    fake.on("get", "/admin/specializations", { specializations: specs(100) });
    const app = renderApp("/ar/admin/specializations?page=5", { as: "admin" });
    await screen.findByTestId("spec-grid");
    expect(screen.getByRole("button", { name: "5" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("…")).toHaveLength(2);
    await app.user.click(screen.getByRole("button", { name: "9" }));
    await waitFor(() => expect(app.location()).toContain("page=9"));
    expect(screen.getByRole("button", { name: t("admin.proj.next") })).toBeDisabled();
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    await waitFor(() => expect(app.location()).toContain("page=8"));
    await app.user.click(screen.getByRole("button", { name: "1" }));
    await waitFor(() => expect(app.location()).not.toContain("page="));
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    await waitFor(() => expect(app.location()).toContain("page=2"));
  });

  it("تعذّر التحميل ⇒ «إعادة»؛ ولا تخصّصات ⇒ زرّ الإضافة يفتح اختيار الشعبة، ويُلغى", async () => {
    fake.fail("get", "/admin/specializations", 500, "خطأ");
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    const msg = await screen.findByText(t("admin.specsLoadFailed"));
    const before = fake.find("get", "/admin/specializations").length;
    fake.on("get", "/admin/specializations", { specializations: [] });
    await app.user.click(within(msg.parentElement!).getAllByRole("button")[0]!);
    await waitFor(() => expect(fake.find("get", "/admin/specializations").length).toBeGreaterThan(before));

    expect(await screen.findByText(t("admin.noSpecializations"))).toBeInTheDocument();
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.addSpecialization")) }).at(-1)!);
    const picker = await screen.findByRole("dialog", { name: t("admin.addSpecialization") });
    expect(within(picker).getByTestId("spec-pick-continue")).toBeDisabled();
    await app.user.click(within(picker).getByRole("button", { name: t("admin.cancel") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("لا شعب بعد ⇒ اختيار الشعبة يقول ذلك", async () => {
    fake.on("get", "/admin/filieres", { filieres: [] });
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    await app.user.click(await screen.findByTestId("spec-add"));
    expect(await screen.findByText(t("admin.struct.specs.noFilieres"))).toBeInTheDocument();
  });

  it("فلترٌ بلا نتيجة ⇒ «لا نتائج»", async () => {
    renderApp("/ar/admin/specializations?q=zzzz", { as: "admin" });
    expect(await screen.findByText(t("admin.noFilterResults"))).toBeInTheDocument();
  });

  it("من البطاقة: «تعديل» يفتح التخصّص باسمه ويُغلق، و«حذف» تخصّصٍ فارغ بتأكيد", async () => {
    fake.on("get", "/admin/specializations", { specializations: [{ ...F.specialization2, _count: { students: 0, topics: 0 } }] });
    const app = renderApp("/ar/admin/specializations", { as: "admin" });
    const card = (await screen.findAllByTestId("spec-card"))[0]!;
    await app.user.click(within(card).getByRole("button", { name: esc(t("admin.edit")) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue(F.specialization2.name)).toBeInTheDocument();
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(within(card).getByRole("button", { name: esc(t("admin.delete")) }));
    await app.user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/specializations/${F.ID.spec2}`)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("من الجدول: «تعديل» يفتح التخصّص باسمه", async () => {
    const app = renderApp("/ar/admin/specializations?view=table", { as: "admin" });
    const table = await screen.findByTestId("spec-table");
    await app.user.click(within(table).getAllByRole("button", { name: t("admin.edit") })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByPlaceholderText(t("admin.specializationName"))).not.toHaveValue("");
  });
});

describe("صفحتا القسم والميدان: ترتيب الأبناء وإدارتهم، وحذف المستوى نفسه", () => {
  const sortBy = async (app: ReturnType<typeof renderApp>, label: string) => {
    await app.user.click(screen.getByRole("combobox", { name: t("admin.struct.sort") }));
    await app.user.click(await screen.findByRole("option", { name: esc(label) }));
  };
  const card = (name: string) => {
    let node: HTMLElement | null = screen.getAllByText(name).at(-1)!;
    while (node && !within(node).queryAllByRole("button").length) node = node.parentElement;
    return node!;
  };

  it("القسم: ميادينه تُرتَّب، وميدانٌ يُعدَّل باسمه، وفارغٌ يُحذف بتأكيد", async () => {
    const empty = { ...F.domain, id: "dom-empty", name: "أ ميدانٌ فارغ", code: "EM", _count: { filieres: 0 } };
    fake.on("get", "/admin/domains", { domains: [F.domain, empty] });
    const app = renderApp(base, { as: "admin" });
    await screen.findAllByText(empty.name);
    await sortBy(app, t("admin.struct.sortSpecs"));
    await sortBy(app, t("admin.struct.sortStudents"));
    await sortBy(app, t("admin.sortNameAsc"));

    await app.user.click(within(card(F.domain.name)).getByRole("button", { name: esc(t("admin.edit")) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue(F.domain.name)).toBeInTheDocument();
    await app.user.click(within(dialog).getAllByRole("button", { name: new RegExp(`${esc(t("admin.close")).source}|${esc(t("admin.cancel")).source}`) })[0]!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(within(card(empty.name)).getByRole("button", { name: t("admin.delete") }));
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", "/admin/domains/dom-empty")).toHaveLength(1));
  });

  it("قسمٌ بلا أبناء ولا أساتذة ⇒ يُحذف هو نفسه من رأسه بتأكيد", async () => {
    fake.on("get", "/admin/domains", { domains: [] });
    const app = renderApp(`/ar/admin/faculties/${F.ID.fac1}/departments/${F.ID.dep2}`, { as: "admin" });
    await screen.findAllByText(F.department2.name);
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.delete")) })[0]!);
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/departments/${F.ID.dep2}`)).toHaveLength(1));
  });

  it("الميدان: شعبه تُرتَّب، وشعبةٌ تُعدَّل باسمها، وفارغةٌ تُحذف بتأكيد", async () => {
    const empty = { ...F.filiere, id: "fil-empty", name: "أ شعبةٌ فارغة", code: "EF", _count: { specializations: 0 } };
    fake.on("get", "/admin/filieres", { filieres: [F.filiere, empty] });
    const app = renderApp(`${base}/domains/${F.domain.id}`, { as: "admin" });
    await screen.findAllByText(empty.name);
    await sortBy(app, t("admin.struct.sortSpecs"));
    await sortBy(app, t("admin.struct.sortStudents"));
    await sortBy(app, t("admin.sortNameAsc"));

    await app.user.click(within(card(F.filiere.name)).getByRole("button", { name: esc(t("admin.edit")) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue(F.filiere.name)).toBeInTheDocument();
    await app.user.click(within(dialog).getAllByRole("button", { name: new RegExp(`${esc(t("admin.close")).source}|${esc(t("admin.cancel")).source}`) })[0]!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(within(card(empty.name)).getByRole("button", { name: t("admin.delete") }));
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", "/admin/filieres/fil-empty")).toHaveLength(1));
  });
});
