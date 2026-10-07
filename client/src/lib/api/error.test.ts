import { beforeAll, describe, expect, it } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";
import i18n from "../../i18n/i18n";
import { normalizeError } from "./error";

/** A server answer as axios hands it to the caller. */
const answer = (status: number, data: unknown) =>
  new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as AxiosResponse["config"],
  } as AxiosResponse);

describe("normalizeError — too many attempts", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("the account lock says how long, in the reader's language and grammar", () => {
    const locked = (minutes: number) =>
      normalizeError(
        answer(429, {
          errorCode: "AUTH_TOO_MANY_ATTEMPTS",
          message: `Too many failed attempts on this account. Try again in ${minutes} minute(s).`,
        }),
      ).message;

    expect(locked(15)).toContain("15 دقيقة");
    expect(locked(5)).toContain("5 دقائق");
    expect(locked(2)).toContain("دقيقتين");
  });

  it("the per-address limiter, which names no duration, gets the general message", () => {
    const res = normalizeError(answer(429, { message: "Too many failed attempts. Please try again in a few minutes." }));
    expect(res.status).toBe(429);
    expect(res.message).toBe(i18n.t("apiError.tooManyRequests"));
  });

  it("and in English, plural by count", async () => {
    await i18n.changeLanguage("en");
    const one = normalizeError(
      answer(429, { errorCode: "AUTH_TOO_MANY_ATTEMPTS", message: "Try again in 1 minute(s)." }),
    ).message;
    const many = normalizeError(
      answer(429, { errorCode: "AUTH_TOO_MANY_ATTEMPTS", message: "Try again in 30 minute(s)." }),
    ).message;
    expect(one).toMatch(/in 1 minute\.$/);
    expect(many).toMatch(/in 30 minutes\.$/);
  });
});
