import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

/**
 * الطالب الذي لم يُفعَّل بعد، والتفعيل مفعّل (Backend modules/activation).
 *
 * يُحرس: أنّ من دخل بكلمة المرور المسلَّمة لا يرى إلا شاشة التفعيل — لا شيء من
 * لوحته — وأنّها تبدأ بكلمة المرور، ولا طريق غيرها (رمز مكتب التفعيل ذهب)؛
 * وأنّ «نسيت كلمة المرور؟» في صفحة الدخول تدلّ الطالب على صفحتها دائماً — ولو لم
 * يرسل الخادم بريداً: طريقه حينئذٍ طلبٌ إلى الإدارة بصورة بطاقته
 * (features/auth/password-request.flows.test). وأمّا المرحلتان نفسهما ففي
 * features/account/activation-screen.flows.test.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("دخل بكلمة المرور المسلَّمة", () => {
  it("⇒ شاشة التفعيل وحدها، تبدأ بكلمة المرور — ولا رمز مكتب", async () => {
    renderApp("/ar/student", { as: "student", user: { activationRequired: true, mustChangePassword: true } });
    await screen.findByTestId("setup-gate-activation");
    expect(screen.getByRole("heading", { name: t("account.gate.activation.password.title") })).toBeInTheDocument();
    expect(await screen.findByTestId("acc-pw-new")).toBeInTheDocument();
    expect(screen.queryByTestId("activation-use-code")).toBeNull();
    // Nothing of the dashboard behind it.
    expect(screen.queryByText(F.topicFull.title)).toBeNull();
  });
});

describe("«نسيت كلمة المرور؟» في صفحة الدخول", () => {
  it("⇒ صفحة الاستعادة للطالب، ولو لم يرسل الخادم بريداً — لا نموذج رمز", async () => {
    fake.on("get", "/auth/password/available", { available: false });
    renderApp("/ar/login");
    expect(await screen.findByTestId("login-forgot")).toHaveAttribute("href", "/ar/forgot-password");
    expect(screen.getByText(t("auth.forgotPasswordQ"), { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(t("auth.contactAdministration"))).toBeNull();
  });
});
