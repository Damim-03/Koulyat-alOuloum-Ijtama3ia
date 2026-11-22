import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

/**
 * نماذج react-hook-form التي تُعاد إلى قيمها عند كلّ فتح (`reset`).
 *
 * `reset` يفرغ سجلّ الحقول ويعتمد على الرسمة التالية لتسجيلها من جديد، و
 * React Compiler قد يُبقي JSX الحقول كما هو فلا تُسجَّل — فلا يصل ما يُكتب
 * ويرفض النموذج كلّ حفظ بـ«مطلوب». هكذا تعطّلت إضافة المراحل. فهنا يُكتب في
 * كلٍّ منها كما يكتب المستخدم، ويُنتظر الطلب نفسه.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

/** أقرب صفٍّ حول النصّ فيه زرٌّ بهذا الاسم. */
function rowButton(text: string, name: string) {
  let node: HTMLElement | null = screen.getAllByText(text)[0]!;
  while (node && !within(node).queryAllByRole("button", { name }).length) node = node.parentElement;
  return within(node!).getAllByRole("button", { name })[0]!;
}

describe("ما يُكتب يصل", () => {
  it("سنةٌ دراسية جديدة", async () => {
    const app = renderApp("/ar/admin/faculties", { as: "admin" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.addYear")) }));
    const dialog = await screen.findByRole("dialog");
    await app.user.type(within(dialog).getByPlaceholderText("2024/2025"), "2026/2027");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveData")) }));
    await waitFor(() => expect(fake.find("post", "/admin/academic-years")).toHaveLength(1));
    expect(fake.find("post", "/admin/academic-years")[0]!.body).toMatchObject({ title: "2026/2027" });
  });

  it("وتُفتح السنة للتعديل بعنوانها، ويُحفظ ما غُيّر", async () => {
    const app = renderApp("/ar/admin/faculties", { as: "admin" });
    await screen.findAllByText(F.pastYear.title);
    await app.user.click(rowButton(F.pastYear.title, t("admin.edit")));
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByDisplayValue(F.pastYear.title);
    await app.user.clear(title);
    await app.user.type(title, "2024/2025 (أ)");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveData")) }));
    await waitFor(() => expect(fake.find("patch", `/admin/academic-years/${F.pastYear.id}`)[0]?.body).toMatchObject({ title: "2024/2025 (أ)" }));
  });

  it("طالبٌ جديد بالمعالج: الاسم اللاتينيّ ورقم التسجيل والتخصّص، ثمّ الإقرار", async () => {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.addStudent")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    const next = () => within(dialog).getByTestId("wizard-next");

    // خطوةٌ بحقلٍ ناقص لا تُتجاوز.
    await app.user.click(next());
    expect(within(dialog).getByTestId("first-name-latin")).toHaveFocus();

    // الخطوة الشخصية: الاسم باللاتينية (يُصحَّح حرفه الأوّل) وكلمة المرور.
    await app.user.type(within(dialog).getByTestId("first-name-latin"), "salim");
    await app.user.type(within(dialog).getByTestId("last-name-latin"), "kaci");
    await app.user.type(within(dialog).getByPlaceholderText("••••••••"), "Kaci#2026x");
    await app.user.click(next());

    // الخطوة الجامعية: رقم التسجيل، والسنة (أوّل قائمة)، والتخصّص (آخرها).
    await app.user.type(await within(dialog).findByPlaceholderText(t("admin.regNumberPlaceholder")), "202039012399");
    await app.user.click(within(dialog).getAllByRole("combobox")[0]!);
    await app.user.click(await screen.findByRole("option", { name: esc(F.year.title) }));
    await app.user.click(within(dialog).getAllByRole("combobox").at(-1)!);
    await app.user.click(await screen.findByRole("option", { name: esc(F.specialization.name) }));
    await app.user.click(next());

    // المراجعة: لا إنشاء بلا إقرار.
    await within(dialog).findByTestId("review-confirm");
    await app.user.click(within(dialog).getByTestId("review-confirm"));
    await app.user.click(within(dialog).getByTestId("wizard-save"));
    await waitFor(() => expect(fake.find("post", "/admin/students")).toHaveLength(1));
    expect(fake.find("post", "/admin/students")[0]!.body).toMatchObject({
      firstNameLatin: "Salim",
      lastNameLatin: "KACI",
      registrationNumber: "202039012399",
      specializationId: F.specialization.id,
      academicYearId: F.year.id,
    });
  });
});

describe("المعالج بأدواره الأخرى", () => {
  async function wizardFrom(path: string, button: string) {
    const app = renderApp(path, { as: "admin" });
    await app.user.click((await screen.findAllByRole("button", { name: esc(t(button)) }))[0]!);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    return { app, dialog, next: () => within(dialog).getByTestId("wizard-next") };
  }

  it("أستاذ: بريدٌ جامعيّ وقسم، ثمّ إقرار ⇒ مسار الأساتذة بلا هاتفٍ ولا صورة", async () => {
    const { app, dialog, next } = await wizardFrom("/ar/admin/professors", "admin.addProfessor");
    await app.user.type(within(dialog).getByTestId("first-name-latin"), "nadia");
    await app.user.type(within(dialog).getByTestId("last-name-latin"), "bouzid");
    await app.user.type(within(dialog).getByPlaceholderText("••••••••"), "Nadia#2026x");
    await app.user.click(next());

    const local = (await within(dialog).findAllByRole("textbox")).find((i) => (i as HTMLInputElement).dir === "ltr" || /@/.test(i.parentElement?.textContent ?? ""))!;
    await app.user.type(local, "n.bouzid");
    await app.user.click(within(dialog).getByRole("combobox", { name: new RegExp(`^${t("admin.department")}`) }));
    await app.user.click(await screen.findByRole("option", { name: esc(F.department.name) }));
    await app.user.click(next());

    await app.user.click(await within(dialog).findByTestId("review-confirm"));
    await app.user.click(within(dialog).getByTestId("wizard-save"));
    await waitFor(() => expect(fake.find("post", "/admin/professors")).toHaveLength(1));
    const body = fake.find("post", "/admin/professors")[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ firstNameLatin: "Nadia", lastNameLatin: "BOUZID", departmentId: F.ID.dep1 });
    expect(body.universityEmail).toMatch(/^n\.bouzid@/);
    expect(body).not.toHaveProperty("phone");
    expect(body).not.toHaveProperty("role");
  });

  it("مسؤول: الدور أوّلاً، ثمّ الاسم بالعربية، ثمّ البريد ⇒ مسار المستخدمين", async () => {
    const { app, dialog, next } = await wizardFrom("/ar/admin/users", "admin.addUser");
    await app.user.click(within(dialog).getByTestId("role-card-admin"));
    await app.user.click(next());
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.firstNamePlaceholder")), "ليلى");
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.lastNamePlaceholder")), "بن صالح");
    await app.user.type(within(dialog).getByPlaceholderText("••••••••"), "Leila#2026x");
    await app.user.click(next());
    await app.user.type(await within(dialog).findByPlaceholderText("example@univ-eloued.dz"), "l.bensalah@univ-msila.dz");
    await app.user.click(next());
    await app.user.click(await within(dialog).findByTestId("review-confirm"));
    await app.user.click(within(dialog).getByTestId("wizard-save"));
    await waitFor(() => expect(fake.find("post", "/admin/users")).toHaveLength(1));
    expect(fake.find("post", "/admin/users")[0]!.body).toMatchObject({ role: "admin", firstName: "ليلى", email: "l.bensalah@univ-msila.dz" });
  });

  it("الحفظ بلا إقرار ⇒ يُطلب الإقرار ولا يُرسل", async () => {
    const { app, dialog, next } = await wizardFrom("/ar/admin/users", "admin.addUser");
    await app.user.click(within(dialog).getByTestId("role-card-admin"));
    await app.user.click(next());
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.firstNamePlaceholder")), "سمير");
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.lastNamePlaceholder")), "قاسم");
    await app.user.type(within(dialog).getByPlaceholderText("••••••••"), "Samir#2026x");
    await app.user.click(next());
    await app.user.type(await within(dialog).findByPlaceholderText("example@univ-eloued.dz"), "s.q@univ-msila.dz");
    await app.user.click(next());
    await app.user.click(await within(dialog).findByTestId("wizard-save"));
    expect(fake.find("post", "/admin/users")).toEqual([]);
    expect(await within(dialog).findByText(t("admin.confirmRequired"))).toBeInTheDocument();
    // ثمّ الإقرار يرفع التنبيه، والحفظ يقع.
    await app.user.click(within(dialog).getByTestId("review-confirm"));
    await app.user.click(within(dialog).getByTestId("wizard-save"));
    await waitFor(() => expect(fake.find("post", "/admin/users")).toHaveLength(1));
  });
});

describe("المعالج: الصورة والبنية والوسوم وما حولها", () => {
  async function wizardFrom(path: string, button: string) {
    const app = renderApp(path, { as: "admin" });
    await app.user.click((await screen.findAllByRole("button", { name: esc(t(button)) }))[0]!);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    return { app, dialog, next: () => within(dialog).getByTestId("wizard-next") };
  }
  async function pick(app: ReturnType<typeof renderApp>, dialog: HTMLElement, field: string, option: string) {
    await app.user.click(within(dialog).getByRole("combobox", { name: new RegExp(`^${esc(field).source}`) }));
    await app.user.click(await screen.findByRole("option", { name: esc(option) }));
  }
  const png = () => new File(["png"], "me.png", { type: "image/png" });

  it("طالب: الصورة (تُقصّ، وتُزال، ويُلغى قصّها) والهاتف والجنس تصل مع الإنشاء؛ والبنية تتسلسل", async () => {
    const { app, dialog, next } = await wizardFrom("/ar/admin/students", "admin.addStudent");
    const file = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    async function cropAndUpload() {
      await app.user.upload(file, png());
      const cropper = (await screen.findAllByRole("dialog")).at(-1)!;
      const confirm = within(cropper).getAllByRole("button").at(-1)!;
      await waitFor(() => expect(confirm).toBeEnabled());
      await app.user.click(confirm);
    }

    await cropAndUpload();
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    await app.user.click(await within(dialog).findByRole("button", { name: esc(t("admin.removeCover")) }));
    expect(within(dialog).queryByRole("button", { name: esc(t("admin.removeCover")) })).toBeNull();

    // قصٌّ يُلغى لا يرفع شيئاً.
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.uploadPhoto")) }));
    await app.user.upload(file, png());
    const cropper = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(cropper).getByRole("button", { name: t("pro.cancel") }));
    await waitFor(() => expect(screen.getAllByRole("dialog").at(-1)).toBe(dialog));
    expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1);

    await cropAndUpload();
    await within(dialog).findByRole("button", { name: esc(t("admin.removeCover")) });

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.genderFemale")) }));
    await app.user.type(within(dialog).getByPlaceholderText("0xxxxxxxxx"), "0661234567");
    const password = within(dialog).getByPlaceholderText("••••••••");
    await app.user.type(password, "Amina#2026x");
    expect(password).toHaveAttribute("type", "password");
    await app.user.click(within(dialog).getByRole("button", { name: t("auth.togglePassword") }));
    expect(password).toHaveAttribute("type", "text");
    await app.user.type(within(dialog).getByTestId("first-name-latin"), "amina");
    await app.user.type(within(dialog).getByTestId("last-name-latin"), "haddad");
    await app.user.click(next());

    // البنية تتسلسل: الكلّية تُفرغ ما تحتها، والقسم ما تحته، والشعبة التخصّص.
    await app.user.type(await within(dialog).findByPlaceholderText(t("admin.regNumberPlaceholder")), "202039012377");
    await pick(app, dialog, t("admin.facultyLabel"), F.faculty.name);
    await pick(app, dialog, t("admin.department"), F.department.name);
    await pick(app, dialog, t("admin.filiere"), F.filiere.name);
    await pick(app, dialog, t("admin.specialization"), F.specialization.name);
    await pick(app, dialog, t("admin.filiere"), F.filiere.name);
    const spec = () => within(dialog).getByRole("combobox", { name: new RegExp(`^${esc(t("admin.specialization")).source}`) });
    expect(spec()).not.toHaveTextContent(F.specialization.name);
    await pick(app, dialog, t("admin.department"), F.department.name);
    await pick(app, dialog, t("admin.facultyLabel"), F.faculty.name);
    await pick(app, dialog, t("admin.specialization"), F.specialization.name);
    await app.user.click(within(dialog).getAllByRole("combobox")[0]!);
    await app.user.click(await screen.findByRole("option", { name: esc(F.year.title) }));
    await app.user.click(next());

    await app.user.click(await within(dialog).findByTestId("review-confirm"));
    await app.user.click(within(dialog).getByTestId("wizard-save"));
    await waitFor(() => expect(fake.find("post", "/admin/students")).toHaveLength(1));
    expect(fake.find("post", "/admin/students")[0]!.body).toMatchObject({
      avatarUrl: "/uploads/cards/new.jpg",
      phone: "0661234567",
      gender: "female",
      specializationId: F.specialization.id,
    });
  });

  it("أستاذ: الكلّية تُفرغ القسم والشعبة، والرتبة والوسم يُرسلان", async () => {
    const { app, dialog, next } = await wizardFrom("/ar/admin/professors", "admin.addProfessor");
    await app.user.type(within(dialog).getByTestId("first-name-latin"), "nadia");
    await app.user.type(within(dialog).getByTestId("last-name-latin"), "bouzid");
    await app.user.type(within(dialog).getByPlaceholderText("••••••••"), "Nadia#2026x");
    await app.user.click(next());
    const local = (await within(dialog).findAllByRole("textbox")).find((i) => (i as HTMLInputElement).dir === "ltr" || /@/.test(i.parentElement?.textContent ?? ""))!;
    await app.user.type(local, "n.bouzid");

    await pick(app, dialog, t("admin.department"), F.department.name);
    await pick(app, dialog, t("admin.filiere"), F.filiere.name);
    await pick(app, dialog, t("admin.facultyLabel"), F.faculty.name);
    await pick(app, dialog, t("admin.department"), F.department.name);
    await app.user.type(within(dialog).getByRole("textbox", { name: t("admin.gradeLabel") }), "أستاذ محاضر أ{Enter}");
    await app.user.type(within(dialog).getByRole("textbox", { name: t("admin.tagLabel") }), "رئيس قسم{Enter}");
    await app.user.click(next());

    await app.user.click(await within(dialog).findByTestId("review-confirm"));
    await app.user.click(within(dialog).getByTestId("wizard-save"));
    await waitFor(() => expect(fake.find("post", "/admin/professors")).toHaveLength(1));
    expect(fake.find("post", "/admin/professors")[0]!.body).toMatchObject({
      departmentId: F.ID.dep1,
      grade: ["أستاذ محاضر أ"],
      tags: ["رئيس قسم"],
    });
  });

  it("الإغلاق من زرّه ومن الخلفية", async () => {
    const opened = await wizardFrom("/ar/admin/users", "admin.addUser");
    const app = opened.app;
    let dialog = opened.dialog;
    // زرّ الرأس (X) وزرّ التذييل كلاهما «إلغاء»: الأوّل هو الرأس.
    await app.user.click(within(dialog).getAllByRole("button", { name: t("admin.cancel") })[0]!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.addUser")) })[0]!);
    dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(dialog.querySelector(".backdrop-blur-sm") as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
