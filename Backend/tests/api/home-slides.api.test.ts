/**
 * صور الصفحة الرئيسية — من رفع الإدارة إلى عين الزائر.
 *
 * ثلاثة أسئلة تحكم الميزة:
 *
 *   **هل يراها الزائر بلا حساب؟** — الصفحة الرئيسية تُفتح قبل تسجيل الدخول،
 *   ومسارٌ محروس هناك يعني واجهةً فارغة لكلّ من لم يدخل بعد.
 *
 *   **وهل يرى ما اختارته الإدارة فقط؟** — المعطَّلة لا تُعاد، والترتيب ترتيبها.
 *
 *   **وهل الكتابة للإدارة وحدها؟** — مكنوسٌ في `route-guards`، ويُثبَت هنا
 *   مرّةً صريحة لأنّ المسار العامّ يجاور مسارات الكتابة في الاسم.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { MAX_HOME_SLIDES } from "../../src/modules/site/site.service";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
let studentToken = "";

const as = (r: request.Test, token = adminToken) =>
  r.set("Authorization", `Bearer ${token}`);

const img = (n: number) => `/uploads/cards/slide-test-${n}.jpg`;

async function create(n: number, extra: Record<string, unknown> = {}) {
  const res = await as(request(app).post("/api/admin/home-slides"))
    .send({ imageUrl: img(n), ...extra })
    .expect(201);
  return res.body.slide as { id: string; sortOrder: number };
}

const publicSlides = async () =>
  (await request(app).get("/api/site/home-slides").expect(200)).body
    .slides as { id: string; imageUrl: string; caption: string | null }[];

beforeAll(async () => {
  await teardown();
  // الجدول لا يرتبط بشيءٍ في البذرة، فيُفرَّغ هنا لا في `teardown`.
  await prisma.homeSlide.deleteMany();
  f = await seed(1);
  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  studentToken = (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[0].reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterEach(async () => {
  await prisma.homeSlide.deleteMany();
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("للزائر", () => {
  it("يقرأ بلا تسجيل دخول — والقائمة الفارغة ليست خطأً", async () => {
    expect(await publicSlides()).toEqual([]);
  });

  it("يرى المفعَّلة وحدها، بترتيب الإضافة، وبما يُعرض فقط", async () => {
    await create(1, { caption: "حفل التخرّج" });
    await create(2, { isActive: false });
    await create(3);

    const slides = await publicSlides();
    expect(slides.map((s) => s.imageUrl)).toEqual([img(1), img(3)]);
    expect(slides[0].caption).toBe("حفل التخرّج");
    expect(Object.keys(slides[0]).sort()).toEqual(["caption", "id", "imageUrl"]);
  });
});

describe("للإدارة", () => {
  it("ترى المعطَّلة أيضاً في قائمتها", async () => {
    await create(1, { isActive: false });
    const res = await as(request(app).get("/api/admin/home-slides")).expect(200);
    expect(res.body.slides).toHaveLength(1);
    expect(res.body.slides[0].isActive).toBe(false);
  });

  it("تعطيلُ صورةٍ لا يمسح سطرها", async () => {
    const s = await create(1, { caption: "المكتبة" });
    const res = await as(request(app).patch(`/api/admin/home-slides/${s.id}`))
      .send({ isActive: false })
      .expect(200);
    expect(res.body.slide.caption).toBe("المكتبة");
    expect(await publicSlides()).toEqual([]);
  });

  it("والسطر الفارغ يمسحه", async () => {
    const s = await create(1, { caption: "المكتبة" });
    const res = await as(request(app).patch(`/api/admin/home-slides/${s.id}`))
      .send({ caption: "  " })
      .expect(200);
    expect(res.body.slide.caption).toBeNull();
  });

  it("تُعيد الترتيب، فيتبعه الزائر", async () => {
    const a = await create(1);
    const b = await create(2);
    const c = await create(3);

    await as(request(app).patch("/api/admin/home-slides/order"))
      .send({ ids: [c.id, a.id, b.id] })
      .expect(200);

    expect((await publicSlides()).map((s) => s.id)).toEqual([c.id, a.id, b.id]);
  });

  it("وتردّ ترتيباً لا يشمل كلّ الصور", async () => {
    const a = await create(1);
    await create(2);
    await as(request(app).patch("/api/admin/home-slides/order"))
      .send({ ids: [a.id] })
      .expect(400);
  });

  it("وتردّ صورةً من خارج الرفع", async () => {
    for (const imageUrl of [
      "https://example.com/x.jpg",
      "javascript:alert(1)",
      "/uploads/../.env",
    ])
      await as(request(app).post("/api/admin/home-slides"))
        .send({ imageUrl })
        .expect(400);
  });

  it(`ولا تتجاوز ${MAX_HOME_SLIDES} صورة`, async () => {
    await prisma.homeSlide.createMany({
      data: Array.from({ length: MAX_HOME_SLIDES }, (_, i) => ({
        imageUrl: img(i),
        sortOrder: i,
      })),
    });
    await as(request(app).post("/api/admin/home-slides"))
      .send({ imageUrl: img(99) })
      .expect(400);
  });

  it("تضيف عدّة صورٍ دفعةً واحدة، بترتيب اختيارها وبعد ما سبقها", async () => {
    await create(1);
    const res = await as(request(app).post("/api/admin/home-slides/batch"))
      .send({
        slides: [
          { imageUrl: img(2), caption: "الثانية" },
          { imageUrl: img(3) },
          { imageUrl: img(4), caption: "" },
        ],
      })
      .expect(201);

    expect(res.body.slides).toHaveLength(3);
    expect(res.body.slides.map((s: { caption: string | null }) => s.caption)).toEqual([
      "الثانية",
      null,
      null,
    ]);
    expect((await publicSlides()).map((s) => s.imageUrl)).toEqual([
      img(1),
      img(2),
      img(3),
      img(4),
    ]);
  });

  it("والدفعة التي تتجاوز السقف تُردّ كلّها، لا نصفها", async () => {
    await prisma.homeSlide.createMany({
      data: Array.from({ length: MAX_HOME_SLIDES - 2 }, (_, i) => ({
        imageUrl: img(i),
        sortOrder: i,
      })),
    });
    await as(request(app).post("/api/admin/home-slides/batch"))
      .send({ slides: [1, 2, 3].map((n) => ({ imageUrl: img(100 + n) })) })
      .expect(400);
    expect(await prisma.homeSlide.count()).toBe(MAX_HOME_SLIDES - 2);
  });

  it("وتُضاف المخفيّة دفعةً دون أن تظهر للزائر", async () => {
    await as(request(app).post("/api/admin/home-slides/batch"))
      .send({ slides: [{ imageUrl: img(1) }, { imageUrl: img(2) }], isActive: false })
      .expect(201);
    expect(await publicSlides()).toEqual([]);
  });

  it("صور «عن المنصة» في موضعها: لا تختلط بالرئيسية في القائمة ولا الترتيب ولا السقف", async () => {
    await prisma.homeSlide.createMany({
      data: Array.from({ length: MAX_HOME_SLIDES }, (_, i) => ({
        imageUrl: img(i),
        sortOrder: i,
      })),
    });
    // الرئيسية ممتلئة، و«عن المنصة» لها سقفها الخاصّ.
    const res = await as(request(app).post("/api/admin/home-slides/batch"))
      .send({ placement: "about", slides: [{ imageUrl: img(50) }, { imageUrl: img(51) }] })
      .expect(201);
    expect(res.body.slides.map((s: { sortOrder: number }) => s.sortOrder)).toEqual([0, 1]);

    const about = (await request(app).get("/api/site/home-slides?placement=about").expect(200))
      .body.slides as { id: string; imageUrl: string }[];
    expect(about.map((s) => s.imageUrl)).toEqual([img(50), img(51)]);
    expect((await publicSlides()).every((s) => !about.some((a) => a.id === s.id))).toBe(true);

    // ترتيبٌ يخلط موضعين يُردّ.
    const home = (await as(request(app).get("/api/admin/home-slides")).expect(200)).body.slides;
    await as(request(app).patch("/api/admin/home-slides/order"))
      .send({ placement: "about", ids: [about[1].id, home[0].id] })
      .expect(400);
    await as(request(app).patch("/api/admin/home-slides/order"))
      .send({ placement: "about", ids: [about[1].id, about[0].id] })
      .expect(200);
  });

  it("وخلفيّتا صفحة الدخول ورأس «عن المنصة» موضعان مستقلّان", async () => {
    await create(1);
    await as(request(app).post("/api/admin/home-slides"))
      .send({ placement: "login", imageUrl: img(70) })
      .expect(201);

    const login = (await request(app).get("/api/site/home-slides?placement=login").expect(200))
      .body.slides as { imageUrl: string }[];
    expect(login.map((s) => s.imageUrl)).toEqual([img(70)]);
    expect((await publicSlides()).map((s) => s.imageUrl)).toEqual([img(1)]);

    // وخلفية رأس «عن المنصة» موضعٌ آخر، لا يختلط بمعرضها.
    await as(request(app).post("/api/admin/home-slides"))
      .send({ placement: "aboutHero", imageUrl: img(71) })
      .expect(201);
    const hero = (await request(app).get("/api/site/home-slides?placement=aboutHero").expect(200))
      .body.slides as { imageUrl: string }[];
    expect(hero.map((s) => s.imageUrl)).toEqual([img(71)]);
    expect((await request(app).get("/api/site/home-slides?placement=about").expect(200)).body.slides).toEqual([]);

    // وموضعٌ لا يُعرف يُردّ.
    await request(app).get("/api/site/home-slides?placement=nowhere").expect(400);
  });

  it("تحذف، والمحذوفة ليست موجودة", async () => {
    const s = await create(1);
    await as(request(app).delete(`/api/admin/home-slides/${s.id}`)).expect(200);
    await as(request(app).delete(`/api/admin/home-slides/${s.id}`)).expect(404);
  });

  it("والكتابة ليست للطالب", async () => {
    await as(request(app).post("/api/admin/home-slides"), studentToken)
      .send({ imageUrl: img(1) })
      .expect(403);
  });
});
