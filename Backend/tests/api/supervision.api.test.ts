/**
 * «طلب الموافقة على الإشراف» — الورقة ومن يملكها ومن يتحقّق منها.
 *
 * الورقة تُطبع وتُوقَّع بخطّ اليد ثمّ تُحفظ في ملفّ، ويُمسح رمزُها بعد
 * شهور. فما يُسأل عنه هنا ليس الشكل بل ما لا يُرى إلّا بعد فوات الأوان:
 *
 *   ١. أن يُطبع رقمُ تسجيلٍ غيرُ رقم الطالب — وثيقةٌ رسمية برقمٍ مخترَع؛
 *   ٢. أن يُصدر طالبٌ ورقةً لمشروع غيره؛
 *   ٣. أن تبقى ورقتان فعّالتان لموضوعٍ واحد، فيتحقّق توقيعان متنافسان؛
 *   ٤. أن تظلّ الملغاة تُقرأ «صالحة» عند المسح؛
 *   ٥. أن تُسرّب صفحةُ التحقّق العامّة ما لا يلزم إثباتَ الورقة.
 */
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
let memberToken = "";
let outsiderToken = "";
let topicId = "";

const as = (r: request.Test, token: string) =>
  r.set("Authorization", `Bearer ${token}`);

const login = async (reg: string) =>
  (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;

/** موضوعٌ قامت عليه مجموعةٌ من طالبين — وهو حال الورقة. */
async function seedProject() {
  const [a, b, outsider] = f.nextStudents(3);

  const topic = await prisma.graduationTopic.create({
    data: {
      title: `${TAG} نظام إدارة مذكّرات التخرّج`,
      description: `${TAG} description`,
      maxStudents: 2,
      status: "full",
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });

  await prisma.projectGroup.create({
    data: {
      topicId: topic.id,
      members: {
        create: [
          { studentId: a!.id, isLeader: true },
          { studentId: b!.id },
        ],
      },
    },
  });

  return { topic, a: a!, b: b!, outsider: outsider! };
}

let members: { a: { id: string; reg: string }; b: { id: string; reg: string } };

beforeAll(async () => {
  await teardown();
  f = await seed(4);

  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;

  const p = await seedProject();
  topicId = p.topic.id;
  members = { a: p.a, b: p.b };
  memberToken = await login(p.a.reg);
  outsiderToken = await login(p.outsider.reg);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const issue = (token: string) =>
  as(request(app).post(`/api/supervision-documents/topics/${topicId}`), token);

/**
 * رقمُ التحقّق في EAN-13، محسوباً هنا من الصفر.
 *
 * ولا يُستورَد من الخدمة عمداً: اختبارٌ يستدعي الدالّة التي يفحصها يوافقها
 * على خطئها. وهذا هو ما يفعله القارئُ الشريطيّ حرفاً بحرف.
 */
const ean13Check = (first12: string) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
};

describe("إصدار الورقة", () => {
  it("عضوُ المشروع يُصدرها، وتحمل أرقام تسجيل الطلبة كما هي", async () => {
    const res = await issue(memberToken).expect(201);

    expect(res.body.created).toBe(true);
    expect(res.body.document.documentNumber).toMatch(/^SUP-\d{4}-\d{6}$/);

    const snap = res.body.document.snapshot;
    const regs = snap.students.map((s: { registrationNumber: string }) =>
      s.registrationNumber,
    );

    // رقمُ التسجيل من `Student.registrationNumber` لا من معرّفٍ ولا مولَّد.
    expect(regs.sort()).toEqual([members.a.reg, members.b.reg].sort());
    expect(regs).not.toContain(members.a.id);
    expect(snap.students).toHaveLength(2);
  });

  /** ورقتان فعّالتان لموضوعٍ واحد = توقيعان يتحقّقان معاً. */
  it("ولا تُصدَر ثانيةٌ ما دامت الأولى فعّالة", async () => {
    const first = await issue(memberToken).expect(200);

    expect(first.body.created).toBe(false);
    expect(await prisma.supervisionDocument.count({ where: { topicId } })).toBe(
      1,
    );
  });

  it("وطالبٌ من خارج المجموعة لا يُصدرها ولا يراها", async () => {
    await issue(outsiderToken).expect(401);
    await as(
      request(app).get(`/api/supervision-documents/topics/${topicId}/preview`),
      outsiderToken,
    ).expect(401);
  });

  it("والإدارة تُصدرها لأي موضوع", async () => {
    const res = await issue(adminToken).expect(200);
    expect(res.body.document.topicId).toBe(topicId);
  });

  /**
   * الرمزُ الشريطيّ يُمسح بقارئٍ حقيقيّ، والقارئ يحسب رقم التحقّق ويقارن.
   * فرمزٌ من ثلاثة عشر رقماً عشوائيةً كلِّها لا يُمسح — يبدو رمزاً وليس به.
   */
  it("وتحمل رمزاً شريطياً من ١٣ رقماً برقم تحقّقٍ صحيح", async () => {
    const doc = await prisma.supervisionDocument.findFirstOrThrow({
      where: { topicId },
    });

    expect(doc.barcode).toMatch(/^\d{13}$/);
    const code = doc.barcode!;
    expect(Number(code[12])).toBe(ean13Check(code.slice(0, 12)));
    // ولا يُشتقّ من رقم الوثيقة ولا من معرّفها، فلا يُستنتج من ورقةٍ أخرى.
    expect(doc.documentNumber).not.toContain(code);
    expect(doc.id).not.toContain(code);
  });
});

describe("التحقّق العامّ", () => {
  const tokenOf = async () =>
    (await prisma.supervisionDocument.findFirstOrThrow({ where: { topicId } }))
      .verificationToken;

  it("يعمل بلا تسجيل دخول، ويقول إنّ الوثيقة صالحة", async () => {
    const res = await request(app)
      .get(`/api/verify/${await tokenOf()}`)
      .expect(200);

    expect(res.body.found).toBe(true);
    expect(res.body.status).toBe("active");
    expect(res.body.students).toHaveLength(2);
    expect(res.body.topicTitle).toContain("نظام إدارة");
  });

  /** صفحةٌ عامّة: لا تُعطي إلّا ما يُثبت الورقة. */
  it("ولا يُسرّب معرّفاً داخلياً ولا بريداً", async () => {
    const body = JSON.stringify(
      (await request(app).get(`/api/verify/${await tokenOf()}`)).body,
    );

    expect(body).not.toContain(topicId);
    expect(body).not.toContain(members.a.id);
    expect(body).not.toContain("@");
    expect(body).not.toContain("verificationToken");
  });

  /** ما يمسحه القارئ أو تكتبه اليد يفتح الوثيقة نفسها التي يفتحها الطويل. */
  it("ويقبل الرمز الشريطيّ كما يقبل الرمز الطويل", async () => {
    const doc = await prisma.supervisionDocument.findFirstOrThrow({
      where: { topicId },
    });

    const byBarcode = await request(app)
      .get(`/api/verify/${doc.barcode}`)
      .expect(200);
    const byToken = await request(app)
      .get(`/api/verify/${doc.verificationToken}`)
      .expect(200);

    expect(byBarcode.body.found).toBe(true);
    expect(byBarcode.body.documentNumber).toBe(byToken.body.documentNumber);
    expect(byBarcode.body.students).toEqual(byToken.body.students);
  });

  it("ورقمٌ من ١٣ خانة لا وجود له ⇒ وثيقةٌ غير صالحة", async () => {
    const res = await request(app).get("/api/verify/2900000000008").expect(404);
    expect(res.body.found).toBe(false);
  });

  it("ورمزٌ لا وجود له ⇒ وثيقةٌ غير صالحة", async () => {
    const res = await request(app)
      .get(`/api/verify/${"z".repeat(43)}`)
      .expect(404);

    expect(res.body.found).toBe(false);
  });

  /** ورمزٌ مشوَّه لا يُردّ عليه بـ«صيغة خاطئة»: ذلك يُرشد من يجرّب. */
  it("ورمزٌ مشوَّه يُعامَل كغير الموجود", async () => {
    const res = await request(app).get("/api/verify/%20%20").expect(404);
    expect(res.body.found).toBe(false);
  });
});

describe("قائمة الإدارة", () => {
  /**
   * الإدارة تمسح الورقة بقارئٍ لتصل إلى موضوعها. ولولا أنّ البحث يشمل
   * الرمز الشريطيّ لَعاد المسحُ بلا نتيجة، ولا يُخطر ببال أحدٍ لِمَ.
   */
  it("تُوجد الورقة ببحثٍ برمزها الشريطيّ، ومعها معرّف موضوعها", async () => {
    const doc = await prisma.supervisionDocument.findFirstOrThrow({
      where: { topicId },
    });

    const res = await as(
      request(app).get("/api/supervision-documents").query({
        search: doc.barcode!,
      }),
      adminToken,
    ).expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].documentNumber).toBe(doc.documentNumber);
    expect(res.body.items[0].topicId).toBe(topicId);
  });

  it("ورمزٌ لا وجود له يعود بلا شيء", async () => {
    const res = await as(
      request(app)
        .get("/api/supervision-documents")
        .query({ search: "2900000000008" }),
      adminToken,
    ).expect(200);

    expect(res.body.items).toHaveLength(0);
  });
});

describe("الإلغاء", () => {
  it("للإدارة وحدها", async () => {
    const doc = await prisma.supervisionDocument.findFirstOrThrow({
      where: { topicId },
    });

    await as(
      request(app).patch(`/api/supervision-documents/${doc.id}/revoke`),
      memberToken,
    ).expect(403);
  });

  it("وبعده لا تُقرأ الورقة «صالحة» عند المسح", async () => {
    const doc = await prisma.supervisionDocument.findFirstOrThrow({
      where: { topicId },
    });

    await as(
      request(app).patch(`/api/supervision-documents/${doc.id}/revoke`),
      adminToken,
    ).expect(200);

    const res = await request(app)
      .get(`/api/verify/${doc.verificationToken}`)
      .expect(200);

    expect(res.body.status).toBe("revoked");
    expect(res.body.revokedAt).toBeTruthy();
  });

  /** والملغاة لا تمنع إصدار بديلٍ لها. */
  it("ويجوز إصدار بديلٍ بعد الإلغاء", async () => {
    const res = await issue(adminToken).expect(201);

    expect(res.body.created).toBe(true);
    expect(await prisma.supervisionDocument.count({ where: { topicId } })).toBe(
      2,
    );
  });
});
