import { afterAll, describe, expect, it } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";
import i18n from "../../i18n/i18n";
import { fallbackFor, localizeServerMessage, speaksUiLanguage } from "./localize";
import { normalizeError } from "./error";

/** رسائل الخادم بلغة الواجهة — والأصل محفوظٌ للتفاصيل. */

const answer = (status: number, data: unknown) =>
  new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as AxiosResponse["config"],
  } as AxiosResponse);

afterAll(async () => {
  await i18n.changeLanguage("ar");
});

describe("speaksUiLanguage", () => {
  it("Arabic letters for the Arabic interface, anything else for English and French", () => {
    expect(speaksUiLanguage("لا يمكن حذف التخصص", "ar")).toBe(true);
    expect(speaksUiLanguage("Specialization not found", "ar")).toBe(false);
    expect(speaksUiLanguage("2025/2026", "ar")).toBe(true); // لا حروف: لا لغة تُخالف
    expect(speaksUiLanguage("Specialization not found", "en")).toBe(true);
    expect(speaksUiLanguage("Sujet introuvable", "fr")).toBe(true);
    expect(speaksUiLanguage("لا يمكن حذف التخصص", "fr")).toBe(false);
  });
});

describe("localizeServerMessage", () => {
  it("an Arabic refusal on an English screen becomes English — the original kept", async () => {
    await i18n.changeLanguage("en");
    const data = { message: "لا يمكن حذف التخصص لارتباطه بـ 3 طالب.", errorCode: "VALIDATION_ERROR" };
    localizeServerMessage(data, 400);
    expect(data.message).toBe(i18n.t("apiError.refused"));
    expect((data as { originalMessage?: string }).originalMessage).toContain("لا يمكن حذف التخصص");
  });

  it("an English 'not found' on the Arabic screen becomes Arabic", async () => {
    await i18n.changeLanguage("ar");
    const data = { message: "Specialization not found", errorCode: "RESOURCE_NOT_FOUND" };
    localizeServerMessage(data, 404);
    expect(data.message).toBe(i18n.t("apiError.notFound"));
    expect(data.message).toMatch(/[؀-ۿ]/);
  });

  it("a message already in the interface language keeps all its detail", async () => {
    await i18n.changeLanguage("ar");
    const data = { message: "لا يمكن حذف التخصص لارتباطه بـ 3 طالب." };
    localizeServerMessage(data, 400);
    expect(data.message).toBe("لا يمكن حذف التخصص لارتباطه بـ 3 طالب.");
    expect(data).not.toHaveProperty("originalMessage");
  });
});

describe("normalizeError — the code's message follows a language switch", () => {
  it("is translated when shown, not when the module loaded", async () => {
    const err = () => normalizeError(answer(401, { errorCode: "AUTH_INVALID_CREDENTIALS", message: "x" })).message;
    await i18n.changeLanguage("ar");
    const ar = err();
    await i18n.changeLanguage("fr");
    const fr = err();
    expect(ar).toBe(i18n.t("apiError.badCredentials", { lng: "ar" }));
    expect(fr).toBe(i18n.t("apiError.badCredentials", { lng: "fr" }));
    expect(fr).not.toBe(ar);
  });
});

describe("fallbackFor — a message for each kind of failure", () => {
  it("a known code wins; otherwise the status decides", async () => {
    await i18n.changeLanguage("ar");
    const k = (key: string) => i18n.t(key);
    expect(fallbackFor(400, "AUTH_ACCOUNT_SUSPENDED")).toBe(k("apiError.suspended"));
    expect(fallbackFor(404, "UNKNOWN_CODE")).toBe(k("apiError.notFound"));
    const byStatus: [number, string][] = [
      [400, "apiError.refused"],
      [422, "apiError.refused"],
      [401, "apiError.sessionExpired"],
      [403, "apiError.forbidden"],
      [404, "apiError.notFound"],
      [409, "apiError.conflict"],
      [413, "apiError.tooLarge"],
      [429, "apiError.tooManyRequests"],
      [500, "apiError.server"],
      [503, "apiError.server"],
      [418, "apiError.unexpected"],
    ];
    for (const [status, key] of byStatus) expect(fallbackFor(status), String(status)).toBe(k(key));
  });

  it("leaves bodies without a usable message untouched", () => {
    const empty = { message: "   " };
    localizeServerMessage(empty, 400);
    expect(empty).toEqual({ message: "   " });
    const noMessage = { errorCode: "X" };
    localizeServerMessage(noMessage, 400);
    expect(noMessage).toEqual({ errorCode: "X" });
    expect(() => localizeServerMessage(null, 500)).not.toThrow();
    expect(() => localizeServerMessage("text", 500)).not.toThrow();
  });
});
