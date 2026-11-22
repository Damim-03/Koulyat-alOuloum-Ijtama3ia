import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * «المستخدمون ← طلبات كلمة المرور» (Backend modules/password-request).
 *
 * يُحرس: أنّ للطلبات جزءها في مفتاح الصفحة بعدد ما ينتظر؛ وأنّ الطلب يُعرض
 * بصورة البطاقة؛ وأنّ كلمة المرور لا تُرسل قبل التحقّق من البطاقة، ولا قبل أن
 * تمرّ بقواعد الموقع وتُكتب مرّتين متطابقتين؛ وأنّ ما يُرسل هو ما كُتب مع موعد
 * الطلب الذي رآه المسؤول؛ وأنّ الرفض يُرسل سببه.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const R = F.passwordRequest;
const STRONG = "Wadi-Souf#2026";

const created = URL.createObjectURL;
const revoked = URL.revokeObjectURL;
beforeEach(() => {
  fake.reset();
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  URL.createObjectURL = created;
  URL.revokeObjectURL = revoked;
});

describe("طلبات كلمة المرور", () => {
  it("جزءٌ بعدد ما ينتظر؛ البطاقة أوّلاً، ثمّ كلمةٌ قويّة مكرّرة ⇒ تُرسل", async () => {
    const app = renderApp("/ar/admin/users?view=passwords", { as: "admin" });
    const card = await screen.findByTestId("password-request");
    expect(screen.getByTestId("users-view-passwords")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("users-view-passwords")).toHaveTextContent("1");
    expect(within(within(card).getByTestId("password-request-toggle")).getByText(R.registrationNumber)).toBeInTheDocument();
    expect(await within(card).findByTestId("request-photo-card")).toHaveAttribute("src", "blob:photo");
    // Beside it, the university's card filled from the account: what the photo should say.
    const expected = within(card).getByTestId("student-card");
    expect(within(expected).getByTestId("student-card-last")).toHaveTextContent(R.lastName!);
    expect(within(expected).getByTestId("student-card-first")).toHaveTextContent(R.firstName!);
    expect(within(expected).getByTestId("student-card-number")).toHaveTextContent(R.registrationNumber);
    expect(within(expected).getByTestId("student-card-domain")).toHaveTextContent(R.domain!);
    expect(within(expected).getByTestId("student-card-filiere")).toHaveTextContent(R.filiere);

    const approve = within(card).getByTestId("password-request-approve");
    expect(approve).toBeDisabled();
    // The password waits for the card to be checked.
    expect(within(card).getByTestId("password-request-password")).toBeDisabled();
    await app.user.click(within(card).getByTestId("password-request-matched"));

    await app.user.type(within(card).getByTestId("password-request-password"), "12345678");
    await app.user.type(within(card).getByTestId("password-request-again"), "12345678");
    expect(approve).toBeDisabled();

    await app.user.clear(within(card).getByTestId("password-request-password"));
    await app.user.clear(within(card).getByTestId("password-request-again"));
    await app.user.type(within(card).getByTestId("password-request-password"), STRONG);
    await app.user.type(within(card).getByTestId("password-request-again"), `${STRONG}x`);
    expect(within(card).getByText(t("auth.recover.mismatch"))).toBeInTheDocument();
    expect(approve).toBeDisabled();
    await app.user.type(within(card).getByTestId("password-request-again"), "{Backspace}");
    expect(approve).toBeEnabled();

    await app.user.click(approve);
    await waitFor(() => expect(fake.find("post", `/admin/password-requests/${R.id}/approve`)).toHaveLength(1));
    expect(fake.find("post", `/admin/password-requests/${R.id}/approve`)[0]!.body).toEqual({ sentAt: R.sentAt, password: STRONG });
    expect(await screen.findByText(t("admin.passwordRequests.done", { name: "أمين حداد" }))).toBeInTheDocument();
  });

  it("الرفض بسبب", async () => {
    const app = renderApp("/ar/admin/users?view=passwords", { as: "admin" });
    const card = await screen.findByTestId("password-request");
    await app.user.click(within(card).getByTestId("password-request-refuse"));
    const confirm = within(card).getByTestId("password-request-refuse-confirm");
    expect(confirm).toBeDisabled();
    await app.user.type(within(card).getByTestId("password-request-reason"), "البطاقة لغير صاحب الحساب");
    await app.user.click(confirm);
    await waitFor(() => expect(fake.find("post", `/admin/password-requests/${R.id}/reject`)).toHaveLength(1));
    expect(fake.find("post", `/admin/password-requests/${R.id}/reject`)[0]!.body).toEqual({ sentAt: R.sentAt, reason: "البطاقة لغير صاحب الحساب" });
  });

  it("لا طلبات ⇒ يقال ذلك", async () => {
    fake.empty = true;
    renderApp("/ar/admin/users?view=passwords", { as: "admin" });
    expect(await screen.findByTestId("password-requests-empty")).toHaveTextContent(t("admin.passwordRequests.empty"));
  });
});
