import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * الطالب في الإدارة: تعديل بياناته وصورته وحالته وكلمة مروره، وتوثيقه،
 * وحذفه — وقوائم الطلبة في ملفّ Excel.
 *
 * يُحرس: أنّ ما يُرسل هو ما تغيّر (والحقل الذي فُرّغ يُرسل `null` لا يُترك)؛
 * وأنّ تغيير الحالة وكلمة المرور يأتيان بعد الحفظ، بالترتيب؛ وأنّ الصورة تمرّ
 * بالقصّ قبل الرفع؛ وأنّ رسالة الخادم تصل ولو جاء الخطأ ملفّاً.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

let downloads: string[] = [];
beforeEach(() => {
  fake.reset();
  localStorage.clear();
  downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => vi.restoreAllMocks());

async function editStudent() {
  const app = renderApp("/ar/admin/students/st1", { as: "admin" });
  await screen.findAllByText(F.student1.registrationNumber);
  await app.user.click(screen.getByRole("button", { name: esc(t("pro.edit")) }));
  const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
  await within(dialog).findByDisplayValue(F.student1.registrationNumber);
  return { app, dialog };
}
const saveBtn = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: esc(t("admin.saveChangesShort")) });

describe("تعديل الطالب", () => {
  it("الهاتف وحده يتغيّر ⇒ يُرسل مع مساره الأكاديميّ، ولا يُرسل ما لم يتغيّر", async () => {
    const { app, dialog } = await editStudent();
    await app.user.type(within(dialog).getByPlaceholderText("0xxxxxxxxx"), "0661112233");
    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("patch", "/admin/students/st1")).toHaveLength(1));
    const body = fake.find("patch", "/admin/students/st1")[0]!.body as Record<string, unknown>;
    expect(body).toEqual({
      phone: "0661112233",
      registrationNumber: F.student1.registrationNumber,
      specializationId: F.specialization.id,
      academicYearId: F.year.id,
    });
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });

  it("بريدٌ فُرّغ ⇒ يُرسل null، لا يُترك فيعود في المرّة القادمة", async () => {
    const { app, dialog } = await editStudent();
    await app.user.clear(within(dialog).getByDisplayValue(F.studentUsers[0]!.email!));
    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("patch", "/admin/students/st1")[0]?.body).toMatchObject({ email: null }));
  });

  it("إيقاف الحساب وكلمة مرورٍ جديدة ⇒ بعد الحفظ، وبالترتيب", async () => {
    const { app, dialog } = await editStudent();
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.statusSuspended") }));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.leaveBlankToKeep")), "Nouveau#26");
    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("post", `/admin/users/${F.student1.userId}/reset-password`)).toHaveLength(1));
    expect(fake.writes.map((c) => `${c.method} ${c.path}`)).toEqual([
      "patch /admin/students/st1",
      `patch /admin/users/${F.student1.userId}/status`,
      `post /admin/users/${F.student1.userId}/reset-password`,
    ]);
    expect(fake.find("patch", `/admin/users/${F.student1.userId}/status`)[0]!.body).toEqual({ status: "suspended" });
    expect(fake.find("post", `/admin/users/${F.student1.userId}/reset-password`)[0]!.body).toEqual({ password: "Nouveau#26" });
  });

  it.each([
    ["بريدٌ لا يصلح", "example@univ-eloued.dz", "not-an-email", "validation.emailInvalidAlt"],
    ["كلمة مرورٍ قصيرة", "leaveBlankToKeep", "abc", "validation.passwordMinLong"],
  ])("%s ⇒ يُقال، ولا طلب", async (_, placeholder, value, error) => {
    const { app, dialog } = await editStudent();
    const field = within(dialog).getByPlaceholderText(placeholder.includes("@") ? placeholder : t(`admin.${placeholder}`));
    await app.user.clear(field);
    await app.user.type(field, value);
    await app.user.click(saveBtn(dialog));
    expect(await within(dialog).findByText(t(error))).toBeInTheDocument();
    expect(fake.writes).toEqual([]);
  });

  it("الصورة تُقصّ ثمّ تُرفع، وتُحفظ مع الطالب", async () => {
    const { app, dialog } = await editStudent();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await app.user.upload(input, new File(["png"], "face.png", { type: "image/png" }));
    const cropper = (await screen.findAllByRole("dialog")).at(-1)!;
    const confirm = within(cropper).getAllByRole("button").at(-1)!;
    await waitFor(() => expect(confirm).toBeEnabled());
    await app.user.click(confirm);
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    expect((fake.find("post", "/admin/uploads/image")[0]!.body as { image: File }).image.type).toMatch(/^image\//);

    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("patch", "/admin/students/st1")[0]?.body).toMatchObject({ avatarUrl: "/uploads/cards/new.jpg" }));
  });
});

