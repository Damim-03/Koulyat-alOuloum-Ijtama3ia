import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import { useAuthStore } from "../../store/auth.store";

/**
 * حسابي — لكلّ دور ما يجوز له، كما يقوله الخادم في `account.can`.
 *
 * يُحرس هنا: أنّ ما يُرسل هو ما تغيّر وحده؛ وأنّ الخطأ يُرى قبل الإرسال لا
 * بعده؛ وأنّ ما يحسم الأمان (كلمة المرور، الخروج من كلّ الأجهزة، التحقّق
 * بخطوتين) يُسأل عنه أوّلاً؛ وأنّ الحساب الذي يجب أن يغيّر كلمة مروره لا
 * يرى شيئاً قبل ذلك.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const field = (label: string) => screen.getByLabelText(esc(label)) as HTMLInputElement;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("البيانات الشخصية", () => {
  it("الهاتف بصيغةٍ خاطئة ⇒ يُقال قبل الحفظ؛ وبصيغةٍ صحيحة ⇒ يُرسل الهاتف وحده", async () => {
    const app = renderApp("/ar/admin/account", { as: "admin" });
    const phone = await screen.findByTestId("acc-phone");
    await app.user.clear(phone);
    await app.user.type(phone, "abc");
    expect(await screen.findByText(t("admin.account.err.phone"))).toBeInTheDocument();
    expect(screen.getByTestId("acc-save")).toBeDisabled();

    await app.user.clear(phone);
    await app.user.type(phone, "0661234567");
    await app.user.click(screen.getByTestId("acc-save"));
    await waitFor(() => expect(fake.find("patch", "/account")).toHaveLength(1));
    expect(fake.find("patch", "/account")[0]!.body).toEqual({ phone: "0661234567" });
    expect(await screen.findByText(t("admin.account.saved"))).toBeInTheDocument();
  });

  it("الاسم يتغيّر ⇒ يُحفظ، ويظهر في رأس الصفحة بلا إعادة تحميل", async () => {
    const app = renderApp("/ar/admin/account", { as: "admin" });
    const first = await screen.findByTestId("acc-firstName");
    await app.user.clear(first);
    await app.user.type(first, "سليم");
    await app.user.click(screen.getByTestId("acc-save"));
    await waitFor(() => expect(fake.find("patch", "/account")[0]?.body).toEqual({ firstName: "سليم" }));
    await waitFor(() => expect(useAuthStore.getState().user?.firstName).toBe("سليم"));
  });

  it("الأستاذ: الاسم باللاتينية إلزاميّ، ويُكتب بحرفٍ كبيرٍ أوّله", async () => {
    const app = renderApp("/ar/professor/account", { as: "professor" });
    const latin = await waitFor(() => field(t("admin.account.f.firstNameLatin")));
    await app.user.clear(latin);
    expect(await screen.findByText(t("admin.account.err.required"))).toBeInTheDocument();
    await app.user.type(latin, "salim");
    await app.user.tab();
    expect(latin).toHaveValue("Salim");
    await app.user.click(screen.getByTestId("acc-save"));
    await waitFor(() => expect(fake.find("patch", "/account")[0]?.body).toEqual({ firstNameLatin: "Salim" }));
  });

  it("الطالب: اسمه ولقبه بالعربية وبريده وحدها تُعدَّل — والباقي يُقرأ؛ ولا جناح صورةٍ ولا بريد", async () => {
    renderApp("/ar/student/account", { as: "student" });
    await screen.findByTestId("wing-personal");
    expect(screen.queryByTestId("wing-photo")).toBeNull();
    // The email is set beside the name: the «email» wing speaks of signing in by it, which a student does not.
    expect(screen.queryByTestId("wing-email")).toBeNull();
    expect(screen.queryByTestId("acc-firstName")).toBeNull();
    expect(screen.queryByTestId("acc-save")).toBeNull();
    expect(screen.getAllByText(F.student1.registrationNumber).length).toBeGreaterThan(0);
    expect(await screen.findByTestId("student-name-edit")).toBeInTheDocument();
    expect(screen.getByTestId("student-email-edit")).toBeInTheDocument();
    // Two things, no more: one pencil each.
    expect(screen.getAllByTestId(/^student-(name|email)-edit$/)).toHaveLength(2);
    expect(screen.getByText(t("admin.account.managed_student"))).toBeInTheDocument();
  });

  it("الطالب يصحّح اسمه بالعربية: لا لاتينية فيه، ويُرسل ما تغيّر وحده", async () => {
    const app = renderApp("/ar/student/account", { as: "student" });
    await app.user.click(await screen.findByTestId("student-name-edit"));
    const form = screen.getByTestId("student-name-form");
    const first = within(form).getByRole("textbox", { name: t("admin.account.f.firstName") });
    const save = within(form).getByTestId("student-name-save");
    // Nothing changed yet: nothing to save.
    expect(save).toBeDisabled();
    await app.user.clear(first);
    await app.user.type(first, "Imad");
    expect(within(form).getByText(t("account.student.err.arabic"))).toBeInTheDocument();
    expect(save).toBeDisabled();
    await app.user.clear(first);
    await app.user.type(first, "عماد   الدين");
    expect(save).toBeEnabled();
    await app.user.click(save);
    await waitFor(() => expect(fake.find("patch", "/account")).toHaveLength(1));
    expect(fake.find("patch", "/account")[0]!.body).toEqual({ firstName: "عماد الدين" });
  });

  it("اسمٌ تركته الإدارة فارغاً ⇒ «أضف اسمك»، فيُملأ الاسم واللقب معاً", async () => {
    fake.on("get", "/account", () => ({ account: { ...F.myAccount(F.authUsers.student), firstName: null, lastName: null } }));
    const app = renderApp("/ar/student/account", { as: "student" });
    const row = await screen.findByTestId("student-name");
    expect(row).toHaveTextContent(t("account.student.nameEmpty"));
    await app.user.click(within(row).getByRole("button", { name: esc(t("account.student.addName")) }));
    const form = screen.getByTestId("student-name-form");
    await app.user.type(within(form).getByRole("textbox", { name: t("admin.account.f.firstName") }), "عماد الدين");
    // Only one of the two: not yet.
    expect(within(form).getByTestId("student-name-save")).toBeDisabled();
    await app.user.type(within(form).getByRole("textbox", { name: t("admin.account.f.lastName") }), "كير");
    await app.user.click(within(form).getByTestId("student-name-save"));
    await waitFor(() => expect(fake.find("patch", "/account")).toHaveLength(1));
    expect(fake.find("patch", "/account")[0]!.body).toEqual({ firstName: "عماد الدين", lastName: "كير" });
  });

  it("الطالب يُدخل بريده بكلمة مروره — بخطواتٍ ثلاث — فيُحفظ ويُرسل إليه رابط التأكيد", async () => {
    const app = renderApp("/ar/student/account", { as: "student" });
    await app.user.click(await screen.findByTestId("student-email-edit"));
    const form = screen.getByTestId("student-email-form");
    expect(form).toHaveTextContent(t("account.student.emailHint"));
    const save = within(form).getByTestId("student-email-save");
    expect(save).toHaveTextContent(t("account.student.saveEmail"));
    const steps = () => within(within(form).getByTestId("student-email-steps")).getAllByRole("listitem").map((li) => li.getAttribute("data-state"));
    expect(steps()).toEqual(["current", "todo", "todo"]);
    await app.user.type(within(form).getByRole("textbox", { name: t("admin.account.email.new") }), "imad@example.com");
    expect(steps()).toEqual(["done", "current", "todo"]);
    // Without the password: not yet.
    expect(save).toBeDisabled();
    await app.user.type(within(form).getByTestId("student-email-password"), "Student-Pass1");
    expect(steps()).toEqual(["done", "done", "current"]);
    await app.user.click(save);
    await waitFor(() => expect(fake.find("post", "/account/email")).toHaveLength(1));
    expect(fake.find("post", "/account/email")[0]!.body).toEqual({ email: "imad@example.com", currentPassword: "Student-Pass1" });
    expect(await screen.findByText(t("account.student.emailSaved"))).toBeInTheDocument();
    // And the link that proves it, said sent — to the new address.
    expect(await screen.findByText(t("account.emailLink.sent", { email: "imad@example.com" }))).toBeInTheDocument();
    expect(await screen.findByTestId("student-email-state")).toHaveTextContent(t("account.student.emailUnverified"));
  });

  it("والأستاذ كذلك (2026-11-20): بريده الخاص في «المعلومات الشخصية» — بلا تبويب «البريد» — ثمّ ينتظر تأكيده بجانب الجامعيّ", async () => {
    const app = renderApp("/ar/professor/account", { as: "professor" });
    await app.user.click(await screen.findByTestId("student-email-edit"));
    // The «email» wing speaks of signing in by it: an administrator's alone.
    expect(screen.queryByTestId("wing-email")).toBeNull();
    const form = screen.getByTestId("student-email-form");
    // Signing in stays by the university address — the note says so, not «the registration number».
    expect(form).toHaveTextContent(t("account.student.emailHintProfessor"));
    await app.user.type(within(form).getByRole("textbox", { name: t("admin.account.email.new") }), "k.merabet@gmail.com");
    await app.user.type(within(form).getByTestId("student-email-password"), "Prof-Pass1");
    await app.user.click(within(form).getByTestId("student-email-save"));
    await waitFor(() => expect(fake.find("post", "/account/email")).toHaveLength(1));
    expect(fake.find("post", "/account/email")[0]!.body).toEqual({ email: "k.merabet@gmail.com", currentPassword: "Prof-Pass1" });
    expect(await screen.findByTestId("student-email-state")).toHaveTextContent(t("account.student.emailUnverified"));
    app.unmount();

    // In «الجلسات والأمان»: the university address works meanwhile; the own one waits for its link.
    fake.on("get", "/account", () => ({
      account: { ...F.myAccount(F.authUsers.professor as never), email: "k.merabet@gmail.com", emailVerified: false, mailEnabled: true },
    }));
    const sec = renderApp("/ar/professor/account?tab=security", { as: "professor" });
    const card = await screen.findByTestId("recovery-email");
    expect(card).toHaveAttribute("data-verified", "true");
    const pending = within(card).getByTestId("recovery-own-pending");
    expect(pending).toHaveTextContent("k.merabet@gmail.com");
    await sec.user.click(within(pending).getByTestId("recovery-send"));
    await waitFor(() => expect(fake.find("post", "/account/email/verify-request")).toHaveLength(1));
  });

  it("خطأٌ من الخادم عند الحفظ ⇒ رسالته كما هي", async () => {
    fake.fail("patch", "/account", 409, "اسم المستخدم مأخوذ");
    const app = renderApp("/ar/admin/account", { as: "admin" });
    const phone = await screen.findByTestId("acc-phone");
    await app.user.clear(phone);
    await app.user.type(phone, "0770000000");
    await app.user.click(screen.getByTestId("acc-save"));
    expect(await screen.findByText("اسم المستخدم مأخوذ")).toBeInTheDocument();
  });
});

describe("البريد وكلمة المرور", () => {
  it("بريدٌ جديد بكلمة المرور الحالية ⇒ يُرسل الاثنان", async () => {
    const app = renderApp("/ar/admin/account?tab=email", { as: "admin" });
    const email = await waitFor(() => field(t("admin.account.email.new")));
    await app.user.type(email, "admin@univ-msila.dz");
    expect(await screen.findByText(t("admin.account.err.sameEmail"))).toBeInTheDocument();
    await app.user.clear(email);
    await app.user.type(email, "new.admin@univ-msila.dz");
    await app.user.type(field(t("admin.account.currentPassword")), "OldPass#2024");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.account.email.submit")) }));
    await waitFor(() => expect(fake.find("post", "/account/email")).toHaveLength(1));
    expect(fake.find("post", "/account/email")[0]!.body).toEqual({ email: "new.admin@univ-msila.dz", currentPassword: "OldPass#2024" });
  });

  it("كلمة مرورٍ جديدة: لا تطابق ⇒ يُقال؛ مثل القديمة ⇒ يُقال؛ صالحة ⇒ تُغيَّر", async () => {
    const app = renderApp("/ar/admin/account?tab=password", { as: "admin" });
    const cur = await screen.findByTestId("acc-pw-current");
    await app.user.type(cur, "Old#Pass2024");
    await app.user.type(screen.getByTestId("acc-pw-new"), "Old#Pass2024");
    expect(await screen.findByText(t("admin.account.err.samePassword"))).toBeInTheDocument();

    await app.user.clear(screen.getByTestId("acc-pw-new"));
    await app.user.type(screen.getByTestId("acc-pw-new"), "Nouveau#Mot2026");
    await app.user.type(screen.getByTestId("acc-pw-again"), "Nouveau#Mot2025");
    expect(await screen.findByText(t("admin.account.err.mismatch"))).toBeInTheDocument();

    await app.user.clear(screen.getByTestId("acc-pw-again"));
    await app.user.type(screen.getByTestId("acc-pw-again"), "Nouveau#Mot2026");
    expect(await screen.findByText(t("admin.account.password.matches"))).toBeInTheDocument();
    await app.user.keyboard("{Enter}");
    await waitFor(() => expect(fake.find("post", "/account/password")).toHaveLength(1));
    expect(fake.find("post", "/account/password")[0]!.body).toEqual({ currentPassword: "Old#Pass2024", newPassword: "Nouveau#Mot2026" });
    expect(await screen.findByText(t("admin.account.password.changed"))).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe("tok-new");
  });
});

describe("الأمان والأجهزة", () => {
  it("جهازٌ آخر يُخرج بعد التأكيد، والجهاز الحاليّ لا زرّ له", async () => {
    const app = renderApp("/ar/student/account?tab=security", { as: "student" });
    const devices = await screen.findAllByTestId("account-device");
    expect(devices).toHaveLength(2);
    const buttons = screen.getAllByTestId("account-device-signout");
    expect(buttons).toHaveLength(1);
    await app.user.click(buttons[0]!);
    expect(await screen.findByText(t("admin.account.security.signOutTitle"))).toBeInTheDocument();
    expect(fake.find("delete", /^\/account\/sessions/)).toEqual([]);
    const both = screen.getAllByRole("button", { name: esc(t("admin.account.security.signOut")) });
    await app.user.click(both.at(-1)!);
    await waitFor(() => expect(fake.find("delete", "/account/sessions/se2")).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByTestId("account-device")).toHaveLength(1));
  });

  it("الخروج من كلّ الأجهزة يُسأل عنه، ثمّ يُخرج ويعود إلى الدخول", async () => {
    const app = renderApp("/ar/professor/account?tab=security", { as: "professor" });
    const actions = await screen.findAllByRole("button", { name: esc(t("admin.account.security.everywhereAction")) });
    await app.user.click(actions[0]!);
    expect(fake.find("post", "/auth/logout-all")).toEqual([]);
    const again = await screen.findAllByRole("button", { name: esc(t("admin.account.security.everywhereAction")) });
    await app.user.click(again.at(-1)!);
    await waitFor(() => expect(fake.find("post", "/auth/logout-all")).toHaveLength(1));
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
  });

  it("التحقّق بخطوتين مفعَّل: رموزٌ جديدة بكلمة المرور، والاستبدال يطلب الرمز", async () => {
    const app = renderApp("/ar/admin/account?tab=security", { as: "admin" });
    const card = await screen.findByTestId("two-factor-card");
    await app.user.click(within(card).getByRole("button", { name: esc(t("account.twoFactor.renew")) }));
    await app.user.type(within(card).getByLabelText(esc(t("admin.account.currentPassword"))), "Pass#2026");
    await app.user.click(within(card).getAllByRole("button", { name: esc(t("account.twoFactor.renew")) }).at(-1)!);
    await waitFor(() => expect(fake.find("post", "/account/2fa/recovery-codes")[0]?.body).toEqual({ currentPassword: "Pass#2026" }));
    expect(await screen.findByTestId("tfa-recovery")).toHaveTextContent("iiii-jjjj");

    // كتابة الرموز تغيّر updatedAt في الخادم. فلا تختفي قبل أن تُحفظ: تبقى
    // بعد أن يهدأ كلّ طلب، ولا يُعاد طلب الحساب إلّا بعد «متابعة».
    await app.settle();
    expect(screen.getByTestId("tfa-recovery")).toHaveTextContent("iiii-jjjj");
    const reads = fake.find("get", "/account").length;
    await app.user.click(screen.getByTestId("tfa-saved"));
    await app.user.click(screen.getByTestId("tfa-done"));
    await waitFor(() => expect(fake.find("get", "/account").length).toBe(reads + 1));
    expect(await screen.findByTestId("two-factor-card")).not.toHaveTextContent("iiii-jjjj");
  });

  it("الاستبدال يطلب كلمة المرور والرمز معاً", async () => {
    const app = renderApp("/ar/admin/account?tab=security", { as: "admin" });
    const card = await screen.findByTestId("two-factor-card");
    await app.user.click(within(card).getByRole("button", { name: esc(t("account.twoFactor.replace")) }));
    await app.user.type(within(card).getByLabelText(esc(t("admin.account.currentPassword"))), "Pass#2026");
    const submit = within(card).getAllByRole("button", { name: esc(t("account.twoFactor.replace")) }).at(-1)!;
    expect(submit).toBeDisabled();
    await app.user.type(within(card).getByLabelText(esc(t("account.twoFactor.codeOrRecovery"))), "654321");
    await app.user.click(submit);
    await waitFor(() => expect(fake.find("post", "/account/2fa/disable")[0]?.body).toEqual({ currentPassword: "Pass#2026", code: "654321" }));
    expect(await screen.findByText(t("account.twoFactor.disabled"))).toBeInTheDocument();
  });
});

describe("التفضيلات", () => {
  it("تغيير اللغة ينقل الصفحة إلى رابطها", async () => {
    const app = renderApp("/ar/student/account?tab=prefs", { as: "student" });
    await app.user.click(await screen.findByRole("radio", { name: /Français/ }));
    await waitFor(() => expect(app.location()).toMatch(/^\/fr\/student\/account/));
  });
});

describe("الحساب الذي يجب إصلاحه أوّلاً", () => {
  it("كلمة مرورٍ من الإدارة ⇒ لا لوحة قبل تغييرها، وبعده تظهر", async () => {
    const app = renderApp("/ar/student", { as: "student", user: { mustChangePassword: true } });
    await screen.findByTestId("setup-gate-password");
    expect(screen.queryByText(F.topicFull.title)).toBeNull();

    await app.user.type(await screen.findByTestId("acc-pw-current"), "202039012345");
    await app.user.type(screen.getByTestId("acc-pw-new"), "Nouveau#Mot2026");
    await app.user.type(screen.getByTestId("acc-pw-again"), "Nouveau#Mot2026");
    await app.user.keyboard("{Enter}");
    await waitFor(() => expect(fake.find("post", "/account/password")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId("setup-gate-password")).toBeNull());
    expect((await screen.findAllByText(F.topicFull.title)).length).toBeGreaterThan(0);
  });

  it("مسؤولٌ بلا تحقّقٍ بخطوتين ⇒ يمسح الرمز، ويكتب أوّل رمز، ويحفظ رموز الاسترداد، ثمّ يدخل", async () => {
    const app = renderApp("/ar/admin", { as: "admin", user: { twoFactorEnabled: false, twoFactorSetupRequired: true } });
    await screen.findByTestId("setup-gate-twoFactor");
    await app.user.click(await screen.findByTestId("tfa-start"));
    expect(await screen.findByTestId("tfa-secret")).toHaveTextContent("JBSW");

    expect(screen.getByTestId("tfa-enable")).toBeDisabled();
    await app.user.type(screen.getByTestId("tfa-code"), "12a3456");
    expect(screen.getByTestId("tfa-code")).toHaveValue("123456");
    await app.user.click(screen.getByTestId("tfa-enable"));
    await waitFor(() => expect(fake.find("post", "/account/2fa/enable")[0]?.body).toEqual({ code: "123456" }));

    expect(await screen.findByTestId("tfa-recovery")).toHaveTextContent("aaaa-bbbb");
    expect(screen.getByTestId("tfa-done")).toBeDisabled();
    await app.user.click(screen.getByTestId("tfa-saved"));
    // والخادم بطيءٌ في جوابه عن /auth/me: ما بين النقرة والجواب هو ما يراه المستخدم.
    const answer = fake.hold("get", "/auth/me");
    await app.user.click(screen.getByTestId("tfa-done"));
    // اللوحة تُرسم بخطّافها `useMe`، وكان يعيد إلى المتجر جوابه المخزّن
    // القديم فتعود الشاشة نفسها وتبدأ من أوّلها حتى يصل الجديد.
    await screen.findAllByText(F.topicPending.title);
    expect(useAuthStore.getState().user).toMatchObject({ twoFactorEnabled: true, twoFactorSetupRequired: false });
    expect(screen.queryByTestId("setup-gate-twoFactor")).toBeNull();
    answer();
    await app.settle();
    expect(screen.queryByTestId("setup-gate-twoFactor")).toBeNull();
    expect(useAuthStore.getState().user).toMatchObject({ twoFactorEnabled: true, twoFactorSetupRequired: false });
  });
});

describe("الصورة", () => {
  it("صورةٌ تُختار فتُقصّ ثمّ تُرفع، فتظهر في الحساب", async () => {
    const app = renderApp("/ar/professor/account?tab=photo", { as: "professor" });
    await app.user.click(await screen.findByTestId("wing-photo"));
    const input = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement;
    await app.user.upload(input, new File(["png"], "me.png", { type: "image/png" }));
    const cropper = (await screen.findAllByRole("dialog")).at(-1)!;
    const confirm = within(cropper).getAllByRole("button").at(-1)!;
    await waitFor(() => expect(confirm).toBeEnabled());
    await app.user.click(confirm);
    await waitFor(() => expect(fake.find("post", "/account/avatar")).toHaveLength(1));
    expect((fake.find("post", "/account/avatar")[0]!.body as { image: File }).image).toBeInstanceOf(File);
    await waitFor(() => expect(useAuthStore.getState().user?.avatarUrl).toBe("/uploads/avatars/me.jpg"));
  });

  it("ملفٌّ ليس صورة يُسحب ⇒ يُتجاهل؛ وإزالة الصورة تُسأل ثمّ تُرسل null", async () => {
    fake.on("get", "/account", () => ({ account: { ...F.myAccount(F.authUsers.professor), avatarUrl: "/uploads/avatars/old.jpg" } }));
    const app = renderApp("/ar/professor/account?tab=photo", { as: "professor" });
    const upload = await screen.findByTestId("acc-photo-upload");
    const zone = upload.parentElement!.parentElement!;
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["%PDF"], "cv.pdf", { type: "application/pdf" })] } });
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.account.photo.remove")) }));
    await app.user.click((await screen.findAllByRole("button", { name: esc(t("admin.account.photo.remove")) })).at(-1)!);
    await waitFor(() => expect(fake.find("patch", "/account")[0]?.body).toEqual({ avatarUrl: null }));
  });
});
