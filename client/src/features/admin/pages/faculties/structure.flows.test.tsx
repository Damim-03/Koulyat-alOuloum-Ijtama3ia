import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * البنية الأكاديمية: كلّيةٌ وأقسامها وميادينها وشُعبها وتخصّصاتها — تُبنى
 * بمعالجٍ واحدٍ في معاملةٍ واحدة، وتُتصفَّح شجرةً.
 *
 * يُحرس: أنّ الكلّية وحدها مطلوبة وما بعدها اختياريّ؛ وأنّ صفّاً مسودّاً بلا
 * اسمٍ يمنع الحفظ؛ وأنّ ما يُرسل يربط كلّ عنصرٍ بأبيه — المسودّ بمفتاحه،
 * والموجود بمعرّفه.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function openWizard() {
  const app = renderApp("/ar/admin/faculties", { as: "admin" });
  await app.user.click(await screen.findByRole("button", { name: esc(t("admin.addAcademicStructure")) }));
  return { app, dialog: await screen.findByRole("dialog", { name: t("admin.addAcademicStructure") }) };
}
const next = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: esc(t("admin.next")) });
const save = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: esc(t("admin.saveStructure")) });

describe("معالج البنية", () => {
  it("كلّيةٌ جديدة بقسمٍ وميدانٍ وشعبةٍ وتخصّص ⇒ تُرسل مترابطةً في طلبٍ واحد", async () => {
    const { app, dialog } = await openWizard();
    expect(next(dialog)).toBeDisabled();

    await app.user.type(within(dialog).getByPlaceholderText(t("admin.facultyExamplePlaceholder")), "كلية الآداب واللغات");
    expect(next(dialog)).toBeEnabled();
    await app.user.click(next(dialog));

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addDepartment")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.departmentExamplePlaceholder")), "قسم اللغة العربية");
    await app.user.click(next(dialog));

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addDomain")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.domainExamplePlaceholder")), "اللغة والأدب");
    await app.user.click(next(dialog));

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addFiliere")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.filiereExamplePlaceholder")), "دراسات لغوية");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addSpecializationShort")) }));
    // صفّ تخصّصٍ بلا اسم يمنع الحفظ.
    expect(save(dialog)).toBeDisabled();
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.specializationExamplePlaceholder")), "لسانيات تطبيقية");
    expect(save(dialog)).toBeEnabled();
    await app.user.click(save(dialog));

    await waitFor(() => expect(fake.find("post", "/admin/academic-structure")).toHaveLength(1));
    const body = fake.find("post", "/admin/academic-structure")[0]!.body as {
      faculty: { kind: string; name: string; code: string };
      departments: { key: string; name: string; code: string }[];
      domains: { name: string; department: { kind: string; value: string } }[];
      filieres: { name: string; department: { kind: string; value: string }; specializations: { name: string; level: string }[] }[];
    };
    expect(body.faculty).toMatchObject({ kind: "new", name: "كلية الآداب واللغات" });
    expect(body.faculty.code).not.toBe("");
    expect(body.departments).toEqual([expect.objectContaining({ name: "قسم اللغة العربية" })]);
    const deptKey = body.departments[0]!.key;
    expect(body.domains[0]).toMatchObject({ name: "اللغة والأدب", department: { kind: "new", value: deptKey } });
    expect(body.filieres[0]).toMatchObject({ name: "دراسات لغوية", department: { kind: "new", value: deptKey } });
    expect(body.filieres[0]!.specializations).toEqual([expect.objectContaining({ name: "لسانيات تطبيقية" })]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("كلّيةٌ موجودة ⇒ يُعرض ما فيها، وقسمٌ جديدٌ يُضاف إليها بمعرّفها", async () => {
    const { app, dialog } = await openWizard();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.existingFaculty")) }));
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.selectPlaceholder") }));
    await app.user.click(await screen.findByRole("option", { name: esc(F.faculty.name) }));
    expect(await within(dialog).findByText(t("admin.facultyCurrentContent"))).toBeInTheDocument();

    await app.user.click(next(dialog));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addDepartment")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.departmentExamplePlaceholder")), "قسم الفلسفة");
    await app.user.click(save(dialog));
    await waitFor(() => expect(fake.find("post", "/admin/academic-structure")[0]?.body).toMatchObject({
      faculty: { kind: "existing", id: F.faculty.id },
      departments: [expect.objectContaining({ name: "قسم الفلسفة" })],
    }));
  });

  it("السابق يعيد الخطوة بما كُتب فيها", async () => {
    const { app, dialog } = await openWizard();
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.facultyExamplePlaceholder")), "كلية الحقوق");
    await app.user.click(next(dialog));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.previous")) }));
    expect(within(dialog).getByDisplayValue("كلية الحقوق")).toBeInTheDocument();
  });
});

