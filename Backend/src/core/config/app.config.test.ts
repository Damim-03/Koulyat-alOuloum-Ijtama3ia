/**
 * إعداد التطبيق — ما يُقرَّر لحظة تحميله، بكلّ بيئة.
 *
 * الاختبارات كلّها تعمل بـ`.env.test`، فلا يرى أحدٌ إلا فرعاً واحداً: بيئة
 * التطوير بأسرارٍ سليمة. وهنا يُحمَّل الإعداد معزولاً ببيئاتٍ أخرى:
 *
 *   **الإنتاج يرفض أن يبدأ** بسرٍّ غائب أو قصير أو معروف، أو بسرَّين
 *   متطابقين، أو بلا قاعدة، أو بلا أصلٍ مسموح — ويسمّي كلّ مشكلة.
 *
 *   **والتطوير يعمل ويحذّر** بالمشكلات نفسها، وسرٌّ غائبٌ فيه عشوائيٌّ لكلّ
 *   تشغيل، لا قيمةٌ ثابتة يعرفها كلّ من قرأ المستودع.
 */
type Env = Record<string, string | undefined>;

const STRONG_A = "a".repeat(20) + "b".repeat(20);
const STRONG_B = "c".repeat(20) + "d".repeat(20);
const STRONG_C = "e".repeat(20) + "f".repeat(20);

/** يحمّل `app.config` ببيئةٍ معدَّلة، ويعيد البيئة كما كانت. `undefined` يحذف المتغيّر. */
function load(env: Env) {
  const saved = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const exit = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  try {
    let mod!: typeof import("./app.config");
    jest.isolateModules(() => {
      mod = require("./app.config");
    });
    const lines = (m: jest.SpyInstance) => m.mock.calls.map((c) => c.join(" ")).join("\n");
    return { ...mod, errors: lines(error), warnings: lines(warn), exited: exit.mock.calls.map((c) => c[0]) };
  } finally {
    error.mockRestore();
    warn.mockRestore();
    exit.mockRestore();
    process.env = saved;
  }
}

const production: Env = {
  NODE_ENV: "production",
  JWT_ACCESS_SECRET: STRONG_A,
  JWT_REFRESH_SECRET: STRONG_B,
  SESSION_SECRET: STRONG_C,
  DATABASE_URL: "mysql://u:p@db:3306/app",
  FRONTEND_ORIGIN: "https://memoires.univ-eloued.dz",
  CORS_ORIGINS: undefined,
};

describe("app.config — الإنتاج", () => {
  it("إعدادٌ سليم ⇒ يبدأ، والأصل المسموح ما سُمّي وحده", () => {
    const c = load(production);
    expect(c.exited).toEqual([]);
    expect(c.config.CORS_ORIGINS).toEqual(["https://memoires.univ-eloued.dz"]);
    expect(c.isAllowedOrigin("https://memoires.univ-eloued.dz")).toBe(true);
    expect(c.isAllowedOrigin("http://localhost:5173")).toBe(false);
  });

  it("سرٌّ غائب وآخر معروف وثالثٌ قصير، وبلا قاعدة ولا أصل ⇒ يرفض أن يبدأ ويسمّي كلّاً منها", () => {
    const c = load({
      ...production,
      JWT_ACCESS_SECRET: "  ",
      JWT_REFRESH_SECRET: "changeme",
      SESSION_SECRET: "short",
      DATABASE_URL: undefined,
      FRONTEND_ORIGIN: undefined,
    });
    expect(c.exited).toEqual([1]);
    expect(c.errors).toContain("FATAL");
    expect(c.errors).toContain("JWT_ACCESS_SECRET is not set");
    expect(c.errors).toContain("JWT_REFRESH_SECRET is set to a known placeholder value");
    expect(c.errors).toContain("SESSION_SECRET is shorter than 32 characters (5)");
    expect(c.errors).toContain("DATABASE_URL is not set");
    expect(c.errors).toContain("FRONTEND_ORIGIN (or CORS_ORIGINS) is not set");
    expect(c.errors).toContain("Generate a strong secret with");
    // والسرّ لا يُطبع في أيّ سطر.
    expect(c.errors).not.toContain("changeme");
  });

  /** سرّا التوكنين متطابقان ⇒ توكن التجديد يُقبل توكنَ دخول — يُرفض. وبلا مشكلة سرٍّ لا يُقترح توليد سرّ. */
  it("سرّان متطابقان ⇒ يُرفض؛ وأصلٌ ليس http(s) وحده ⇒ يُرفض بلا اقتراح سرّ", () => {
    expect(load({ ...production, JWT_REFRESH_SECRET: STRONG_A }).errors).toContain(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ",
    );
    const origin = load({ ...production, FRONTEND_ORIGIN: "ftp://memoires.univ-eloued.dz" });
    expect(origin.exited).toEqual([1]);
    expect(origin.errors).toContain('"ftp://memoires.univ-eloued.dz" in FRONTEND_ORIGIN/CORS_ORIGINS is not an http(s) address');
    expect(origin.errors).not.toContain("Generate a strong secret");
  });
});

