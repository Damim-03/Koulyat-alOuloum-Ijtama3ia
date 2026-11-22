import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/app.config";
import {
  DEVICE_COOKIE,
  REFRESH_COOKIE,
  clearRefreshCookie,
  ensureDeviceId,
  isHttpsRequest,
  readDeviceId,
  readRefreshCookie,
  setRefreshCookie,
} from "./refresh-cookie";

/**
 * كعكة رمز التجديد ومعرّف المتصفّح — بلا خادم.
 *
 * يُحرس: أنّ الكعكة لا تُقرأ من سكربت (httpOnly) وتُحصر في مسارات الدخول؛
 * وأنّ SameSite=None يُلزم Secure (وإلّا رفضها المتصفّح)؛ وأنّ عمرها عمرُ
 * الرمز الذي فيها؛ وأنّ ما يُقرأ منها لا يُقبل إلّا نصّاً معقول الطول؛ وأنّ
 * معرّف المتصفّح يبقى كما هو إن صحّ، ويُصنع جديداً إن لم يصحّ.
 */
const req = (secure: boolean, proto?: string | string[], cookies?: Record<string, unknown>) =>
  ({
    secure,
    headers: proto === undefined ? {} : { "x-forwarded-proto": proto },
    cookies,
  }) as unknown as Request;
const res = (from: Request) => {
  const r = { req: from, cookie: jest.fn(), clearCookie: jest.fn() };
  return r as unknown as Response & { cookie: jest.Mock; clearCookie: jest.Mock };
};

/** يغيّر إعداداً لاختبارٍ واحد ثمّ يعيده. */
function withConfig(patch: Partial<typeof config>, run: () => void) {
  const before = { ...config };
  Object.assign(config, patch);
  try {
    run();
  } finally {
    Object.assign(config, before);
  }
}

describe("isHttpsRequest", () => {
  it("a TLS connection is HTTPS", () => {
    expect(isHttpsRequest(req(true))).toBe(true);
  });

  it("behind a proxy that ends TLS, X-Forwarded-Proto decides", () => {
    expect(isHttpsRequest(req(false, "https"))).toBe(true);
    expect(isHttpsRequest(req(false, "HTTPS, http"))).toBe(true);
    expect(isHttpsRequest(req(false, "http"))).toBe(false);
  });

  it("a header repeated by two proxies: the first one, the nearest the browser, decides", () => {
    expect(isHttpsRequest(req(false, ["https", "http"]))).toBe(true);
    expect(isHttpsRequest(req(false, ["http", "https"]))).toBe(false);
    expect(isHttpsRequest(req(false, []))).toBe(false);
  });

  it("plain HTTP with no proxy is not", () => {
    expect(isHttpsRequest(req(false))).toBe(false);
  });
});

