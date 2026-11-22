import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * الأستاذ في الإدارة: بريده الجامعيّ (اسمٌ ونطاقٌ من نطاقات الجامعة)،
 * ورتبته وصفته وسوماً، وقسمه — ونطاقات البريد نفسها تُدار من الحقل.
 *
 * يُحرس: أنّ البريد يُبنى من الجزء المكتوب والنطاق المختار؛ وأنّ الاسم العربيّ
 * المفرَّغ يُرسل null؛ وأنّ الوسوم تُضاف بـEnter وتُزال؛ وأنّ تغيير النطاقات
 * يصل مساراته.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function editProfessor() {
  const app = renderApp(`/ar/admin/professors/${F.prof1.id}`, { as: "admin" });
  await screen.findAllByText(F.prof1.employeeNumber);
  await app.user.click(screen.getByRole("button", { name: t("pro.edit") }));
  const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
  await within(dialog).findByDisplayValue("Karim");
  return { app, dialog };
}
const save = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: esc(t("admin.saveChangesShort")) });
const update = () => fake.find("patch", `/admin/professors/${F.prof1.id}`)[0]?.body as Record<string, unknown> | undefined;

describe("تعديل الأستاذ", () => {
  it("بريدٌ بنطاقٍ آخر، ورتبةٌ تُضاف بـEnter، واسمٌ عربيّ يُمسح ⇒ يُرسل الكلّ", async () => {
    const { app, dialog } = await editProfessor();
    const local = within(dialog).getByDisplayValue(F.prof1.universityEmail.split("@")[0]!);
    await app.user.clear(local);
    await app.user.type(local, "k.mansouri");
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.emailShapesAndDomains") }));
    await app.user.click(await within(dialog).findByRole("button", { name: /univ-alger\.dz/ }));

    await app.user.type(within(dialog).getByRole("textbox", { name: t("admin.gradeLabel") }), "أستاذ محاضر ب{Enter}");
    await app.user.clear(within(dialog).getByDisplayValue("كريم"));
    await app.user.click(save(dialog));

    await waitFor(() => expect(update()).toBeDefined());
    expect(update()).toMatchObject({
      universityEmail: "k.mansouri@univ-alger.dz",
      firstName: null,
      firstNameLatin: "Karim",
      lastNameLatin: "MANSOURI",
      departmentId: F.department.id,
    });
    expect(update()!.grade).toEqual(expect.arrayContaining(["أستاذ محاضر أ", "أستاذ محاضر ب"]));
  });

  it("وسمٌ يُزال بزرّه", async () => {
    const { app, dialog } = await editProfessor();
    await app.user.click(within(dialog).getByRole("button", { name: `${t("admin.removeCover")} رئيس فرقة بحث` }));
    await app.user.click(save(dialog));
    await waitFor(() => expect(update()).toBeDefined());
    expect(update()!.tags).toEqual([]);
  });

  it("بريدٌ بلا جزءٍ قبل @ ⇒ يُقال، ولا طلب", async () => {
    const { app, dialog } = await editProfessor();
    await app.user.clear(within(dialog).getByDisplayValue(F.prof1.universityEmail.split("@")[0]!));
    await app.user.click(save(dialog));
    expect(await within(dialog).findByText(t("validation.universityEmailInvalid"))).toBeInTheDocument();
    expect(fake.writes).toEqual([]);
  });

  it("إيقاف الحساب بكلمة مرورٍ جديدة ⇒ بعد الحفظ، بالترتيب", async () => {
    const { app, dialog } = await editProfessor();
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.statusSuspended") }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.leaveBlankToKeep")), "Prof#2026x");
    await app.user.click(save(dialog));
    await waitFor(() => expect(fake.find("post", `/admin/users/${F.prof1.userId}/reset-password`)).toHaveLength(1));
    expect(fake.writes.map((c) => `${c.method} ${c.path}`)).toEqual([
      `patch /admin/professors/${F.prof1.id}`,
      `patch /admin/users/${F.prof1.userId}/status`,
      `post /admin/users/${F.prof1.userId}/reset-password`,
    ]);
  });
});