describe("app.config — التطوير", () => {
  const development: Env = { ...production, NODE_ENV: "development", DATABASE_URL: undefined };

  it("سرٌّ غائب ⇒ عشوائيٌّ لكلّ تشغيل، ويُحذَّر ولا يتوقّف", () => {
    const a = load({ ...development, JWT_ACCESS_SECRET: undefined });
    const b = load({ ...development, JWT_ACCESS_SECRET: undefined });
    expect(a.exited).toEqual([]);
    expect(a.config.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(a.config.JWT_ACCESS_SECRET).not.toBe(b.config.JWT_ACCESS_SECRET);
    expect(load({ ...development, SESSION_SECRET: "short" }).warnings).toContain("SESSION_SECRET is shorter than 32");
  });

  it("CORS_ORIGINS يغلب FRONTEND_ORIGIN؛ وبلا أيّهما ⇒ واجهة التطوير المحلّية", () => {
    expect(load({ ...development, CORS_ORIGINS: "https://a.dz, https://b.dz" }).config.CORS_ORIGINS).toEqual(
      expect.arrayContaining(["https://a.dz", "https://b.dz", "http://localhost:5173"]),
    );
    expect(load({ ...development, FRONTEND_ORIGIN: undefined }).config.CORS_ORIGINS[0]).toBe("http://localhost:5173");
  });

  it("المنفذ: غائب أو ليس رقماً ⇒ 3000؛ ورقمٌ صحيح ⇒ هو", () => {
    expect(load({ ...development, PORT: undefined }).config.PORT).toBe(3000);
    expect(load({ ...development, PORT: "abc" }).config.PORT).toBe(3000);
    expect(load({ ...development, PORT: "4000" }).config.PORT).toBe(4000);
  });

  it("مدد جلسة المسؤول: غائبة ⇒ الافتراضية؛ وليست عدداً موجباً ⇒ الافتراضية ويُحذَّر", () => {
    const c = load({ ...development, ADMIN_SESSION_HOURS: "0", ADMIN_IDLE_MINUTES: "45" });
    expect([c.config.ADMIN_SESSION_HOURS, c.config.ADMIN_IDLE_MINUTES]).toEqual([8, 45]);
    expect(c.warnings).toContain('ADMIN_SESSION_HOURS must be a positive number (got "0")');
    expect(load({ ...development, ADMIN_SESSION_HOURS: undefined }).config.ADMIN_SESSION_HOURS).toBe(8);

    // وفي الإنتاج مشكلةٌ كغيرها: لا يبدأ بمدّةٍ لم يقصدها أحد.
    expect(load({ ...production, ADMIN_IDLE_MINUTES: "-5" }).exited).toEqual([1]);
  });

  it("الكعكة والتحقّق بخطوتين بكلّ قيمة", () => {
    const secure = (v?: string) => load({ ...development, AUTH_COOKIE_SECURE: v }).config.AUTH_COOKIE_SECURE;
    expect([secure("true"), secure("FALSE"), secure("maybe"), secure(undefined)]).toEqual([true, false, "auto", "auto"]);

    const site = (v?: string) => load({ ...development, AUTH_COOKIE_SAMESITE: v }).config.AUTH_COOKIE_SAMESITE;
    expect([site("Strict"), site("none"), site("bogus"), site(undefined)]).toEqual(["strict", "none", "lax", "lax"]);

    const twoFactor = (v?: string) => load({ ...development, REQUIRE_ADMIN_2FA: v }).config.REQUIRE_ADMIN_2FA;
    expect([twoFactor(undefined), twoFactor(" false "), twoFactor("true")]).toEqual([true, false, true]);
  });
});
