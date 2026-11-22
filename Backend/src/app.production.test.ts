/**
 * التطبيق كما يعمل في الإنتاج — بإعدادٍ مزيّف، بلا قاعدة.
 *
 * الاختبارات كلّها تبني التطبيق ببيئة الاختبار، فما يخصّ الإنتاج لا يمرّ به
 * أحد: HSTS وترقية الطلبات، وسجلّ الطلبات بلا سلسلة الاستعلام (فيها كلمات
 * بحثٍ ومعرّفات)، والتحذير من وكيلٍ لا يُوثق به، وخدمة الواجهة من الأصل نفسه
 * بسياسة محتوى مكتوبةٍ لها — ببصمة سكربتها المضمَّن، لا بإذنٍ لكلّ سكربت.
 */
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import request from "supertest";

const UPLOADS = path.join(process.cwd(), "uploads");
const PROBE = "__app-production-probe.txt";

function productionApp(): { app: Express; disconnect: () => Promise<void> } {
  let app!: Express;
  let prisma!: { $disconnect: () => Promise<void> };
  jest.isolateModules(() => {
    jest.doMock("./core/config/app.config", () => {
      const actual = jest.requireActual("./core/config/app.config");
      return { ...actual, config: { ...actual.config, IS_PRODUCTION: true, NODE_ENV: "production", TRUST_PROXY_HOPS: 0 } };
    });
    app = require("./app").default;
    prisma = require("./core/prisma/client").prisma;
  });
  return { app, disconnect: () => prisma.$disconnect() };
}