describe("نطاقات البريد الجامعيّ", () => {
  it("نطاقٌ جديد يُضاف من الحقل ويُختار، والقديم يُحذف", async () => {
    const { app, dialog } = await editProfessor();
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.emailShapesAndDomains") }));
    await app.user.click(await within(dialog).findByRole("button", { name: esc(t("admin.addUniversityDomain")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.domainPlaceholder")), "univ-oran.dz{Enter}");
    await waitFor(() => expect(fake.find("post", "/admin/university-domains")[0]?.body).toEqual({ domain: "univ-oran.dz" }));

    if (!within(dialog).queryAllByTitle(t("admin.deleteDomain")).length)
      await app.user.click(within(dialog).getByRole("button", { name: t("admin.emailShapesAndDomains") }));
    const del = await within(dialog).findAllByTitle(t("admin.deleteDomain"));
    await app.user.click(del[0]!);
    await waitFor(() => expect(fake.find("delete", /^\/admin\/university-domains\//)).toHaveLength(1));
  });
});

describe("قائمة الأساتذة", () => {
  it("البحث يصل الخادم، والأستاذ يُفتح من قائمته", async () => {
    const app = renderApp("/ar/admin/professors", { as: "admin" });
    await screen.findAllByText(F.prof1.employeeNumber);
    const search = screen.getAllByRole("textbox").find((i) => (i as HTMLInputElement).placeholder)!;
    await app.user.type(search, "نادية");
    await waitFor(() => expect(fake.find("get", "/admin/professors").some((c) => Object.values(c.query).includes("نادية"))).toBe(true));
  });
});

describe("تعديل الأستاذ: ما يُرفض قبل الإرسال، والبنية، والصورة", () => {
  const box = (dialog: HTMLElement, label: string) =>
    within(dialog).getByRole("combobox", { name: (name) => name === label || name === `${label}*` });

  it.each([
    ["كلمة مرورٍ قصيرة", async (app: ReturnType<typeof renderApp>, d: HTMLElement) => app.user.type(within(d).getByPlaceholderText(t("admin.leaveBlankToKeep")), "abc"), "validation.passwordMinLong"],
    ["اسمٌ لاتينيّ فارغ", async (app: ReturnType<typeof renderApp>, d: HTMLElement) => app.user.clear(within(d).getByDisplayValue("Karim")), "validation.latinNameRequired"],
    ["اسمٌ لاتينيّ بحروفٍ عربية", async (app: ReturnType<typeof renderApp>, d: HTMLElement) => {
      const f = within(d).getByDisplayValue("Karim");
      await app.user.clear(f);
      await app.user.type(f, "كريم");
    }, "validation.latinOnly"],
  ] as const)("%s ⇒ سببه، ولا طلب", async (_, edit, error) => {
    const { app, dialog } = await editProfessor();
    await edit(app, dialog);
    await app.user.click(save(dialog));
    expect(await within(dialog).findByText(t(error))).toBeInTheDocument();
    expect(fake.writes).toEqual([]);
  });

  it("كلّيةٌ أخرى تُفرغ القسم فلا يُحفظ بلا قسم؛ ثمّ القسم والشعبة ⇒ يُحفظان", async () => {
    const { app, dialog } = await editProfessor();
    await app.user.click(box(dialog, t("admin.facultyLabel")));
    await app.user.click((await screen.findAllByRole("option"))[0]!);
    await app.user.click(save(dialog));
    expect(await within(dialog).findAllByText(t("admin.chooseDepartment"))).not.toHaveLength(0);
    expect(fake.writes).toEqual([]);

    await app.user.click(box(dialog, t("admin.facultyLabel")));
    await app.user.click(await screen.findByRole("option", { name: esc(F.faculty.name) }));
    await app.user.click(box(dialog, t("admin.department")));
    await app.user.click(await screen.findByRole("option", { name: esc(F.department.name) }));
    await app.user.click(box(dialog, t("admin.filiere")));
    await app.user.click(await screen.findByRole("option", { name: esc(F.filiere.name) }));
    await app.user.click(save(dialog));
    await waitFor(() => expect(update()).toMatchObject({ departmentId: F.ID.dep1 }));
  });

  it("صورةٌ تُقصّ وتُرفع وتُحفظ؛ ثمّ «إزالة» تفرغها", async () => {
    const { app, dialog } = await editProfessor();
    await app.user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, new File(["png"], "p.png", { type: "image/png" }));
    const cropper = (await screen.findAllByRole("dialog")).at(-1)!;
    const confirm = within(cropper).getAllByRole("button").at(-1)!;
    await waitFor(() => expect(confirm).toBeEnabled());
    await app.user.click(confirm);
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    // «إزالة» الصورة باسمه وحده — وسوم الرتبة لها «إزالة <الوسم>».
    await app.user.click(await within(dialog).findByRole("button", { name: t("admin.removeCover") }));
    await app.user.click(save(dialog));
    await waitFor(() => expect(update()).toMatchObject({ avatarUrl: null }));
  });
});

describe("قائمة الأساتذة: الفلاتر والصفوف", () => {
  const field = (label: string) => screen.getByRole("combobox", { name: label });
  async function pick(app: ReturnType<typeof renderApp>, label: string, option: string) {
    await app.user.click(field(label));
    await app.user.click(await screen.findByRole("option", { name: esc(option) }));
  }
  const removeChip = (label: string) => screen.getByRole("button", { name: `${t("admin.proj.removeFilter")}: ${label}` });

  it("كلّ فلترٍ شريحةٌ تُزال بزرّها، و«مسح الكل» يُزيلها جميعاً", async () => {
    const app = renderApp("/ar/admin/professors", { as: "admin" });
    await screen.findAllByText(F.prof1.employeeNumber);
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByNamePlaceholder")), "كريم");
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByEmployeeNumberPlaceholder")), "EMP");
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByEmailPlaceholder")), "univ");
    await pick(app, t("admin.facultyLabel"), F.faculty.name);
    await pick(app, t("admin.department"), F.department.name);
    await pick(app, t("admin.filiere"), F.filiere.name);

    const labels = [
      `${t("admin.chipName")}: كريم`,
      `${t("admin.employeeNumber")}: EMP`,
      `${t("admin.chipEmail")}: univ`,
      t("admin.chipFaculty", { value: F.faculty.name }),
      t("admin.chipDepartment", { value: F.department.name }),
      t("admin.chipFiliere", { value: F.filiere.name }),
    ];
    for (const l of labels) expect(await screen.findByRole("button", { name: `${t("admin.proj.removeFilter")}: ${l}` })).toBeInTheDocument();

    await app.user.click(removeChip(labels[0]!));
    await waitFor(() => expect(screen.queryByRole("button", { name: `${t("admin.proj.removeFilter")}: ${labels[0]}` })).toBeNull());
    expect(screen.getByPlaceholderText(t("admin.searchByNamePlaceholder"))).toHaveValue("");
    await app.user.click(removeChip(labels[5]!));
    expect(field(t("admin.filiere"))).toHaveAttribute("title", t("admin.allFilieresShort"));

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.clearAll")) }));
    await waitFor(() => expect(screen.queryAllByRole("button", { name: new RegExp(`^${esc(t("admin.proj.removeFilter")).source}`) })).toEqual([]));
    expect(field(t("admin.facultyLabel"))).toHaveAttribute("title", t("admin.allFacultiesShort"));
  });

  it("كلّيةٌ أخرى تُسقط القسم والشعبة اللذين ليسا منها", async () => {
    const other = { ...F.faculty, id: "fac-2", name: "كلية الآداب" };
    fake.on("get", "/admin/faculties", { faculties: [F.faculty, other] });
    const app = renderApp("/ar/admin/professors", { as: "admin" });
    await screen.findAllByText(F.prof1.employeeNumber);
    await pick(app, t("admin.facultyLabel"), F.faculty.name);
    await pick(app, t("admin.department"), F.department.name);
    await pick(app, t("admin.filiere"), F.filiere.name);
    await pick(app, t("admin.facultyLabel"), other.name);
    await waitFor(() => expect(field(t("admin.department"))).toHaveAttribute("title", t("admin.allDepartments")));
    expect(field(t("admin.filiere"))).toHaveAttribute("title", t("admin.allFilieresShort"));
    await app.user.click(field(t("admin.filiere")));
    expect(screen.queryByRole("option", { name: esc(F.filiere.name) })).toBeNull();
  });

  it("الصفّ يفتح الأستاذ، وشعب قسمه اثنتان ثمّ «+» الباقي", async () => {
    const filieres = ["علم الاجتماع", "الأنثروبولوجيا", "الديموغرافيا"].map((name, i) => ({ ...F.filiere, id: `fl${i}`, name }));
    fake.on("get", "/admin/professors", (r) => ({ items: [{ ...F.prof1, department: { ...F.department, filieres } }], total: 1, page: 1, limit: Number(r.query.limit ?? 20) }));
    const app = renderApp("/ar/admin/professors", { as: "admin" });
    const row = (await screen.findAllByText(F.prof1.employeeNumber))[0]!.closest("tr")!;
    expect(row).toHaveTextContent("+1");
    expect(row).not.toHaveTextContent("الديموغرافيا");
    await app.user.click(row);
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/professors/${F.prof1.id}`));
  });

  it("تعذّر التحميل ⇒ «إعادة» تطلب من جديد؛ ولا أساتذة ⇒ يقال", async () => {
    fake.fail("get", "/admin/professors", 500, "خطأ");
    const app = renderApp("/ar/admin/professors", { as: "admin" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    fake.on("get", "/admin/professors", (r) => ({ items: [], total: 0, page: 1, limit: Number(r.query.limit ?? 20) }));
    await app.user.click(retry);
    expect(await screen.findByText(t("admin.noProfessors"))).toBeInTheDocument();
  });
});

describe("صفحة الأستاذ: التوثيق والحذف والحالات", () => {
  const page = async () => {
    const app = renderApp(`/ar/admin/professors/${F.prof1.id}`, { as: "admin" });
    await screen.findAllByText(F.prof1.employeeNumber);
    return app;
  };

  it("سحب التوثيق بتأكيد ⇒ على حسابه لا على صفّ الأستاذ، ثمّ يُجلب من جديد", async () => {
    const app = await page();
    const reads = fake.find("get", `/admin/professors/${F.prof1.id}`).length;
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.unverifyAccount")) }));
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.unverify") }));
    await waitFor(() => expect(fake.find("patch", `/admin/users/${F.prof1.userId}/verification`)[0]?.body).toEqual({ isVerified: false }));
    await waitFor(() => expect(fake.find("get", `/admin/professors/${F.prof1.id}`).length).toBeGreaterThan(reads));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("أستاذٌ بلا مواضيع يُحذف بتأكيد ويعود إلى القائمة", async () => {
    fake.on("get", "/admin/professors/:id", { professor: { ...F.prof1, _count: { topics: 0 }, topics: [] } });
    const app = await page();
    await app.user.click(screen.getByRole("button", { name: t("pro.delete") }));
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getAllByRole("button").at(-1)!);
    await waitFor(() => expect(fake.find("delete", `/admin/professors/${F.prof1.id}`)).toHaveLength(1));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/professors"));
  });

  it("نافذة التعديل تُغلق بزرّها بلا حفظ", async () => {
    const app = await page();
    await app.user.click(screen.getByRole("button", { name: t("pro.edit") }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    expect(fake.writes).toEqual([]);
  });

  it("تعذّر التحميل ⇒ «إعادة»؛ وأستاذٌ لا يوجد ⇒ «العودة إلى الأساتذة»", async () => {
    fake.fail("get", "/admin/professors/:id", 500, "خطأ");
    let app = renderApp(`/ar/admin/professors/${F.prof1.id}`, { as: "admin" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", `/admin/professors/${F.prof1.id}`).length;
    await app.user.click(retry);
    await waitFor(() => expect(fake.find("get", `/admin/professors/${F.prof1.id}`).length).toBeGreaterThan(before));
    app.unmount();

    fake.on("get", "/admin/professors/:id", { professor: null });
    app = renderApp(`/ar/admin/professors/nope`, { as: "admin" });
    expect(await screen.findByText(t("admin.professorNotFound"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.backToProfessors")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/professors"));
  });
});

describe("تعديل الأستاذ: بياناته الشخصية وما حول النافذة", () => {
  it("اللقب اللاتينيّ يُكبَّر عند المغادرة، والعربيّ والجنس والبريد والهاتف تُرسل", async () => {
    const { app, dialog } = await editProfessor();
    const last = within(dialog).getByPlaceholderText("HAMADI");
    await app.user.clear(last);
    await app.user.type(last, "benali");
    await app.user.tab();
    expect(last).toHaveValue("BENALI");
    const arabicLast = within(dialog).getByDisplayValue(F.prof1.user!.lastName!);
    await app.user.clear(arabicLast);
    await app.user.type(arabicLast, "بن علي");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.genderFemale")) }));
    const personal = within(dialog).getByPlaceholderText("example@gmail.com");
    await app.user.clear(personal);
    await app.user.type(personal, "k.prof@gmail.com");
    await app.user.type(within(dialog).getByPlaceholderText("0xxxxxxxxx"), "0550000000");
    await app.user.click(save(dialog));
    await waitFor(() => expect(update()).toMatchObject({
      lastNameLatin: "BENALI",
      lastName: "بن علي",
      gender: "female",
      email: "k.prof@gmail.com",
      phone: "0550000000",
    }));
  });

  it("كلمة المرور تُظهر؛ و«رفع صورة» يفتح الاختيار والقصّ يُلغى؛ والخلفية تُغلق بلا حفظ", async () => {
    const { app, dialog } = await editProfessor();
    const pw = within(dialog).getByPlaceholderText(t("admin.leaveBlankToKeep"));
    await app.user.click(within(dialog).getByRole("button", { name: t("auth.togglePassword") }));
    expect(pw).toHaveAttribute("type", "text");

    const file = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const picked = vi.spyOn(file, "click");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.uploadPhoto")) }));
    expect(picked).toHaveBeenCalled();
    await app.user.upload(file, new File(["png"], "p.png", { type: "image/png" }));
    const cropper = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(cropper).getByRole("button", { name: t("pro.cancel") }));
    await waitFor(() => expect(screen.getAllByRole("dialog").at(-1)).toBe(dialog));
    expect(fake.find("post", "/admin/uploads/image")).toEqual([]);

    await app.user.click(dialog.querySelector(".backdrop-blur-sm") as HTMLElement);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    expect(fake.writes).toEqual([]);
  });
});
