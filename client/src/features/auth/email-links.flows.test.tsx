import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

/**
 * «نسيت كلمة المرور» وتأكيد البريد، من جهة الواجهة.
 *
 * يُحرس: أنّ صفحة الدخول تدلّ على الاستعادة حين يرسل الخادم بريداً، وعلى
 * الإدارة حين لا يرسل؛ وأنّ ما يُرسَل هو ما كُتب؛ وأنّ الرمز يُرفع من شريط
 * العنوان؛ وأنّ كلمة المرور الجديدة تمرّ بقواعد الموقع قبل أن تُرسَل؛ وأنّ
 * الرابط المنتهي يقول ذلك ويدلّ على طلب غيره؛ وأنّ صفحة الحساب تقول هل البريد
 * مؤكَّد، وتطلب رابط تأكيده.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const TOKEN = "A".repeat(43);
const STRONG = "Zeitoun-Ouargla-2026!";

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("نسيت كلمة المرور", () => {
  it("صفحة الدخول تدلّ عليها، والطلب يُرسل ما كُتب ويقول جواب الخادم", async () => {
    const app = renderApp("/ar/login");
    await app.user.click(await screen.findByTestId("login-forgot"));
    await waitFor(() => expect(app.location()).toBe("/ar/forgot-password"));

    await app.user.type(screen.getByTestId("recover-identifier"), " 202039012345 ");
    await app.user.click(screen.getByTestId("recover-send"));
    await waitFor(() => expect(fake.find("post", "/auth/password/forgot")).toHaveLength(1));
    expect(fake.find("post", "/auth/password/forgot")[0]!.body).toEqual({ identifier: "202039012345" });
    expect(await screen.findByTestId("recover-sent")).toHaveTextContent("إن كان لهذا الحساب بريدٌ مؤكَّد");
  });

  it("زرّ التبديل: الأستاذ يكتب بريده الجامعي — ولكلّ جهةٍ ما كُتب فيها", async () => {
    const app = renderApp("/ar/forgot-password");
    await app.user.type(await screen.findByTestId("recover-identifier"), "202039012345");
    expect(screen.getByTestId("recover-as-student")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(t("auth.recover.subtitleStudent"))).toBeInTheDocument();

    await app.user.click(screen.getByTestId("recover-as-professor"));
    expect(screen.getByTestId("recover-as-professor")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(t("auth.recover.subtitleProfessor"))).toBeInTheDocument();
    expect(screen.getByTestId("recover-identifier")).toHaveValue("");

    // ليس بريداً ⇒ يقال ذلك، ولا يُرسل شيء
    await app.user.type(screen.getByTestId("recover-identifier"), "prof");
    await app.user.click(screen.getByTestId("recover-send"));
    expect(screen.getByText(t("validation.emailInvalid"))).toBeInTheDocument();
    expect(fake.find("post", "/auth/password/forgot")).toEqual([]);

    await app.user.type(screen.getByTestId("recover-identifier"), "@univ-eloued.dz");
    await app.user.click(screen.getByTestId("recover-send"));
    await waitFor(() => expect(fake.find("post", "/auth/password/forgot")).toHaveLength(1));
    expect(fake.find("post", "/auth/password/forgot")[0]!.body).toEqual({ identifier: "prof@univ-eloued.dz" });
  });

  it("وما كُتب في جهة الطالب يبقى حين يعود إليها", async () => {
    const app = renderApp("/ar/forgot-password");
    await app.user.type(await screen.findByTestId("recover-identifier"), "202039012345");
    await app.user.click(screen.getByTestId("recover-as-professor"));
    await app.user.click(screen.getByTestId("recover-as-student"));
    expect(screen.getByTestId("recover-identifier")).toHaveValue("202039012345");
  });

  it("من تبويب الأستاذ في صفحة الدخول ⇒ تُفتح الصفحة على الأستاذ", async () => {
    const app = renderApp("/ar/login");
    await app.user.click(await screen.findByTestId("role-professor"));
    await app.user.click(await screen.findByTestId("login-forgot"));
    await waitFor(() => expect(app.location()).toBe("/ar/forgot-password?as=professor"));
    expect(await screen.findByTestId("recover-as-professor")).toHaveAttribute("aria-checked", "true");
  });

  it("خادمٌ لا يرسل بريداً ⇒ الطالب يجد الصفحة (طريقه الإدارة)، والأستاذ يُدلّ على الإدارة، والصفحة تقول لماذا", async () => {
    fake.on("get", "/auth/password/available", { available: false });
    const app = renderApp("/ar/login");
    expect(await screen.findByTestId("login-forgot")).toBeInTheDocument();
    await app.user.click(screen.getByTestId("role-professor"));
    expect(await screen.findByText(t("auth.contactAdministration"))).toBeInTheDocument();
    expect(screen.queryByTestId("login-forgot")).toBeNull();
    app.unmount();

    renderApp("/ar/forgot-password?as=professor");
    expect(await screen.findByTestId("recover-off")).toHaveTextContent(t("auth.recover.mailOff"));
    expect(screen.queryByTestId("recover-identifier")).toBeNull();
  });
});

describe("كلمة مرور جديدة من الرابط", () => {
  it("الرمز يُرفع من شريط العنوان؛ وكلمةٌ ضعيفة لا تُرسل؛ والقويّة المكرّرة تُحفظ", async () => {
    const app = renderApp(`/ar/reset-password?token=${TOKEN}`);
    await screen.findByTestId("reset-password");
    expect(fake.find("post", "/auth/password/reset/check")[0]!.body).toEqual({ token: TOKEN });
    await waitFor(() => expect(app.location()).toBe("/ar/reset-password"));

    await app.user.type(screen.getByTestId("reset-password"), "12345678");
    await app.user.type(screen.getByTestId("reset-again"), "12345678");
    expect(screen.getByTestId("reset-save")).toBeDisabled();

    await app.user.clear(screen.getByTestId("reset-password"));
    await app.user.clear(screen.getByTestId("reset-again"));
    await app.user.type(screen.getByTestId("reset-password"), STRONG);
    await app.user.type(screen.getByTestId("reset-again"), `${STRONG}x`);
    expect(screen.getByText(t("auth.recover.mismatch"))).toBeInTheDocument();
    expect(screen.getByTestId("reset-save")).toBeDisabled();

    await app.user.type(screen.getByTestId("reset-again"), "{Backspace}");
    await app.user.click(screen.getByTestId("reset-save"));
    await waitFor(() => expect(fake.find("post", "/auth/password/reset")).toHaveLength(1));
    expect(fake.find("post", "/auth/password/reset")[0]!.body).toEqual({ token: TOKEN, password: STRONG });
    expect(await screen.findByTestId("reset-done")).toBeInTheDocument();
    // The button and the "back" link both lead to the sign-in page.
    const toLogin = screen.getAllByRole("link", { name: new RegExp(t("auth.signIn")) });
    expect(toLogin.map((l) => l.getAttribute("href"))).toEqual(toLogin.map(() => "/ar/login"));
  });

  it("رابطٌ منتهٍ أو مستعمل ⇒ يقال ذلك، ويدلّ على طلب غيره", async () => {
    fake.on("post", "/auth/password/reset/check", { valid: false });
    renderApp(`/ar/reset-password?token=${TOKEN}`);
    expect(await screen.findByTestId("reset-invalid")).toHaveTextContent(t("auth.recover.invalid"));
    expect(screen.getByRole("link", { name: new RegExp(t("auth.recover.newLink")) })).toHaveAttribute("href", "/ar/forgot-password");
    expect(screen.queryByTestId("reset-password")).toBeNull();
  });

  it("وصفحةٌ بلا رمز ⇒ لا سؤال للخادم", async () => {
    renderApp("/ar/reset-password");
    expect(await screen.findByTestId("reset-invalid")).toBeInTheDocument();
    expect(fake.find("post", "/auth/password/reset/check")).toEqual([]);
  });
});

describe("تأكيد البريد", () => {
  it("فتحُ الرابط يؤكّده — مرّةً واحدة — ويقول ذلك", async () => {
    const app = renderApp(`/ar/verify-email?token=${TOKEN}`);
    expect(await screen.findByTestId("verify-done")).toHaveTextContent("تأكّد بريدك.");
    expect(fake.find("post", "/auth/email/verify")).toHaveLength(1);
    expect(fake.find("post", "/auth/email/verify")[0]!.body).toEqual({ token: TOKEN });
    await waitFor(() => expect(app.location()).toBe("/ar/verify-email"));
  });

  it("رابطٌ منتهٍ ⇒ رسالة الخادم", async () => {
    fake.fail("post", "/auth/email/verify", 400, "رابط التأكيد غير صالح أو انتهت مدّته");
    renderApp(`/ar/verify-email?token=${TOKEN}`);
    expect(await screen.findByTestId("verify-invalid")).toHaveTextContent("رابط التأكيد غير صالح أو انتهت مدّته");
  });

  it("صفحة الحساب: بريدٌ غير مؤكَّد ⇒ «غير مؤكَّد» وزرٌّ يطلب رابطه", async () => {
    const app = renderApp("/ar/student/account?tab=security", { as: "student" });
    const card = await screen.findByTestId("recovery-email");
    expect(card).not.toHaveAttribute("data-verified");
    expect(within(card).getByText(t("admin.account.recovery.unverified"))).toBeInTheDocument();
    await app.user.click(within(card).getByTestId("recovery-send"));
    await waitFor(() => expect(fake.find("post", "/account/email/verify-request")).toHaveLength(1));
    expect(await screen.findByText("أرسلنا رابط التأكيد إلى بريدك.")).toBeInTheDocument();
  });

  it("والمؤكَّد ⇒ «مؤكَّد» بلا زرّ", async () => {
    fake.on("get", "/account", () => ({
      account: { ...F.myAccount(F.authUsers.professor as never, "2026-10-01T10:00:00.000Z"), mailEnabled: true, emailVerified: true },
    }));
    renderApp("/ar/professor/account?tab=security", { as: "professor" });
    const card = await screen.findByTestId("recovery-email");
    expect(card).toHaveAttribute("data-verified", "true");
    expect(within(card).getByText(t("admin.account.recovery.verified"))).toBeInTheDocument();
    expect(within(card).queryByTestId("recovery-send")).toBeNull();
  });
});
