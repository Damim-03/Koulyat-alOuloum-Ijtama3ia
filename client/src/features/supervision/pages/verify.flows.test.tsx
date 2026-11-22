import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import i18n from "../../../i18n/i18n";
import { fake } from "../../../test/fake-api";
import { renderApp } from "../../../test/render-app";
import * as F from "../../../test/fixtures";
import { isValidEan13 } from "../lib/ean13";

/**
 * التحقّق من ورقةٍ مطبوعة بأرقامها الثلاثة عشر، بلا تسجيل دخول.
 *
 * يُحرس: أنّ رقماً خانة تحقّقه خاطئة يُقال في مكانه قبل أن يُسأل الخادم
 * (خطأ الكتابة أشيع من التزوير، و«غير صالحة» تخيف صاحب ورقةٍ سليمة)؛ وأنّ
 * تصحيحه يرفع التنبيه؛ وأنّ الصحيح يُفتح على نتيجته.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const VALID = "6131234567893";
const TYPO = "6131234567890";

beforeEach(() => {
  fake.reset();
});

describe("التحقّق بالأرقام", () => {
  it("خانة تحقّقٍ خاطئة ⇒ «الرقم غير صحيح» بلا طلب؛ والكتابة ترفعه؛ والصحيح يُفتح على نتيجته", async () => {
    expect(isValidEan13(VALID)).toBe(true);
    expect(isValidEan13(TYPO)).toBe(false);
    const app = renderApp("/ar/verify", {});
    const input = await screen.findByPlaceholderText(t("verify.codePlaceholder"));
    await app.user.type(input, TYPO);
    await app.user.click(screen.getByRole("button", { name: new RegExp(t("verify.check")) }));
    expect(await screen.findByText(t("verify.badCode"))).toBeInTheDocument();
    expect(fake.find("get", /^\/verify\//)).toEqual([]);

    await app.user.clear(input);
    expect(screen.queryByText(t("verify.badCode"))).toBeNull();
    // المسافات والشرطات تُحذف قبل الحساب.
    await app.user.type(input, "613 1234-567893{Enter}");
    await waitFor(() => expect(app.location()).toBe(`/ar/verify/${VALID}`));
    expect(await screen.findByText(t("verify.validTitle"))).toBeInTheDocument();
    expect(screen.getAllByText(F.supervisionDoc.documentNumber).length).toBeGreaterThan(0);
  });

  it("رمزٌ لا وثيقة به ⇒ «غير صالحة»", async () => {
    renderApp("/ar/verify/missing", {});
    expect(await screen.findByText(t("verify.invalidTitle"))).toBeInTheDocument();
  });
});