describe("setRefreshCookie / clearRefreshCookie", () => {
  it("httpOnly, scoped to the auth path, and living exactly as long as the token", () => {
    const token = jwt.sign({ sub: "u1" }, "secret", { expiresIn: 3600 });
    const r = res(req(false));
    setRefreshCookie(r, token);
    const [name, value, options] = r.cookie.mock.calls[0]!;
    expect(name).toBe(REFRESH_COOKIE);
    expect(value).toBe(token);
    expect(options).toMatchObject({ httpOnly: true, path: config.AUTH_COOKIE_PATH, sameSite: config.AUTH_COOKIE_SAMESITE });
    expect(options.maxAge).toBeGreaterThan(3590 * 1000);
    expect(options.maxAge).toBeLessThanOrEqual(3600 * 1000);
  });

  it("a token without an expiry ⇒ a session cookie (no maxAge); one already expired ⇒ maxAge 0", () => {
    const r = res(req(false));
    setRefreshCookie(r, jwt.sign({ sub: "u1" }, "secret"));
    expect(r.cookie.mock.calls[0]![2]).not.toHaveProperty("maxAge");
    setRefreshCookie(r, "not-a-jwt");
    expect(r.cookie.mock.calls[1]![2]).not.toHaveProperty("maxAge");
    setRefreshCookie(r, jwt.sign({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 60 }, "secret"));
    expect(r.cookie.mock.calls[2]![2].maxAge).toBe(0);
  });

  it("Secure follows the request when set to auto; a fixed setting wins; SameSite=None always forces it", () => {
    withConfig({ AUTH_COOKIE_SECURE: "auto", AUTH_COOKIE_SAMESITE: "lax" }, () => {
      const plain = res(req(false));
      clearRefreshCookie(plain);
      expect(plain.clearCookie.mock.calls[0]![1].secure).toBe(false);
      const tls = res(req(false, "https"));
      clearRefreshCookie(tls);
      expect(tls.clearCookie.mock.calls[0]![1].secure).toBe(true);
    });
    withConfig({ AUTH_COOKIE_SECURE: true, AUTH_COOKIE_SAMESITE: "strict" }, () => {
      const r = res(req(false));
      clearRefreshCookie(r);
      expect(r.clearCookie.mock.calls[0]![1]).toMatchObject({ secure: true, sameSite: "strict" });
    });
    withConfig({ AUTH_COOKIE_SECURE: false, AUTH_COOKIE_SAMESITE: "none" }, () => {
      const r = res(req(false));
      clearRefreshCookie(r);
      expect(r.clearCookie.mock.calls[0]![1]).toMatchObject({ secure: true, sameSite: "none" });
    });
  });
});

describe("readRefreshCookie", () => {
  it("only a non-empty string of a sane length is read", () => {
    expect(readRefreshCookie(req(false, undefined, { [REFRESH_COOKIE]: "abc.def.ghi" }))).toBe("abc.def.ghi");
    expect(readRefreshCookie(req(false, undefined, { [REFRESH_COOKIE]: "" }))).toBeUndefined();
    expect(readRefreshCookie(req(false, undefined, { [REFRESH_COOKIE]: "x".repeat(4096) }))).toBeUndefined();
    expect(readRefreshCookie(req(false, undefined, { [REFRESH_COOKIE]: ["a", "b"] }))).toBeUndefined();
    expect(readRefreshCookie(req(false, undefined, {}))).toBeUndefined();
    expect(readRefreshCookie(req(false))).toBeUndefined();
  });
});

describe("the browser's own id", () => {
  const good = "AbCdEfGhIjKlMnOpQrStUvWx";

  it("a well-formed id is read; anything else is not", () => {
    expect(readDeviceId(req(false, undefined, { [DEVICE_COOKIE]: good }))).toBe(good);
    expect(readDeviceId(req(false, undefined, { [DEVICE_COOKIE]: "short" }))).toBeUndefined();
    expect(readDeviceId(req(false, undefined, { [DEVICE_COOKIE]: `${good}<script>` }))).toBeUndefined();
    expect(readDeviceId(req(false, undefined, { [DEVICE_COOKIE]: 42 }))).toBeUndefined();
    expect(readDeviceId(req(false))).toBeUndefined();
  });

  it("kept when it has one, made when it has none — and renewed for 400 days either way", () => {
    const known = req(false, undefined, { [DEVICE_COOKIE]: good });
    const r1 = res(known);
    expect(ensureDeviceId(known, r1)).toBe(good);
    expect(r1.cookie).toHaveBeenCalledWith(DEVICE_COOKIE, good, expect.objectContaining({ httpOnly: true, maxAge: 400 * 24 * 60 * 60 * 1000 }));

    const fresh = req(false, undefined, {});
    const r2 = res(fresh);
    const made = ensureDeviceId(fresh, r2);
    expect(made).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(readDeviceId(req(false, undefined, { [DEVICE_COOKIE]: made }))).toBe(made);
    expect(ensureDeviceId(fresh, res(fresh))).not.toBe(made);
  });
});