describe("كلّيةٌ وحدها", () => {
  it("الاسم يولّد رمزها، ويُحفظ الاثنان", async () => {
    const app = renderApp("/ar/admin/faculties", { as: "admin" });
    await app.user.click(await screen.findByTestId("faculty-add"));
    const dialog = await screen.findByRole("dialog", { name: t("admin.addFaculty") });
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.facultyNamePlaceholder")), "كلية العلوم الاقتصادية");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveData")) }));
    await waitFor(() => expect(fake.find("post", "/admin/faculties")).toHaveLength(1));
    const body = fake.find("post", "/admin/faculties")[0]!.body as { name: string; code: string };
    expect(body.name).toBe("كلية العلوم الاقتصادية");
    expect(body.code).toMatch(/\S/);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("الشجرة", () => {
  it("عرض الشجرة: فتح الكلّ وطيّه، وكلّ عقدةٍ رابطٌ إلى صفحتها", async () => {
    const app = renderApp("/ar/admin/faculties", { as: "admin" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.struct.viewTree")) }));
    const tree = await screen.findByTestId("structure-tree");
    await waitFor(() => expect(within(tree).getAllByRole("link", { name: esc(F.faculty.name) }).length).toBeGreaterThan(0));

    await app.user.click(within(tree).getAllByRole("button")[0]!);
    expect((await within(tree).findAllByRole("link", { name: esc(F.specialization.name) }))[0]).toHaveAttribute("href", `/ar/admin/specializations/${F.specialization.id}`);
    const toggles = within(tree).getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
    expect(toggles.length).toBeGreaterThan(0);
    await app.user.click(toggles[0]!);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    await app.user.click(within(tree).getAllByRole("button")[1]!);
    await waitFor(() => expect(within(tree).queryAllByRole("link", { name: esc(F.specialization.name) })).toEqual([]));
  });
});

describe("المعالج: الحذف والترابط", () => {
  it("بلا أقسام ⇒ الميادين تطلب قسماً أوّلاً، و«رجوع» يعيد إليها", async () => {
    const { app, dialog } = await openWizard();
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.facultyExamplePlaceholder")), "كلية الطب");
    await app.user.click(next(dialog));
    await app.user.click(next(dialog));
    expect(within(dialog).getByText(t("admin.addDepartmentFirstHint"))).toBeInTheDocument();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.backToDepartments")) }));
    expect(within(dialog).getByRole("button", { name: esc(t("admin.addDepartment")) })).toBeInTheDocument();
  });

  it("حذف قسمٍ مسودٍّ يحذف ميادينه وشعبه معه، وحذف ميدانٍ يفكّ شعبه عنه", async () => {
    const { app, dialog } = await openWizard();
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.facultyExamplePlaceholder")), "كلية الطب");
    await app.user.click(next(dialog));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addDepartment")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.departmentExamplePlaceholder")), "قسم الطب العام");
    await app.user.click(next(dialog));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addDomain")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.domainExamplePlaceholder")), "العلوم الطبية");
    await app.user.click(next(dialog));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addFiliere")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.filiereExamplePlaceholder")), "طب");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addSpecializationShort")) }));
    await app.user.click(within(dialog).getAllByTitle(t("pro.delete")).at(-1)!);
    expect(within(dialog).queryByPlaceholderText(t("admin.specializationExamplePlaceholder"))).toBeNull();

    // الرجوع إلى الميادين وحذف الميدان: الشعبة تبقى بلا ميدان.
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.previous")) }));
    await app.user.click(within(dialog).getAllByTitle(t("pro.delete"))[0]!);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.previous")) }));
    await app.user.click(within(dialog).getAllByTitle(t("pro.delete"))[0]!);
    await app.user.click(next(dialog));
    await app.user.click(next(dialog));
    expect(within(dialog).queryByDisplayValue("طب")).toBeNull();
    await app.user.click(save(dialog));
    await waitFor(() => expect(fake.find("post", "/admin/academic-structure")[0]?.body).toMatchObject({ departments: [], domains: [], filieres: [] }));
  });
});