describe("التوثيق والحذف", () => {
  it("إلغاء التوثيق بعد التأكيد", async () => {
    const app = renderApp("/ar/admin/students/st1", { as: "admin" });
    await screen.findAllByText(F.student1.registrationNumber);
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.unverifyAccount")) }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.unverify") }));
    await waitFor(() => expect(fake.find("patch", `/admin/users/${F.student1.userId}/verification`)[0]?.body).toEqual({ isVerified: false }));
  });

  it("الحذف نهائيٌّ بعد التأكيد، ثمّ يُعاد إلى القائمة", async () => {
    const app = renderApp("/ar/admin/students/st1", { as: "admin" });
    await screen.findAllByText(F.student1.registrationNumber);
    await app.user.click(screen.getByRole("button", { name: t("pro.delete") }));
    const alert = await screen.findByRole("alertdialog");
    expect(fake.find("delete", "/admin/students/st1")).toEqual([]);
    await app.user.click(within(alert).getByRole("button", { name: t("messages.yesDelete") }));
    await waitFor(() => expect(fake.find("delete", "/admin/students/st1")).toHaveLength(1));
    await waitFor(() => expect(app.location()).toMatch(/^\/ar\/admin\/students(\?|$)/));
  });
});

describe("قوائم الطلبة في Excel", () => {
  it("تُنزَّل بفلاترها وطريقة ترتيبها، باسمٍ مؤرّخ", async () => {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-student-export"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByTestId("export-count")).toHaveTextContent(/\d/);
    const radios = within(dialog).getAllByRole("radio");
    await app.user.click(radios.at(-1)!);
    await app.user.click(within(dialog).getByTestId("export-download"));

    await waitFor(() => expect(fake.find("get", "/admin/students/export")).toHaveLength(1));
    expect(fake.find("get", "/admin/students/export")[0]!.query).toHaveProperty("layout");
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toContain(new Date().toISOString().slice(0, 10));
  });

  it("رفض الخادم يأتي ملفّاً ⇒ تُقرأ رسالته منه", async () => {
    fake.fail("get", "/admin/students/export", 400, "لا طلبة بهذه الفلاتر");
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-student-export"));
    await app.user.click(within(await screen.findByRole("dialog")).getByTestId("export-download"));
    expect(await screen.findByText("لا طلبة بهذه الفلاتر")).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });
});

describe("فلاتر قوائم Excel", () => {
  it("التخصّص يملأ ما فوقه، والكلّية تُفرغ ما تحتها، و«مسح الكلّ» يعيد الكلّ", async () => {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-student-export"));
    const dialog = await screen.findByRole("dialog");
    const pick = async (label: string, option: string) => {
      await app.user.click(within(dialog).getByRole("combobox", { name: label }));
      await app.user.click(await screen.findByRole("option", { name: esc(option) }));
    };
    await pick(t("admin.specialization"), F.specialization.name);
    // من التخصّص: الشعبة والقسم والكلّية والطور.
    expect(within(dialog).getByRole("combobox", { name: t("admin.filiere") })).toHaveTextContent(F.filiere.name);
    expect(within(dialog).getByRole("combobox", { name: t("admin.department") })).toHaveTextContent(F.department.name);
    expect(within(dialog).getByRole("combobox", { name: t("admin.facultyLabel") })).toHaveTextContent(F.faculty.name);

    await pick(t("admin.specializationLevel"), t("admin.levelLicence"));
    expect(within(dialog).getByRole("combobox", { name: t("admin.specialization") })).not.toHaveTextContent(F.specialization.name);

    await pick(t("admin.filiere"), F.filiere.name);
    await pick(t("admin.department"), F.department.name);
    await pick(t("admin.facultyLabel"), F.faculty.name);
    await pick(t("admin.export.year"), F.year.title);
    await app.user.click(within(dialog).getByTestId("export-download"));
    await waitFor(() => expect(fake.find("get", "/admin/students/export")[0]?.query).toMatchObject({ facultyId: F.ID.fac1, academicYearId: F.ID.y1 }));
  });
});

