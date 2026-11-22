import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import i18next from "i18next";
import "../../i18n/i18n";
import { useAuthStore } from "../../store/auth.store";
import { useConnection } from "../connection/connection";
import { reportServerUp, reportUnreachable } from "../connection/connection";
import { client, ensureAccessToken, SESSION_EXPIRED_EVENT } from "./client";

/**
 * عميل الـAPI — كلّ طلبٍ في الواجهة يمرّ به.
 *
 * الشبكة هنا مُحاكاة بمحوِّل axios: كلّ طلبٍ يُسجَّل ويُجاب بما يقرّره
 * الاختبار. وما يُحرس:
 *
 *   **التوكن من الذاكرة، ويُجدَّد مرّةً للجميع** — بعد إعادة تحميل الصفحة لا
 *   توكن، فأوّل الطلبات يجلبه، والطلبات المتزامنة تنتظر التجديد نفسه.
 *
 *   **الخادم وحده يُنهي الجلسة** — رفضه التجديد يُخرج المستخدم ويُعلن
 *   انتهاءها؛ وانقطاع الشبكة أو عطله (5xx) لا يقول شيئاً عن الجلسة.
 *
 *   **الزائر لا يُجدِّد** — 401 له متوقَّعة، فلا «انتهت جلستك» لمن لم يدخل.
 */
vi.mock("../connection/connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../connection/connection")>()),
  reportServerUp: vi.fn(),
  reportUnreachable: vi.fn(),
}));

type Reply = { status: number; data?: unknown } | "network" | "cancel";
type Call = { url: string; method: string; auth?: string; lang?: string; type?: string; data?: unknown };

let calls: Call[] = [];
type Seen = InternalAxiosRequestConfig & { url: string };
let answer: (config: Seen) => Reply = () => ({ status: 200 });

const adapter: AxiosAdapter = async (config) => {
  const url = (config.url ?? "").replace(config.baseURL ?? "", "");
  calls.push({
    url,
    method: config.method ?? "get",
    auth: config.headers.Authorization as string | undefined,
    lang: config.headers["Accept-Language"] as string | undefined,
    type: config.headers["Content-Type"] as string | undefined,
    data: config.data,
  });
  const reply = answer({ ...config, url });
  if (reply === "network") throw new AxiosError("Network Error", "ERR_NETWORK", config);
  if (reply === "cancel") throw new axios.Cancel("aborted");
  const response = { data: reply.data ?? {}, status: reply.status, statusText: "", headers: {}, config } as AxiosResponse;
  if (reply.status >= 400) throw new AxiosError("fail", "ERR_BAD_RESPONSE", config, {}, response);
  return response;
};

const user = { id: "u1", role: "admin", mustChangePassword: false } as never;
const signedIn = (accessToken: string | null) =>
  useAuthStore.setState({ user, accessToken, isAuthenticated: true });
const refreshes = () => calls.filter((c) => c.url.endsWith("/auth/refresh"));

beforeEach(() => {
  calls = [];
  answer = () => ({ status: 200 });
  client.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
  useConnection.setState({ link: "ok" });
});
afterEach(() => vi.clearAllMocks());

describe("client — ما يُرسل مع كلّ طلب", () => {
  it("التوكن ولغة الواجهة، وJSON ما لم يكن الجسم ملفّاً", async () => {
    signedIn("t-1");
    await client.post("/topics", { title: "x" });
    await client.post("/uploads", new FormData());
    expect(calls[0]).toMatchObject({ auth: "Bearer t-1", lang: "ar", type: "application/json" });
    // ملفٌّ: لا يُفرض عليه JSON — المتصفّح يكتب نوعه بحدوده بنفسه.
    expect(calls[1]!.type).not.toBe("application/json");
  });

  it("وقبل أن تُعرف لغة الواجهة ⇒ بلا ترويسة لغة", async () => {
    const lang = i18next.language;
    i18next.language = undefined as never;
    try {
      await client.get("/x");
      expect(calls[0]!.lang).toBeUndefined();
    } finally {
      i18next.language = lang;
    }
  });

  it("وترويسة نوعٍ كتبها المُنادي تبقى", async () => {
    await client.post("/x", "a,b", { headers: { "Content-Type": "text/csv" } });
    expect(calls[0]!.type).toBe("text/csv");
  });
});

