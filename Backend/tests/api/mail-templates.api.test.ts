/**
 * «واجهة الموقع ← رسائل البريد» (core/mail/mail-templates).
 *
 * ما يُحرس:
 *
 *   ١. **ما تكتبه الإدارة هو ما يصل**: الموضوع والنصوص بكلّ لغة، ولونا الرأس
 *      والزرّ، والختم — في الرسائل الحقيقية؛ وما لم تكتبه يبقى نصّ المنصة،
 *      ولغةٌ لم تُكتب تبقى على نصّها.
 *   ٢. **وما لا تملكه**: لا قيمة غير قيم النصّ (`{{password}}` تُرفض)، ولا
 *      مفتاح غريب، ولا سطرٌ ثانٍ في الموضوع، ولا شيفرة — ما يُكتب يُهرَّب.
 *   ٣. **المعاينة لا تحفظ، والتجربة لا تذهب إلّا إلى بريد المسؤول المؤكَّد.**
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { tr } from "../../src/core/i18n";
import { outbox } from "../../src/core/mail/mailer";
import fs from "node:fs";
import path from "node:path";
import { MAIL_SLUG } from "../../src/core/mail/mail-templates";
import { MAIL_FACULTY_PNG } from "../../src/core/mail/logo";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
let studentToken = "";
let before: unknown = null;
type S = { id: string; userId: string; reg: string; email: string };
let A: S;

const as = (r: request.Test, token = adminToken) => r.set("Authorization", `Bearer ${token}`);
const put = (body: unknown) => as(request(app).put("/api/admin/mail-templates")).send(body);
const look = { header: "#123456", accent: "#e8c547", universityLogo: "platform", facultyLogo: "platform" };
const blank = { ar: {}, en: {}, fr: {}, look: { header: "#26423d", accent: "#c1965a", universityLogo: null, facultyLogo: null } };

/** A logo uploaded the way the editor does it — in the site's own uploads. */
const CARDS = path.join(process.cwd(), "uploads", "cards");
const LOGO_FILE = `${TAG}-mail-logo.png`;
const NOT_IMAGE = `${TAG}-mail-logo.txt.png`;

/** The audit trail is written just after the answer: wait for it to settle. */
const settled = () => new Promise((r) => setTimeout(r, 150));

async function mailWhere(pred: (m: (typeof outbox)[number]) => boolean) {
  for (let i = 0; i < 50 && !outbox.some(pred); i++) await new Promise((r) => setTimeout(r, 20));
  return outbox.find(pred);
}