describe("المسار الأكاديميّ في تعديل الطالب", () => {
  // اسم القائمة عنوان حقلها، وبعده علامة الإلزام إن كان مطلوباً.
  const box = (dialog: HTMLElement, label: string) =>
    within(dialog).getByRole("combobox", { name: (name) => name === label || name === `${label}*` });

  it("تغيير الكلّية يُفرغ ما تحتها فلا يُحفظ بلا تخصّص؛ ثمّ القسم والشعبة والتخصّص ⇒ يُحفظ الجديد", async () => {
    const { app, dialog } = await editStudent();
    const pick = async (label: string, option: string) => {
      await app.user.click(box(dialog, label));
      await app.user.click(await screen.findByRole("option", { name: esc(option) }));
    };
    await pick(t("admin.facultyLabel"), t("admin.allFacultiesShort"));
    await app.user.click(saveBtn(dialog));
    // النصّ نفسه عنوان القائمة الفارغة وسببُ الرفض: يظهر مرّتين، ولا طلب.
    await waitFor(() => expect(within(dialog).getAllByText(t("admin.chooseSpecialization")).length).toBeGreaterThan(1));
    expect(fake.writes).toEqual([]);

    await pick(t("admin.facultyLabel"), F.faculty.name);
    await pick(t("admin.department"), F.department.name);
    await pick(t("admin.filiere"), F.filiere.name);
    // الطور يحصر التخصّصات: الليسانس أوّلاً.
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.levelLicence")) }));
    await pick(t("admin.specializationLabelAlt"), F.specialization2.name);
    await pick(t("pro.academicYear"), F.pastYear.title);
    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("patch", "/admin/students/st1")[0]?.body).toMatchObject({ specializationId: F.ID.spec2, academicYearId: F.ID.y0 }));
  });
});

describe("حقولٌ بأزرار", () => {
  /**
   * داخل <label> تنتقل النقرة على نصّه إلى أوّل أزراره: «نشط» في حالة الحساب،
   * و«ليسانس» في الطور. فكان النقر على كلمة «حالة الحساب» يعيد حساباً موقوفاً
   * نشطاً، ويُحفظ ذلك مع أيّ تعديل.
   */
  it("النقر على اسم «حالة الحساب» و«الطور» لا يغيّر شيئاً", async () => {
    // حسابٌ موقوف — والمطلوب أن يبقى موقوفاً.
    fake.on("get", "/admin/students/:id", { student: { ...F.student1, user: { ...F.student1.user!, status: "suspended" } } });
    const app = renderApp(`/ar/admin/students/${F.student1.id}`, { as: "admin" });
    await screen.findAllByText(F.student1.registrationNumber);
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.edit")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await within(dialog).findByDisplayValue(F.student1.registrationNumber);
    const levels = within(dialog).getByTestId("level-picker");
    const before = within(levels).getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));

    await app.user.click(within(dialog).getByText(t("admin.accountStatus")));
    await app.user.click(within(dialog).getByText(t("admin.specializationLevel")));
    expect(within(levels).getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(before);

    await app.user.type(within(dialog).getByPlaceholderText("0xxxxxxxxx"), "0550001122");
    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("patch", `/admin/students/${F.student1.id}`)).toHaveLength(1));
    expect(fake.find("patch", /\/status$/)).toEqual([]);
  });
});