describe("المعالج على كلّيةٍ موجودة: الربط بما فيها", () => {
  it("ميدانٌ جديد في قسمٍ قائم، وشعبةٌ في قسمٍ وميدانٍ قائمين بتخصّصٍ طورُه ليسانس؛ والشعبة الزائدة تُحذف", async () => {
    const { app, dialog } = await openWizard();
    const pick = async (field: string, option: string, nth = 0) => {
      await app.user.click(within(dialog).getAllByRole("combobox", { name: field })[nth]!);
      await app.user.click(await screen.findByRole("option", { name: esc(option) }));
    };
    const existing = (name: string) => t("admin.existingOption", { name });

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.existingFaculty")) }));
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.selectPlaceholder") }));
    await app.user.click(await screen.findByRole("option", { name: esc(F.faculty.name) }));
    await app.user.click(next(dialog));
    await app.user.click(next(dialog));

    // الميادين: القائم معروضٌ بقسمه، والجديد يُربط بقسمٍ قائم.
    expect(within(dialog).getByText(t("admin.existingDomains"))).toBeInTheDocument();
    expect(within(dialog).getByText(F.domain.name)).toBeInTheDocument();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addDomain")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.domainExamplePlaceholder")), "علوم التربية");
    await pick(t("admin.department"), existing(F.department.name));
    await app.user.click(next(dialog));

    // الشعب: القائمة معروضة، وشعبتان جديدتان تُحذف ثانيتهما.
    expect(within(dialog).getByText(t("admin.existingFilieres"))).toBeInTheDocument();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addFiliere")) }));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.addFiliere")) }));
    const names = within(dialog).getAllByPlaceholderText(t("admin.filiereExamplePlaceholder"));
    await app.user.type(names[0]!, "علم النفس التربوي");
    await app.user.type(names[1]!, "شعبةٌ زائدة");
    await pick(t("admin.department"), existing(F.department.name));
    await pick(t("admin.domainLabel"), existing(F.domain.name));
    await app.user.click(within(dialog).getAllByRole("button", { name: esc(t("admin.addSpecializationShort")) })[0]!);
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.specializationExamplePlaceholder")), "إرشادٌ وتوجيه");
    await pick(t("admin.level"), t("admin.levelLicence"));
    // زرّ الحذف الأخير هو زرّ الشعبة الثانية (لا تخصّص فيها).
    await app.user.click(within(dialog).getAllByRole("button", { name: t("pro.delete") }).at(-1)!);
    expect(within(dialog).queryByDisplayValue("شعبةٌ زائدة")).toBeNull();

    await app.user.click(save(dialog));
    await waitFor(() => expect(fake.find("post", "/admin/academic-structure")).toHaveLength(1));
    const body = fake.find("post", "/admin/academic-structure")[0]!.body as {
      domains: { name: string; department: object }[];
      filieres: { name: string; department: object; domain: object | null; specializations: { name: string; level: string }[] }[];
    };
    expect(body.domains).toEqual([expect.objectContaining({ name: "علوم التربية", department: { kind: "existing", value: F.department.id } })]);
    expect(body.filieres).toHaveLength(1);
    expect(body.filieres[0]).toMatchObject({
      name: "علم النفس التربوي",
      department: { kind: "existing", value: F.department.id },
      domain: { kind: "existing", value: F.domain.id },
      specializations: [{ name: "إرشادٌ وتوجيه", level: "licence" }],
    });
  });
});

describe("صفحة الكلّيات: الترتيب والعرض والحالات", () => {
  const second = { ...F.faculty, id: "a2000000-0000-4000-8000-000000000002", name: "أ كلية الآداب", code: "FL", _count: { departments: 5 } };

  it("الترتيب بالأقسام ثمّ بالطلبة ثمّ بالاسم؛ والشجرة ثمّ البطاقات", async () => {
    fake.on("get", "/admin/faculties", { faculties: [F.faculty, second] });
    const app = renderApp("/ar/admin/faculties", { as: "admin" });
    await screen.findAllByText(second.name);
    const order = () => screen.getAllByTestId(/faculty-card|node-card/).map((c) => c.textContent ?? "").map((x) => (x.includes(second.name) ? "second" : "first"));
    const pick = async (label: string) => {
      await app.user.click(screen.getByRole("combobox", { name: t("admin.struct.sort") }));
      await app.user.click(await screen.findByRole("option", { name: esc(label) }));
    };
    await pick(t("admin.sortDepartmentsDesc"));
    expect(order()[0]).toBe("second");
    await pick(t("admin.struct.sortStudents"));
    await pick(t("admin.sortNameAsc"));
    expect(order()[0]).toBe("second");

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.struct.viewTree")) }));
    await waitFor(() => expect(app.location()).toContain("view=tree"));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.struct.viewCards")) }));
    await waitFor(() => expect(app.location()).not.toContain("view="));
  });

  it("«تحتاج إكمالاً» في الرأس تحصر البطاقات فيما ينقصه شيء، وتعود إلى البطاقات من الشجرة", async () => {
    const app = renderApp("/ar/admin/faculties?view=tree", { as: "admin" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.struct.needing", { count: 1 })) }));
    await waitFor(() => expect(app.location()).not.toContain("view=tree"));
    expect(screen.getAllByRole("button", { pressed: true }).some((b) => b.textContent?.includes(t("admin.needsCompletion")))).toBe(true);
  });

  it("«تعديل» من البطاقة يفتح الكلّية باسمها؛ وتعذّر التحميل ⇒ «إعادة»", async () => {
    let app = renderApp("/ar/admin/faculties", { as: "admin" });
    await screen.findAllByText(F.faculty.name);
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.edit")) })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue(F.faculty.name)).toBeInTheDocument();
    app.unmount();

    fake.fail("get", "/admin/faculties", 500, "خطأ");
    app = renderApp("/ar/admin/faculties", { as: "admin" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", "/admin/faculties").length;
    await app.user.click(retry);
    await waitFor(() => expect(fake.find("get", "/admin/faculties").length).toBeGreaterThan(before));
  });
});
