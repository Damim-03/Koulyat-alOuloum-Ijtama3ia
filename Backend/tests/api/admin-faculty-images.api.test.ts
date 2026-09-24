/**
 * صورة الكلّية وشعارها — الدورة كاملةً.
 *
 * الرفع مُختبَرٌ في `admin-uploads`، والحفظ لم يكن مُختبَراً قطّ: لا شيء
 * يثبت أن الرابط المُعاد يصل إلى الصفّ، ولا أن القائمة تُعيده، ولا أن
 * السلسلة الفارغة تمسحه. وهذه الحلقات الثلاث هي ما يراه المستعمل: يرفع
 * فلا يظهر، أو يظهر فلا يُحذف.
 */
import fs from "node:fs";
import path from "node:path";

import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  teardown,
  residue,
  TAG,
  TEST_PASSWORD,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";

const as = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x11),
]);

const uploaded: string[] = [];

async function uploadPng() {
  const res = await as(request(app).post("/api/admin/uploads/image"))
    .attach("image", PNG, { filename: "c.png", contentType: "image/png" })
    .expect(200);
  uploaded.push(res.body.url);
  return res.body.url as string;
}

const listed = async (id: string) => {
  const res = await as(request(app).get("/api/admin/faculties")).expect(200);
  return (res.body.faculties as Record<string, unknown>[]).find(
    (x) => x.id === id,
  )!;
};

beforeAll(async () => {
  await teardown();
  f = await seed(1);
  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  // الملفّات المرفوعة تُنظَّف بمعرفة أسمائها لا بمسح المجلّد: فيه صور التطوير.
  for (const url of uploaded) {
    const name = url.split("/").pop();
    if (!name) continue;
    try {
      fs.unlinkSync(path.join(process.cwd(), "uploads", "cards", name));
    } catch {
      /* حُذف أصلاً */
    }
  }
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("صورة الكلّية وشعارها", () => {
  it("يُحفظان عند الإنشاء ويعودان في القائمة", async () => {
    const cover = await uploadPng();
    const icon = await uploadPng();

    const created = await as(request(app).post("/api/admin/faculties"))
      .send({
        name: `${TAG} img faculty`,
        code: `${TAG}-IMG`,
        coverUrl: cover,
        iconUrl: icon,
      })
      .expect(201);

    expect(created.body.faculty.coverUrl).toBe(cover);
    expect(created.body.faculty.iconUrl).toBe(icon);

    const row = await listed(created.body.faculty.id);
    expect(row.coverUrl).toBe(cover);
    expect(row.iconUrl).toBe(icon);
  });

  it("ويُبدَّلان بالتعديل", async () => {
    const created = await as(request(app).post("/api/admin/faculties"))
      .send({ name: `${TAG} swap`, code: `${TAG}-SWAP` })
      .expect(201);

    const cover = await uploadPng();
    const icon = await uploadPng();

    await as(
      request(app).patch(`/api/admin/faculties/${created.body.faculty.id}`),
    )
      .send({ coverUrl: cover, iconUrl: icon })
      .expect(200);

    const row = await listed(created.body.faculty.id);
    expect(row.coverUrl).toBe(cover);
    expect(row.iconUrl).toBe(icon);
  });

  /**
   * الحذف في الواجهة زرٌّ يُفرغ الحقل، فتصل سلسلةٌ فارغة. ولو لم تُترجَم إلى
   * `null` لبقيت الصورة معروضةً بعد حذفها — أو لسقط الحفظ بخطأ نوع.
   */
  it("والسلسلة الفارغة تمسحهما", async () => {
    const cover = await uploadPng();
    const icon = await uploadPng();

    const created = await as(request(app).post("/api/admin/faculties"))
      .send({
        name: `${TAG} clear`,
        code: `${TAG}-CLR`,
        coverUrl: cover,
        iconUrl: icon,
      })
      .expect(201);

    await as(
      request(app).patch(`/api/admin/faculties/${created.body.faculty.id}`),
    )
      .send({ coverUrl: "", iconUrl: "" })
      .expect(200);

    const row = await listed(created.body.faculty.id);
    expect(row.coverUrl).toBeNull();
    expect(row.iconUrl).toBeNull();
  });

  /** وتعديلٌ لا يذكرهما لا يمسّهما — وإلّا ضاعت الصورة عند تغيير الاسم. */
  it("وتعديلُ الاسم وحده لا يمسّ الصورتين", async () => {
    const cover = await uploadPng();

    const created = await as(request(app).post("/api/admin/faculties"))
      .send({ name: `${TAG} keep`, code: `${TAG}-KEEP`, coverUrl: cover })
      .expect(201);

    await as(
      request(app).patch(`/api/admin/faculties/${created.body.faculty.id}`),
    )
      .send({ name: `${TAG} keep 2` })
      .expect(200);

    const row = await listed(created.body.faculty.id);
    expect(row.coverUrl).toBe(cover);
  });
});