describe("تعديل الطالب: الأسماء والتحقّق وما حول النافذة", () => {
  const latin = (dialog: HTMLElement, which: "Youcef" | "last") =>
    which === "Youcef" ? within(dialog).getByPlaceholderText("Youcef") : (within(dialog).getAllByRole("textbox").find((i) => (i as HTMLInputElement).value === F.student1.user!.lastNameLatin) as HTMLInputElement);

  it("ما تغيّر من الأسماء والجنس ورقم التسجيل يُرسل؛ واللقب اللاتينيّ يُكبَّر عند مغادرة الحقل", async () => {
    const { app, dialog } = await editStudent();
    const first = latin(dialog, "Youcef");
    await app.user.clear(first);
    await app.user.type(first, "yacine");
    const last = latin(dialog, "last");
    await app.user.clear(last);
    await app.user.type(last, "kaci");
    await app.user.tab();
    expect(last).toHaveValue("KACI");

    const arabic = within(dialog).getAllByRole("textbox").filter((i) => (i as HTMLInputElement).value === F.student1.user!.firstName || (i as HTMLInputElement).value === F.student1.user!.lastName);
    await app.user.clear(arabic[0]!);
    await app.user.type(arabic[0]!, "ياسين");
    await app.user.clear(arabic[1]!);
    await app.user.type(arabic[1]!, "قاسي");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.genderFemale")) }));
    const reg = within(dialog).getByDisplayValue(F.student1.registrationNumber);
    await app.user.clear(reg);
    await app.user.type(reg, "202039019999");

    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("patch", "/admin/students/st1")[0]?.body).toMatchObject({
      firstNameLatin: "Yacine",
      lastNameLatin: "KACI",
      firstName: "ياسين",
      lastName: "قاسي",
      gender: "female",
      registrationNumber: "202039019999",
    }));
  });

  it("اسمٌ لاتينيّ فارغ، أو بحروفٍ عربية، أو بلا سنة ⇒ يُقال، ولا طلب", async () => {
    const { app, dialog } = await editStudent();
    const first = latin(dialog, "Youcef");
    await app.user.clear(first);
    await app.user.click(saveBtn(dialog));
    expect(await within(dialog).findByText(t("validation.latinNameRequired"))).toBeInTheDocument();

    await app.user.type(first, "يوسف");
    await app.user.click(saveBtn(dialog));
    expect(await within(dialog).findByText(t("validation.latinOnly"))).toBeInTheDocument();
    await app.user.clear(first);
    await app.user.type(first, "Youcef");

    await app.user.click(within(dialog).getByRole("combobox", { name: (n) => n === t("pro.academicYear") || n === `${t("pro.academicYear")}*` }));
    await app.user.click((await screen.findAllByRole("option"))[0]!);
    await app.user.click(saveBtn(dialog));
    expect(await within(dialog).findAllByText(t("admin.chooseAcademicYear"))).not.toHaveLength(0);
    expect(fake.writes).toEqual([]);
  });

  it("كلمة المرور تُظهر وتُخفى؛ والصورة: «رفع» يفتح الاختيار، والقصّ يُلغى، و«إزالة» تُفرغها", async () => {
    fake.on("get", "/admin/students/:id", { student: { ...F.student1, user: { ...F.student1.user!, avatarUrl: "/uploads/avatars/a.jpg" } } });
    const { app, dialog } = await editStudent();
    const pw = within(dialog).getByPlaceholderText(t("admin.leaveBlankToKeep"));
    const toggle = within(dialog).getByRole("button", { name: t("auth.togglePassword") });
    expect(pw).toHaveAttribute("type", "password");
    await app.user.click(toggle);
    expect(pw).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    const file = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const picked = vi.spyOn(file, "click");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.uploadPhoto")) }));
    expect(picked).toHaveBeenCalled();
    await app.user.upload(file, new File(["png"], "p.png", { type: "image/png" }));
    const cropper = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(cropper).getByRole("button", { name: t("pro.cancel") }));
    await waitFor(() => expect(screen.getAllByRole("dialog").at(-1)).toBe(dialog));
    expect(fake.find("post", "/admin/uploads/image")).toEqual([]);

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.removeCover")) }));
    await app.user.click(saveBtn(dialog));
    await waitFor(() => expect(fake.find("patch", "/admin/students/st1")[0]?.body).toMatchObject({ avatarUrl: null }));
  });

  it("تُغلق من رأسها ومن خلفيّتها بلا حفظ", async () => {
    const opened = await editStudent();
    const app = opened.app;
    let dialog = opened.dialog;
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.edit")) }));
    dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(dialog.querySelector(".backdrop-blur-sm") as HTMLElement);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    expect(fake.writes).toEqual([]);
  });
});

