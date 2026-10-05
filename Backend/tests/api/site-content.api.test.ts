/**
 * آخر الأخبار وكلمة رئيس القسم — ما تحرّره الإدارة ويقرؤه الزائر.
 *
 * والجدولان يبدآن بمحتوى الهجرة، فلا تُفرَّغ هنا: كلّ اختبارٍ يحذف ما أضافه
 * وحده، وكلمة رئيس القسم تُعاد إلى ما كانت عليه.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
let directorBefore: unknown = null;
let aboutBefore: unknown = null;
let loginBefore: unknown = null;

const as = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

const news = (extra: Record<string, unknown> = {}) => ({
  text: `${TAG} خبر`,
  date: "2026-09-01",
  ...extra,
});

const publicNews = async () =>
  (await request(app).get("/api/site/news").expect(200)).body.news as {
    id: string;
    text: string;
    date: string;
    linkUrl: string | null;
  }[];

const director = (over: Record<string, unknown> = {}) => ({
  isVisible: true,
  photoUrl: null,
  ar: {
    sectionTitle: "كلمة عميد الكلية",
    title: "عنوان",
    paragraphs: ["فقرة أولى", "فقرة ثانية"],
    quote: "",
    fullName: "أ.د. اختبار",
    role: "عميد",
    initials: "ع",
  },
  fr: { fullName: "Pr. Test" },
  en: {},
  ...over,
});

beforeAll(async () => {
  await teardown();
  f = await seed(1);
  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  directorBefore =
    (await prisma.siteContent.findUnique({ where: { slug: "director-message" } }))
      ?.value ?? null;
  aboutBefore =
    (await prisma.siteContent.findUnique({ where: { slug: "about-page" } }))?.value ?? null;
  loginBefore =
    (await prisma.siteContent.findUnique({ where: { slug: "login-page" } }))?.value ?? null;
});

afterEach(async () => {
  await prisma.newsItem.deleteMany({ where: { text: { startsWith: TAG } } });
});

afterAll(async () => {
  if (directorBefore)
    await prisma.siteContent.update({
      where: { slug: "director-message" },
      data: { value: directorBefore as object },
    });
  else await prisma.siteContent.deleteMany({ where: { slug: "director-message" } });
  if (aboutBefore)
    await prisma.siteContent.update({
      where: { slug: "about-page" },
      data: { value: aboutBefore as object },
    });
  else await prisma.siteContent.deleteMany({ where: { slug: "about-page" } });
  if (loginBefore)
    await prisma.siteContent.update({
      where: { slug: "login-page" },
      data: { value: loginBefore as object },
    });
  else await prisma.siteContent.deleteMany({ where: { slug: "login-page" } });
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("آخر الأخبار", () => {
  it("يقرؤها الزائر بلا حساب، المنشورة وحدها، والأحدث أوّلاً", async () => {
    const a = await as(request(app).post("/api/admin/news"))
      .send(news({ text: `${TAG} قديم`, date: "2026-09-01" }))
      .expect(201);
    const b = await as(request(app).post("/api/admin/news"))
      .send(news({ text: `${TAG} جديد`, date: "2026-09-20" }))
      .expect(201);
    await as(request(app).post("/api/admin/news"))
      .send(news({ text: `${TAG} مخفيّ`, isActive: false }))
      .expect(201);

    const mine = (await publicNews()).filter((n) => n.text.startsWith(TAG));
    expect(mine.map((n) => n.id)).toEqual([b.body.item.id, a.body.item.id]);
    expect(mine[0].date.slice(0, 10)).toBe("2026-09-20");
  });

  it("تُعدَّل، والترجمة الفارغة تُمسح", async () => {
    const { body } = await as(request(app).post("/api/admin/news"))
      .send(news({ textFr: "Actualité" }))
      .expect(201);
    const res = await as(request(app).patch(`/api/admin/news/${body.item.id}`))
      .send({ textFr: "", date: "2026-10-01" })
      .expect(200);
    expect(res.body.item.textFr).toBeNull();
    expect(res.body.item.text).toBe(`${TAG} خبر`);
    expect(res.body.item.date.slice(0, 10)).toBe("2026-10-01");
  });

  it("تقبل رابطاً داخلياً أو مطلقاً، وتردّ ما سواهما", async () => {
    for (const linkUrl of ["/topics", "https://univ-eloued.dz/x"])
      await as(request(app).post("/api/admin/news")).send(news({ linkUrl })).expect(201);
    for (const linkUrl of ["javascript:alert(1)", "//evil.example", "data:text/html,x", "a b"])
      await as(request(app).post("/api/admin/news")).send(news({ linkUrl })).expect(400);
  });

  it("وتردّ تاريخاً غير صالح ونصّاً فارغاً", async () => {
    await as(request(app).post("/api/admin/news")).send(news({ date: "16 مارس" })).expect(400);
    await as(request(app).post("/api/admin/news")).send(news({ text: "  " })).expect(400);
  });

  it("تُحذف", async () => {
    const { body } = await as(request(app).post("/api/admin/news")).send(news()).expect(201);
    await as(request(app).delete(`/api/admin/news/${body.item.id}`)).expect(200);
    await as(request(app).delete(`/api/admin/news/${body.item.id}`)).expect(404);
  });
});

describe("كلمة رئيس القسم", () => {
  it("تُحفظ كاملةً ويقرؤها الزائر، والترجمة الناقصة تُكمَّل بالفراغ", async () => {
    await as(request(app).put("/api/admin/director-message")).send(director()).expect(200);

    const res = await request(app).get("/api/site/director-message").expect(200);
    expect(res.body.visible).toBe(true);
    expect(res.body.content.ar.sectionTitle).toBe("كلمة عميد الكلية");
    expect(res.body.content.ar.paragraphs).toHaveLength(2);
    expect(res.body.content.fr.fullName).toBe("Pr. Test");
    expect(res.body.content.fr.title).toBe("");
    expect(res.body.content.en.paragraphs).toEqual([]);
  });

  it("والمخفيّة لا يُعاد محتواها للزائر", async () => {
    await as(request(app).put("/api/admin/director-message"))
      .send(director({ isVisible: false }))
      .expect(200);
    const res = await request(app).get("/api/site/director-message").expect(200);
    expect(res.body).toEqual({ visible: false, content: null });
  });

  it("والعربية الناقصة تُردّ، وكذا صورةٌ من خارج الرفع", async () => {
    const base = director();
    await as(request(app).put("/api/admin/director-message"))
      .send({ ...base, ar: { ...base.ar, fullName: "" } })
      .expect(400);
    await as(request(app).put("/api/admin/director-message"))
      .send({ ...base, ar: { ...base.ar, paragraphs: [] } })
      .expect(400);
    await as(request(app).put("/api/admin/director-message"))
      .send(director({ photoUrl: "https://example.com/p.jpg" }))
      .expect(400);
  });
});

describe("صفحة «عن المنصة»", () => {
  const about = (over: Record<string, unknown> = {}) => ({
    ar: {
      title: "عن المنصة",
      subtitle: "",
      introTitle: "ما هي المنصة؟",
      intro: ["فقرة"],
      features: [{ title: "ميزة", desc: "وصف" }],
      stats: [{ value: "+100", label: "طالب" }],
      ...over,
    },
    fr: { title: "À propos" },
    en: {},
  });

  it("تُحفظ ويقرؤها الزائر بلا حساب، والترجمة الناقصة تُكمَّل بالفراغ", async () => {
    await as(request(app).put("/api/admin/about-page")).send(about()).expect(200);
    const res = await request(app).get("/api/site/about-page").expect(200);
    expect(res.body.content.ar.features).toEqual([{ title: "ميزة", desc: "وصف" }]);
    expect(res.body.content.fr.title).toBe("À propos");
    expect(res.body.content.fr.features).toEqual([]);
    expect(res.body.content.en.intro).toEqual([]);
  });

  it("والعربية الناقصة تُردّ — وكذا ميزةٌ بلا عنوان، وأكثر من أربعة أرقام", async () => {
    await as(request(app).put("/api/admin/about-page")).send(about({ title: "" })).expect(400);
    await as(request(app).put("/api/admin/about-page")).send(about({ intro: [] })).expect(400);
    await as(request(app).put("/api/admin/about-page"))
      .send(about({ features: [{ title: "", desc: "x" }] }))
      .expect(400);
    await as(request(app).put("/api/admin/about-page"))
      .send(about({ stats: Array.from({ length: 5 }, () => ({ value: "1", label: "x" })) }))
      .expect(400);
  });
});

describe("لوحة الترحيب في صفحة الدخول", () => {
  const login = (over: Record<string, unknown> = {}) => ({
    ar: {
      university: "جامعة الوادي",
      platform: "منصة مذكرتي",
      welcome: "مرحباً بك في",
      highlight: "",
      body: "",
      note: "",
      ...over,
    },
    fr: { welcome: "Bienvenue sur" },
    en: {},
  });

  it("تُحفظ ويقرؤها الزائر بلا حساب، والترجمة الناقصة تُكمَّل بالفراغ", async () => {
    await as(request(app).put("/api/admin/login-page")).send(login()).expect(200);
    const res = await request(app).get("/api/site/login-page").expect(200);
    expect(res.body.content.ar.welcome).toBe("مرحباً بك في");
    expect(res.body.content.fr.welcome).toBe("Bienvenue sur");
    expect(res.body.content.fr.university).toBe("");
    expect(res.body.content.en.body).toBe("");
  });

  it("والعربية الناقصة تُردّ", async () => {
    await as(request(app).put("/api/admin/login-page")).send(login({ university: "" })).expect(400);
    await as(request(app).put("/api/admin/login-page")).send(login({ welcome: " " })).expect(400);
    await as(request(app).put("/api/admin/login-page"))
      .send(login({ body: "x".repeat(401) }))
      .expect(400);
  });
});