beforeAll(async () => {
  await teardown();
  f = await seed(2);
  [A] = f.nextStudents(1) as S[];
  await prisma.user.update({ where: { id: A.userId }, data: { verifiedEmail: A.email } });
  before = (await prisma.siteContent.findUnique({ where: { slug: MAIL_SLUG } }))?.value ?? null;
  await prisma.siteContent.deleteMany({ where: { slug: MAIL_SLUG } });
  adminToken = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
  studentToken = (
    await request(app).post("/api/auth/student/login").send({ registrationNumber: A.reg, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
});

beforeEach(async () => {
  outbox.length = 0;
  await prisma.emailToken.deleteMany({ where: { user: { firstName: TAG } } });
});

beforeAll(() => {
  fs.mkdirSync(CARDS, { recursive: true });
  fs.writeFileSync(path.join(CARDS, LOGO_FILE), MAIL_FACULTY_PNG);
  fs.writeFileSync(path.join(CARDS, NOT_IMAGE), "not a picture");
});

afterAll(async () => {
  for (const f of [LOGO_FILE, NOT_IMAGE]) fs.rmSync(path.join(CARDS, f), { force: true });
  if (before) await prisma.siteContent.upsert({ where: { slug: MAIL_SLUG }, create: { slug: MAIL_SLUG, value: before as object }, update: { value: before as object } });
  else await prisma.siteContent.deleteMany({ where: { slug: MAIL_SLUG } });
  await prisma.emailToken.deleteMany({ where: { user: { firstName: TAG } } });
  await prisma.auditLog.deleteMany({ where: { actorLabel: { contains: TAG } } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("القراءة", () => {
  it("لا شيء محفوظ ⇒ نصوص المنصة بكلّ لغة، وقيم كلّ نصّ، ولا بريد تجربة لمسؤولٍ لم يؤكّد بريده", async () => {
    const r = await as(request(app).get("/api/admin/mail-templates")).expect(200);
    expect(r.body.templates).toBeNull();
    expect(r.body.defaults.ar["mail.reset.subject"]).toBe(tr("mail.reset.subject", undefined, "ar"));
    expect(r.body.defaults.fr["mail.reset.intro"]).toBe(tr("mail.reset.intro", undefined, "fr"));
    expect(r.body.fields["mail.reset.intro"]).toEqual({ vars: ["account"], oneLine: false, max: 700 });
    expect(r.body.fields["mail.reset.subject"]).toMatchObject({ vars: [], oneLine: true });
    expect(r.body.fields["mail.passwordChanged.intro"].vars.sort()).toEqual(["account", "when"]);
    expect(Object.keys(r.body.groups)).toEqual(["common", "reset", "verify", "passwordChanged", "newDevice"]);
    expect(r.body.testTo).toBeNull();
  });

  it("لغير المسؤول: ممنوع", async () => {
    await as(request(app).get("/api/admin/mail-templates"), studentToken).expect(403);
    await as(request(app).put("/api/admin/mail-templates"), studentToken).send(blank).expect(403);
  });
});

describe("الحفظ يُرفض", () => {
  it("قيمةٌ ليست من قيم النصّ", async () => {
    const r = await put({ ...blank, ar: { "mail.reset.intro": "كلمة مرورك {{password}}" } }).expect(400);
    expect(r.body.message).toContain("{{password}}");
    expect(r.body.message).toContain("{{account}}");
  });

  it("قيمةٌ في نصٍّ لا يأخذ قيماً", async () => {
    const r = await put({ ...blank, en: { "mail.reset.title": "Hello {{account}}" } }).expect(400);
    expect(r.body.message).toContain(tr("mailTemplates.noVars", { name: "{{account}}" }));
  });

  it("مفتاحٌ غريب، وسطرٌ ثانٍ في الموضوع، ولونٌ غير صالح", async () => {
    expect((await put({ ...blank, ar: { "auth.resetSent": "x" } }).expect(400)).body.message).toContain("auth.resetSent");
    expect((await put({ ...blank, ar: { "mail.reset.subject": "سطر\nوآخر" } }).expect(400)).body.message).toContain(
      tr("mailTemplates.oneLine"),
    );
    await put({ ...blank, look: { ...look, header: "red" } }).expect(400);
    expect(await prisma.siteContent.findUnique({ where: { slug: MAIL_SLUG } })).toBeNull();
  });
});

describe("ما يُحفظ يصل", () => {
  it("الموضوع والنصّ واللونان والختم في رسالة الاستعادة؛ والفارغ يعود إلى نصّ المنصة؛ والشيفرة نصّ", async () => {
    const saved = await put({
      ...blank,
      ar: {
        "mail.reset.subject": "  رابط كلمة المرور الجديدة  ",
        "mail.reset.intro": "مرحباً {{ account }} <b>اضغط</b>\nثمّ اختر كلمتك.",
        "mail.reset.action": "",
      },
      look,
    }).expect(200);
    expect(saved.body.templates.ar).toEqual({
      "mail.reset.subject": "رابط كلمة المرور الجديدة",
      "mail.reset.intro": "مرحباً {{account}} <b>اضغط</b>\nثمّ اختر كلمتك.",
    });
    expect(saved.body.templates.look).toEqual(look);

    await request(app).post("/api/auth/password/forgot").send({ identifier: A.reg }).expect(200);
    const mail = await mailWhere((m) => m.to === A.email);
    expect(mail!.subject).toBe("رابط كلمة المرور الجديدة");
    expect(mail!.text).toContain(`مرحباً `);
    expect(mail!.text).toContain(A.reg);
    // The button keeps the platform's words, and its link is the server's.
    expect(mail!.text).toContain(tr("mail.reset.action", undefined, "ar"));
    expect(mail!.text).toMatch(/\/reset-password\?token=[A-Za-z0-9_-]{43}/);
    expect(mail!.html).toContain("background:#123456");
    expect(mail!.html).toContain("background:#e8c547");
    expect(mail!.html).toContain("&lt;b&gt;اضغط&lt;/b&gt;<br>");
    expect(mail!.html).not.toContain("<b>");
    expect(mail!.html).toContain('src="cid:seal@mudhakkirati"');
    expect(mail!.attachments?.[0]).toMatchObject({ cid: "seal@mudhakkirati", contentType: "image/png" });
  });

  it("لغةٌ لم تُكتب تبقى على نصّ المنصة", async () => {
    await request(app).post("/api/auth/password/forgot").set("Accept-Language", "fr").send({ identifier: A.reg }).expect(200);
    const mail = await mailWhere((m) => m.to === A.email);
    expect(mail!.subject).toBe(tr("mail.reset.subject", undefined, "fr"));
  });

  it("السجلّ يحفظ ما تغيّر، حقلاً حقلاً", async () => {
    await settled();
    const from = new Date();
    await put({ ...blank, ar: { "mail.verify.title": "أكّد بريدك" } }).expect(200);
    await settled();
    const row = await prisma.auditLog.findFirst({
      where: { action: "PUT /mail-templates", targetType: "mail-templates", createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
    });
    expect(row).not.toBeNull();
    expect(JSON.stringify(row!.details)).toContain("ar.mail.verify.title");
    // What changed, and what was saved — not the editor's lists.
    expect(JSON.stringify(row!.details)).not.toContain("fields.");
  });
});

describe("المعاينة والتجربة", () => {
  const draft = { ...blank, ar: { "mail.newDevice.subject": "دخولٌ جديد — انتبه" }, look };

  it("المعاينة ترسم ما يُكتب بقيمٍ مثالية، ولا تحفظ، ولا تُسجَّل", async () => {
    await settled();
    const stored = JSON.stringify((await prisma.siteContent.findUnique({ where: { slug: MAIL_SLUG } }))?.value ?? null);
    const logs = await prisma.auditLog.count({ where: { targetType: "mail-templates" } });
    const r = await as(request(app).post("/api/admin/mail-templates/preview"))
      .send({ templates: draft, kind: "newDevice", lang: "ar" })
      .expect(200);
    expect(r.body.subject).toBe("دخولٌ جديد — انتبه");
    expect(r.body.html).toContain("192.0.2.10");
    expect(r.body.html).toContain("data:image/png;base64,");
    expect(JSON.stringify((await prisma.siteContent.findUnique({ where: { slug: MAIL_SLUG } }))?.value ?? null)).toBe(stored);
    await settled();
    expect(await prisma.auditLog.count({ where: { targetType: "mail-templates" } })).toBe(logs);
  });

  it("بلا تغيير ⇒ الشكل الأصليّ نفسه: كتابةٌ داكنة على الزرّ الذهبيّ، وفاتحة على الرأس الأخضر، ولا ختم", async () => {
    const r = await as(request(app).post("/api/admin/mail-templates/preview"))
      .send({ templates: blank, kind: "reset", lang: "ar" })
      .expect(200);
    expect(r.body.html).toContain("background:#26423d");
    expect(r.body.html).toContain("color:#f5edda;\">" + tr("mail.brand", undefined, "ar"));
    expect(r.body.html).toContain("color:#1a312d;text-decoration:none");
    expect(r.body.html).not.toContain("<img");
  });

  it("«تغيّرت كلمة المرور» كما تصل حين تغيّرها الإدارة", async () => {
    const r = await as(request(app).post("/api/admin/mail-templates/preview"))
      .send({ templates: blank, kind: "passwordChanged", lang: "en", byAdmin: true })
      .expect(200);
    expect(r.body.html).toContain("The administration reset the password");
  });

  it("معاينةٌ بقيمةٍ غريبة تُرفض كالحفظ", async () => {
    await as(request(app).post("/api/admin/mail-templates/preview"))
      .send({ templates: { ...blank, ar: { "mail.reset.intro": "{{token}}" } }, kind: "reset", lang: "ar" })
      .expect(400);
  });

  it("التجربة: لا بريد مؤكَّد ⇒ تُرفض؛ ثمّ تذهب إلى بريد المسؤول وحده، معلَّمةً ومعها الختم", async () => {
    const send = () => as(request(app).post("/api/admin/mail-templates/test")).send({ templates: draft, kind: "newDevice", lang: "ar" });
    expect((await send().expect(400)).body.message).toBe(tr("mailTemplates.noTestAddress"));
    expect(outbox).toHaveLength(0);

    await prisma.user.update({ where: { id: f.admin.id }, data: { verifiedEmail: f.admin.email } });
    try {
      const r = await send().expect(200);
      expect(r.body.to).toBe(f.admin.email);
      expect(outbox).toHaveLength(1);
      expect(outbox[0]!.to).toBe(f.admin.email);
      expect(outbox[0]!.subject).toBe(`${tr("mailTemplates.testPrefix")} دخولٌ جديد — انتبه`);
      expect(outbox[0]!.attachments).toHaveLength(2);
    } finally {
      await prisma.user.update({ where: { id: f.admin.id }, data: { verifiedEmail: null } });
    }
  });
});

describe("الشعاران", () => {
  it("شعار الكلّية صورةٌ مرفوعة ⇒ ترافق الرسالة من القرص، في الطرف الآخر من الرأس", async () => {
    const own = `/uploads/cards/${LOGO_FILE}`;
    await put({ ...blank, look: { ...blank.look, universityLogo: "platform", facultyLogo: own } }).expect(200);
    await request(app).post("/api/auth/password/forgot").send({ identifier: A.reg }).expect(200);
    const mail = await mailWhere((m) => m.to === A.email);
    expect(mail!.html).toContain('src="cid:seal@mudhakkirati"');
    expect(mail!.html).toContain('src="cid:faculty@mudhakkirati"');
    // RTL: the faculty's at the band's left end.
    expect(mail!.html).toMatch(/<td align="left"[^>]*><img src="cid:faculty@mudhakkirati"/);
    const faculty = mail!.attachments!.find((a) => a.cid === "faculty@mudhakkirati")!;
    expect(faculty.contentType).toBe("image/png");
    // The test transport hands the bytes back as base64.
    const bytes = Buffer.isBuffer(faculty.content) ? faculty.content : Buffer.from(String(faculty.content), "base64");
    expect(Buffer.compare(bytes, MAIL_FACULTY_PNG)).toBe(0);
  });

  it("المعاينة ترسم الشعارين في الصفحة نفسها", async () => {
    const r = await as(request(app).post("/api/admin/mail-templates/preview"))
      .send({ templates: { ...blank, look: { ...blank.look, facultyLogo: "platform" } }, kind: "verify", lang: "fr" })
      .expect(200);
    expect(r.body.html.match(/data:image\/png;base64,/g)).toHaveLength(1);
    expect(r.body.html).toMatch(/<td align="right"[^>]*><img src="data:image\/png/);
  });

  it("ما لا يصلح شعاراً يُرفض: صورةٌ غائبة، أو ليست صورة، أو من خارج الموقع، أو تصعد خارج مجلّدها", async () => {
    const bad = [
      `/uploads/cards/${TAG}-gone.png`,
      `/uploads/cards/${NOT_IMAGE}`,
      "https://example.com/logo.png",
      "/uploads/cards/../../.env",
      "data:image/png;base64,AAAA",
    ];
    for (const facultyLogo of bad) {
      const r = await put({ ...blank, look: { ...blank.look, facultyLogo } }).expect(400);
      expect(r.body.message).toContain(tr("mailTemplates.logoFile"));
    }
  });

  it("صفٌّ حُفظ قبل الشعارين (`logo`) يُقرأ: الختم = شعار الجامعة", async () => {
    await prisma.siteContent.upsert({
      where: { slug: MAIL_SLUG },
      create: { slug: MAIL_SLUG, value: { ar: {}, en: {}, fr: {}, look: { header: "#26423d", accent: "#c1965a", logo: true } } },
      update: { value: { ar: {}, en: {}, fr: {}, look: { header: "#26423d", accent: "#c1965a", logo: true } } },
    });
    const r = await as(request(app).get("/api/admin/mail-templates")).expect(200);
    expect(r.body.templates.look).toEqual({ header: "#26423d", accent: "#c1965a", universityLogo: "platform", facultyLogo: null });
  });
});