describe("صفحة الطالب: سجلّ نشاطه", () => {
  const withStudent = (patch: Record<string, unknown>) =>
    fake.on("get", "/admin/students/:id", { student: { ...F.student1, ...patch } });
  const activity = {
    projectMembers: [
      {
        id: "pm1",
        isLeader: true,
        group: {
          id: F.ID.g1,
          topic: { id: F.topicFull.id, title: "مذكرةٌ قائمة", status: "full", professor: F.prof1 },
          defense: { id: "df1", date: F.defense.date, room: "قاعة 12" },
        },
      },
      { id: "pm2", isLeader: false, group: { id: "g-x", topic: { id: "t-x", title: "مذكرةٌ بلا مناقشة", status: "full" }, defense: null } },
    ],
    ledGroupRequests: [
      { id: "gr-led", status: "pending", createdAt: F.defense.date, topic: { id: F.topicOpen.id, title: "طلبٌ أرسلتُه" }, members: [{ id: "m1" }, { id: "m2" }] },
    ],
    groupRequestMembers: [
      { id: "grm-x", request: { id: "gr-y", status: "rejected", topic: { id: F.topicApproved.id, title: "طلبٌ أنا عضوٌ فيه" }, leader: { user: F.student2.user } } },
    ],
  };
  const open = async () => {
    const app = renderApp(`/ar/admin/students/${F.student1.id}`, { as: "admin" });
    await screen.findAllByText(F.student1.registrationNumber);
    return app;
  };

  it("المذكرة بمرسِلها ومناقشتها، والطلبات مرسَلةً ومشارَكاً فيها — كلٌّ يقود إلى موضوعه", async () => {
    withStudent(activity);
    let app = await open();
    expect(screen.getByText(t("admin.finalProject"))).toBeInTheDocument();
    expect(screen.getByText(/قاعة 12/)).toBeInTheDocument();
    expect(screen.getByText(t("admin.noDefenseYet"))).toBeInTheDocument();
    expect(screen.getByText(t("admin.membersCountN", { count: 2 }))).toBeInTheDocument();
    expect(screen.getByText(t("admin.leaderName", { name: `${F.student2.user!.firstName} ${F.student2.user!.lastName}` }))).toBeInTheDocument();

    const go = async (title: string, topicId: string) => {
      await app.user.click(screen.getByText(title).closest("button")!);
      await waitFor(() => expect(app.location()).toBe(`/ar/admin/topics/${topicId}`));
      app.unmount();
      app = await open();
    };
    await go("مذكرةٌ قائمة", F.topicFull.id);
    await go("طلبٌ أرسلتُه", F.topicOpen.id);
    await go("طلبٌ أنا عضوٌ فيه", F.topicApproved.id);
  });

  it("بلا نشاط ⇒ «لا نشاط بعد»", async () => {
    withStudent({ projectMembers: [], ledGroupRequests: [], groupRequestMembers: [] });
    await open();
    expect(screen.getByText(t("admin.noActivityYet"))).toBeInTheDocument();
  });

  it("طالبٌ لا يوجد ⇒ يقال، و«العودة إلى الطلبة»", async () => {
    fake.on("get", "/admin/students/:id", { student: null });
    const app = renderApp("/ar/admin/students/nope", { as: "admin" });
    expect(await screen.findByText(t("admin.studentNotFound"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.backToStudents")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/students"));
  });
});