describe("client — التوكن بعد إعادة التحميل", () => {
  it("لا توكن في الذاكرة ⇒ يُجدَّد أوّلاً، ومرّةً واحدة لطلباتٍ متزامنة", async () => {
    signedIn(null);
    answer = (c) => (c.url.endsWith("/auth/refresh") ? { status: 200, data: { accessToken: "fresh" } } : { status: 200 });

    await Promise.all([client.get("/a"), client.get("/b"), client.get("/c")]);

    expect(refreshes()).toHaveLength(1);
    expect(calls.filter((c) => !c.url.endsWith("/auth/refresh")).map((c) => c.auth)).toEqual([
      "Bearer fresh",
      "Bearer fresh",
      "Bearer fresh",
    ]);
    expect(useAuthStore.getState().accessToken).toBe("fresh");
  });

  it("والتجديد يتعذّر (الخادم لا يجيب) ⇒ الطلب يُرسل بلا توكن، والجلسة باقية", async () => {
    signedIn(null);
    answer = (c) => (c.url.endsWith("/auth/refresh") ? "network" : { status: 200 });
    expect(await ensureAccessToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  /**
   * جلسةٌ من قبل الكعكة: توكن التجديد في localStorage. يُستبدل مرّةً — يردّ
   * الخادم بالكعكة — ثمّ يُنسى، فلا يُرسل ثانيةً ولا يبقى حيث يقرؤه سكربت.
   */
  it("وتوكن تجديدٍ قديمٌ من localStorage ⇒ يُرسل في أوّل تجديد وحده، ثمّ يُنسى", async () => {
    localStorage.setItem("auth", JSON.stringify({ state: { user, isAuthenticated: true, refreshToken: "legacy-rt" }, version: 0 }));
    await useAuthStore.persist.rehydrate();
    expect(JSON.parse(localStorage.getItem("auth")!).state).not.toHaveProperty("refreshToken");

    answer = (c) => (c.url.endsWith("/auth/refresh") ? { status: 200, data: { accessToken: "fresh" } } : { status: 200 });
    await client.get("/a");
    useAuthStore.setState({ accessToken: null });
    await client.get("/b");

    expect(refreshes().map((c) => JSON.parse(c.data as string))).toEqual([{ refreshToken: "legacy-rt" }, {}]);
    localStorage.removeItem("auth");
  });

  it("والزائر لا يُجدِّد شيئاً", async () => {
    await client.get("/public/topics");
    expect(refreshes()).toHaveLength(0);
    expect(calls[0]!.auth).toBeUndefined();
  });
});

describe("client — 401 أثناء الجلسة", () => {
  it("يُجدَّد مرّة ويُعاد الطلب نفسه بالتوكن الجديد", async () => {
    signedIn("old");
    let first = true;
    answer = (c) => {
      if (c.url.endsWith("/auth/refresh")) return { status: 200, data: { accessToken: "new" } };
      if (first) {
        first = false;
        return { status: 401 };
      }
      return { status: 200, data: { ok: true } };
    };

    const res = await client.get("/admin/users");

    expect(res.data).toEqual({ ok: true });
    expect(calls.map((c) => `${c.url} ${c.auth ?? ""}`.trim())).toEqual([
      "/admin/users Bearer old",
      "/api/auth/refresh", // axios مباشرةً، بالعنوان كاملاً: لا يمرّ بهذه المعترضات
      "/admin/users Bearer new",
    ]);
  });

  /** طلبٌ أُعيد بعد التجديد فرُفض ثانية: لا تجديد آخر — لا دوّامة. */
  it("ورفضٌ ثانٍ بعد التجديد ⇒ يُرفض، بلا تجديدٍ ثانٍ", async () => {
    signedIn("old");
    answer = (c) => (c.url.endsWith("/auth/refresh") ? { status: 200, data: { accessToken: "new" } } : { status: 401 });
    await expect(client.get("/admin/users")).rejects.toBeInstanceOf(AxiosError);
    expect(refreshes()).toHaveLength(1);
  });

  it("الخادم يرفض التجديد ⇒ خروجٌ وإعلانٌ بانتهاء الجلسة", async () => {
    signedIn("old");
    const ended = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, ended);
    answer = () => ({ status: 401 });
    try {
      await expect(client.get("/admin/users")).rejects.toBeInstanceOf(AxiosError);
      expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, user: null, accessToken: null });
      expect(ended).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(SESSION_EXPIRED_EVENT, ended);
    }
  });

  it("والتجديد يسقط بعطل الخادم (5xx) ⇒ لا خروج", async () => {
    signedIn("old");
    answer = (c) => (c.url.endsWith("/auth/refresh") ? { status: 503 } : { status: 401 });
    await expect(client.get("/admin/users")).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("و401 من مسارات الدخول نفسها ⇒ لا تجديد", async () => {
    signedIn("old");
    answer = () => ({ status: 401 });
    await expect(client.post("/auth/admin/login", {})).rejects.toBeInstanceOf(AxiosError);
    expect(refreshes()).toHaveLength(0);
    expect(calls[0]!.auth).toBe("Bearer old");
  });
});

describe("client — ما يطلبه الخادم قبل المتابعة", () => {
  it.each([
    ["PASSWORD_CHANGE_REQUIRED", { mustChangePassword: true }],
    ["TWO_FACTOR_SETUP_REQUIRED", { twoFactorSetupRequired: true, twoFactorEnabled: false }],
  ])("403 %s ⇒ يُعلَّم الحساب فتُظهر البوّابة شاشته", async (errorCode, flags) => {
    signedIn("t");
    answer = () => ({ status: 403, data: { errorCode } });
    await expect(client.get("/admin/users")).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().user).toMatchObject(flags);
  });

  it("ورسالة الخادم بغير لغة الواجهة ⇒ تُستبدل، والأصل محفوظ", async () => {
    answer = () => ({ status: 404, data: { message: "Specialization not found" } });
    const err = (await client.get("/x").catch((e) => e)) as AxiosError<{ message: string; originalMessage: string }>;
    expect(err.response!.data.originalMessage).toBe("Specialization not found");
    expect(err.response!.data.message).not.toBe("Specialization not found");
  });
});

describe("client — حالة الاتصال", () => {
  it("لا جواب، أو الوكيل يقول إنّ الخادم غائب ⇒ يُفحص الاتصال", async () => {
    answer = () => "network";
    await client.get("/a").catch(() => undefined);
    answer = () => ({ status: 502 });
    await client.get("/b").catch(() => undefined);
    expect(reportUnreachable).toHaveBeenCalledTimes(2);
  });

  it("وطلبٌ أُلغي، أو رفضٌ عاديّ ⇒ لا", async () => {
    answer = () => "cancel";
    await client.get("/a").catch(() => undefined);
    answer = () => ({ status: 400 });
    await client.get("/b").catch(() => undefined);
    expect(reportUnreachable).not.toHaveBeenCalled();
  });

  it("جوابٌ بعد انقطاع ⇒ يُعلَن رجوع الخادم؛ وجوابٌ والاتصال سليم ⇒ لا شيء", async () => {
    await client.get("/a");
    expect(reportServerUp).not.toHaveBeenCalled();
    useConnection.setState({ link: "down" });
    await client.get("/b");
    expect(reportServerUp).toHaveBeenCalledTimes(1);
  });
});