describe("app — في الإنتاج", () => {
  let app: Express;
  let disconnect: () => Promise<void>;

  beforeAll(() => {
    ({ app, disconnect } = productionApp());
    fs.mkdirSync(UPLOADS, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS, PROBE), "probe");
  });
  afterAll(async () => {
    fs.rmSync(path.join(UPLOADS, PROBE), { force: true });
    await disconnect();
  });

  /** طلباتٌ عبر وكيلٍ والتطبيق لا يثق بأيّ وكيل: الحدود كلّها على عنوانه. يُقال مرّة، لا مع كلّ طلب. */
  it("وكيلٌ لا يُوثق به ⇒ تحذيرٌ واحد في السجلّ", async () => {
    // داخل الاختبار: jest.config يعيد كلّ جاسوسٍ قبل كلّ اختبار (restoreMocks).
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await request(app).get("/api/health").set("X-Forwarded-For", "10.0.0.1").expect(200);
    await request(app).get("/api/health").set("X-Forwarded-For", "10.0.0.2").expect(200);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("TRUST_PROXY_HOPS"))).toHaveLength(1);
  });

  it("HSTS وترقية الطلبات غير الآمنة", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.headers["strict-transport-security"]).toBe("max-age=15552000; includeSubDomains");
    expect(res.headers["content-security-policy"]).toContain("upgrade-insecure-requests");
  });

  it("سجلّ الطلبات بالمسار وحده — بلا سلسلة الاستعلام", async () => {
    const out = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      await request(app).get("/api/health?search=202039012345").expect(200);
      const logged = out.mock.calls.map((c) => String(c[0])).join("");
      expect(logged).toContain("GET /api/health 200");
      expect(logged).not.toContain("202039012345");
    } finally {
      out.mockRestore();
    }
  });

  it("الأصل غير المسموح ⇒ 403؛ والمسموح ⇒ يُجاب بترويسته", async () => {
    await request(app).get("/api/health").set("Origin", "https://evil.example").expect(403);
    const ok = await request(app).get("/api/health").set("Origin", "http://localhost:5173").expect(200);
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  /** ملفٌّ مرفوع يُعرض ولا يُنفَّذ: لا تخمين لنوعه، ولا سكربت فيه، ولا إطار. */
  it("الملفّات المرفوعة بترويساتٍ تمنع تنفيذها", async () => {
    const res = await request(app).get(`/uploads/${PROBE}`).expect(200);
    expect(res.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "cross-origin",
    });
  });

  it("الواجهة من الأصل نفسه: صفحتها بسياسةٍ تأذن لسكربتها المضمَّن ببصمته وحده", async () => {
    const res = await request(app).get("/topics/123").expect(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["content-security-policy"]).toMatch(/script-src 'self' 'wasm-unsafe-eval'( 'sha256-[A-Za-z0-9+/=]+')*;/);
    expect(res.headers["content-security-policy"]).not.toContain("unsafe-inline';".replace("';", "' 'self"));
    // WebAssembly (كاشف الوجه) نعم — eval لا.
    expect(res.headers["content-security-policy"]).not.toMatch(/'unsafe-eval'/);
  });

  /**
   * سكربتٌ يُشغَّل عاملاً (قارئ PDF) يعمل بالسياسة التي جاء بها: سياسة الـAPI
   * (`script-src 'none'`) تمنعه من ترجمة WebAssembly التي تفكّ صور الملفات
   * الممسوحة. فسكربتات الواجهة بسياستها هي.
   */
  it("وسكربتات الواجهة بسياستها هي، لا بسياسة الـAPI: العامل يعمل بها", async () => {
    const assets = path.join(__dirname, "../../client/dist/assets");
    const script = fs.readdirSync(assets).find((f) => /\.m?js$/.test(f))!;
    const res = await request(app).get(`/assets/${script}`).expect(200);
    expect(res.headers["content-security-policy"]).toMatch(/script-src 'self' 'wasm-unsafe-eval'/);
    expect(res.headers["content-security-policy"]).toContain("connect-src 'self'");
  });

  /** تفعيل الحساب يصوّر البطاقة والوجه بالكاميرا: صفحة الواجهة تأذن لنفسها بها وحدها، والـAPI لا يأذن لأحد. */
  it("الكاميرا: مسموحةٌ لصفحة الواجهة نفسها، ممنوعةٌ في ردود الـAPI", async () => {
    const page = await request(app).get("/account").expect(200);
    expect(page.headers["permissions-policy"]).toBe("camera=(self), microphone=(), geolocation=(), payment=(), usb=()");
    const api = await request(app).get("/api/health").expect(200);
    expect(api.headers["permissions-policy"]).toContain("camera=()");
  });

  it("ومسارٌ للـAPI لا وجود له ⇒ 404، لا صفحة الواجهة", async () => {
    const shell = fs.readFileSync(path.join(__dirname, "../../client/dist/index.html"), "utf8");
    const res = await request(app).get("/api/no-such-route");
    expect(res.status).toBe(404);
    expect(res.text).not.toBe(shell);
  });

  /**
   * ولا صفحة Express الجاهزة («Cannot GET»): تكشف اسم الإطار، وتضع سياسة
   * أمانٍ أقصر مكان سياسة التطبيق (ما وجده فحص ZAP). بل JSON كأيّ خطأ —
   * بلغة الطلب — وترويسات التطبيق نفسها.
   */
  it("ومسارٌ للـAPI لا وجود له ⇒ JSON كأيّ خطأ، بلغة الطلب، وبترويسات التطبيق", async () => {
    const res = await request(app).get("/api/no-such-route").set("Accept-Language", "en");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toEqual({ message: "This path does not exist.", errorCode: "RESOURCE_NOT_FOUND" });
    expect(res.text).not.toContain("Cannot GET");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["content-security-policy"]).toContain("form-action 'self'");
    // POST too — any method.
    expect((await request(app).post("/api/no-such-route").send({})).body.errorCode).toBe("RESOURCE_NOT_FOUND");
  });
});

describe("app — في الإنتاج بلا واجهةٍ مبنيّة", () => {
  /** لم تُبنَ الواجهة بعد: السياسة بلا بصمات، ولا يسقط التطبيق عند بنائه. */
  it("السياسة تُكتب بلا بصمة سكربت", async () => {
    const read = fs.readFileSync;
    const spy = jest.spyOn(fs, "readFileSync").mockImplementation(((file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
      if (String(file).endsWith("index.html")) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return (read as (...a: unknown[]) => unknown)(file, ...rest);
    }) as typeof fs.readFileSync);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    let built: ReturnType<typeof productionApp>;
    try {
      built = productionApp();
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
    try {
      const res = await request(built.app).get("/topics");
      expect(res.headers["content-security-policy"]).toContain("script-src 'self' 'wasm-unsafe-eval';");
    } finally {
      await built.disconnect();
    }
  });
});
