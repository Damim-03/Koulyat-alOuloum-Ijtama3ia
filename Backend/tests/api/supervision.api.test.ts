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
import { DEFAULT_SUPERVISION_SHEET } from "../../src/modules/site/supervision-sheet";
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

//
// ═══ ما بقي بلا اختبار: المشرف، والمعاينة، والقراءة، والحالات الطرفية ═══
//

const professorLogin = async (universityEmail: string) =>
  (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;

const preview = (id: string, token: string) =>
  as(request(app).get(`/api/supervision-documents/topics/${id}/preview`), token);
const issueFor = (id: string, token: string) =>
  as(request(app).post(`/api/supervision-documents/topics/${id}`), token);
const read = (id: string, token: string) =>
  as(request(app).get(`/api/supervision-documents/${id}`), token);
const revoke = (id: string, token: string) =>
  as(request(app).patch(`/api/supervision-documents/${id}/revoke`), token);
const activeOf = (id: string) =>
  prisma.supervisionDocument.findFirstOrThrow({ where: { topicId: id, status: "active" } });
const printDoc = (id: string, token: string, version?: string) =>
  as(request(app).post(`/api/supervision-documents/${id}/print`), token).send(version ? { version } : {});

describe("المشرف والمعاينة", () => {
  let supervisorToken = "";
  let otherProfessorToken = "";
  let soloTopicId = "";
  let emptyTopicId = "";

  beforeAll(async () => {
    supervisorToken = await professorLogin(`${TAG}.emp@test.local`);
    otherProfessorToken = await professorLogin(`${TAG}.emp2@test.local`);

    // موضوعٌ قامت عليه مجموعةٌ من طالبٍ واحد، ولم تصدر له ورقةٌ بعد.
    const [solo] = f.nextStudents(1);
    const soloTopic = await prisma.graduationTopic.create({
      data: {
        title: `${TAG} موضوعٌ لطالبٍ واحد`,
        description: `${TAG} d`,
        maxStudents: 1,
        status: "full",
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });
    await prisma.projectGroup.create({
      data: { topicId: soloTopic.id, members: { create: [{ studentId: solo!.id, isLeader: true }] } },
    });
    soloTopicId = soloTopic.id;

    // وموضوعٌ منشور لم تقم عليه مجموعة.
    emptyTopicId = (
      await prisma.graduationTopic.create({
        data: {
          title: `${TAG} موضوعٌ بلا مجموعة`,
          description: `${TAG} d`,
          maxStudents: 2,
          status: "open",
          professorId: f.professor.id,
          specializationId: f.specialization.id,
          academicYearId: f.academicYear.id,
        },
      })
    ).id;
  });

  it("مشرف الموضوع يعاين الورقة كما ستُطبع، ومعها الفعّالة", async () => {
    const res = await preview(topicId, supervisorToken).expect(200);

    expect(res.body.snapshot.supervisorName).toBe(`${TAG} Prof`);
    expect(res.body.snapshot.level).toBe("master");
    expect(res.body.snapshot.academicYear).toBe(`${TAG} 2099/2100`);
    expect(res.body.snapshot.students.map((s: { registrationNumber: string }) => s.registrationNumber).sort()).toEqual(
      [members.a.reg, members.b.reg].sort(),
    );
    expect(res.body.active.status).toBe("active");
  });

  it("وأستاذٌ غيرُ مشرفه لا يعاينها ولا يُصدرها", async () => {
    const res = await preview(topicId, otherProfessorToken).expect(401);
    expect(res.body.errorCode).toBe("ACCESS_UNAUTHORIZED");
    await issue(otherProfessorToken).expect(401);
  });

  it("وموضوعٌ لم تصدر له ورقة: المعاينة بلا فعّالة، ثمّ يُصدرها مشرفه", async () => {
    const before = await preview(soloTopicId, supervisorToken).expect(200);
    expect(before.body.active).toBeNull();
    expect(before.body.snapshot.students).toHaveLength(1);

    const issued = await issueFor(soloTopicId, supervisorToken).expect(201);
    expect(issued.body.created).toBe(true);

    const after = await preview(soloTopicId, supervisorToken).expect(200);
    expect(after.body.active.id).toBe(issued.body.document.id);
  });

  /** ورقةٌ لمن؟ موضوعٌ لم تقم عليه مجموعة لا ورقة له — لا معاينةً ولا إصداراً. */
  it("وموضوعٌ بلا مجموعة لا ورقة له", async () => {
    await preview(emptyTopicId, adminToken).expect(400);
    await issueFor(emptyTopicId, adminToken).expect(400);
    expect(await prisma.supervisionDocument.count({ where: { topicId: emptyTopicId } })).toBe(0);
  });

  it("وموضوعٌ لا وجود له ⇒ 404، ومعرّفٌ مشوَّه ⇒ 400", async () => {
    const ghost = "00000000-0000-4000-8000-000000000000";
    await preview(ghost, adminToken).expect(404);
    await issueFor(ghost, adminToken).expect(404);
    await preview("not-a-uuid", adminToken).expect(400);
    await issueFor("not-a-uuid", adminToken).expect(400);
  });

  /**
   * الرمز الشريطيّ أُضيف بعد أن صدرت أوراق. فورقةٌ بلا رمزٍ تأخذه عند أوّل
   * قراءة، ويُحفظ — فلا تحمل الورقة نفسها رمزين في قراءتين.
   */
  it("وورقةٌ صدرت قبل الرمز الشريطيّ تأخذه عند أوّل معاينة، ويبقى لها", async () => {
    const doc = await activeOf(topicId);
    await prisma.supervisionDocument.update({ where: { id: doc.id }, data: { barcode: null } });

    const first = await preview(topicId, adminToken).expect(200);
    const code = first.body.active.barcode as string;
    expect(code).toMatch(/^\d{13}$/);
    expect(Number(code[12])).toBe(ean13Check(code.slice(0, 12)));

    const again = await preview(topicId, adminToken).expect(200);
    expect(again.body.active.barcode).toBe(code);
    expect((await prisma.supervisionDocument.findUniqueOrThrow({ where: { id: doc.id } })).barcode).toBe(code);
  });
});

describe("قراءة ورقةٍ بعينها", () => {
  it("يقرؤها عضو المشروع ومشرفه والإدارة", async () => {
    const doc = await activeOf(topicId);
    const supervisorToken = await professorLogin(`${TAG}.emp@test.local`);
    for (const token of [memberToken, supervisorToken, adminToken]) {
      const res = await read(doc.id, token).expect(200);
      expect(res.body.document.documentNumber).toBe(doc.documentNumber);
    }
  });

  it("ولا يقرؤها طالبٌ من خارج المجموعة، ولا أستاذٌ غير مشرفها", async () => {
    const doc = await activeOf(topicId);
    await read(doc.id, outsiderToken).expect(401);
    await read(doc.id, await professorLogin(`${TAG}.emp2@test.local`)).expect(401);
  });

  it("وورقةٌ بلا رمزٍ شريطيّ تأخذه عند قراءتها", async () => {
    const revoked = await prisma.supervisionDocument.findFirstOrThrow({ where: { topicId, status: "revoked" } });
    await prisma.supervisionDocument.update({ where: { id: revoked.id }, data: { barcode: null } });

    const res = await read(revoked.id, adminToken).expect(200);
    expect(res.body.document.barcode).toMatch(/^\d{13}$/);
  });

  it("ومعرّفٌ لا وجود له ⇒ 404، ومشوَّه ⇒ 400", async () => {
    await read("00000000-0000-4000-8000-000000000000", adminToken).expect(404);
    await read("not-a-uuid", adminToken).expect(400);
  });
});

describe("قائمة الإدارة — التصفية والحدود", () => {
  it("بالحالة: الملغاة وحدها، أو الفعّالة وحدها", async () => {
    const revoked = await as(request(app).get("/api/supervision-documents").query({ status: "revoked" }), adminToken).expect(200);
    expect(revoked.body.items.length).toBeGreaterThan(0);
    expect(revoked.body.items.every((d: { status: string }) => d.status === "revoked")).toBe(true);

    const active = await as(request(app).get("/api/supervision-documents").query({ status: "active", limit: 100 }), adminToken).expect(200);
    expect(active.body.items.every((d: { status: string }) => d.status === "active")).toBe(true);
    expect(active.body.items.map((d: { topicId: string }) => d.topicId)).toContain(topicId);
  });

  it("وقيمٌ خارج حدودها ⇒ 400", async () => {
    await as(request(app).get("/api/supervision-documents").query({ limit: 0 }), adminToken).expect(400);
    await as(request(app).get("/api/supervision-documents").query({ status: "lost" }), adminToken).expect(400);
  });

  it("وللإدارة وحدها", async () => {
    await as(request(app).get("/api/supervision-documents"), memberToken).expect(403);
  });
});

describe("الإلغاء — ما بقي", () => {
  /** إلغاء الملغاة لا يُغيّر تاريخ إلغائها: التاريخ المطبوع في صفحة التحقّق هو الأوّل. */
  it("إلغاء الملغاة لا يُغيّر شيئاً", async () => {
    const doc = await prisma.supervisionDocument.findFirstOrThrow({ where: { topicId, status: "revoked" } });
    const res = await revoke(doc.id, adminToken).expect(200);
    expect(res.body.document.status).toBe("revoked");
    expect(new Date(res.body.document.revokedAt).getTime()).toBe(doc.revokedAt!.getTime());
  });

  it("ومعرّفٌ لا وجود له ⇒ 404، ومشوَّه ⇒ 400", async () => {
    await revoke("00000000-0000-4000-8000-000000000000", adminToken).expect(404);
    await revoke("not-a-uuid", adminToken).expect(400);
  });
});

//
// ═══ نصّ الورقة: تعدّله الإدارة من «واجهة الموقع»، وكلّ وثيقةٍ تحمل نصّها ═══
//

describe("نصّ الورقة", () => {
  const SLUG = "supervision-sheet";
  const sheet = (over: Record<string, unknown> = {}) => ({ ...DEFAULT_SUPERVISION_SHEET, ...over });
  const get = (token = adminToken) => as(request(app).get("/api/admin/supervision-sheet"), token);
  const put = (body: unknown, token = adminToken) =>
    as(request(app).put("/api/admin/supervision-sheet"), token).send(body as object);
  const del = (token = adminToken) => as(request(app).delete("/api/admin/supervision-sheet"), token);
  let before: unknown = null;

  beforeAll(async () => {
    before = (await prisma.siteContent.findUnique({ where: { slug: SLUG } }))?.value ?? null;
    await prisma.siteContent.deleteMany({ where: { slug: SLUG } });
  });

  afterAll(async () => {
    await prisma.siteContent.deleteMany({ where: { slug: SLUG } });
    if (before) await prisma.siteContent.create({ data: { slug: SLUG, value: before as object } });
  });

  it("لم تُحفظ قطّ ⇒ لا محفوظ، ومعه النصّ الأصليّ", async () => {
    const res = await get().expect(200);
    expect(res.body.content).toBeNull();
    expect(res.body.defaults).toEqual(DEFAULT_SUPERVISION_SHEET);
    expect(res.body.defaults.title).toBe("طلب الموافقة على الإشراف");
  });

  it("للإدارة وحدها", async () => {
    await get(memberToken).expect(403);
    await put(sheet(), memberToken).expect(403);
    await del(memberToken).expect(403);
    expect(await prisma.siteContent.count({ where: { slug: SLUG } })).toBe(0);
  });

  it("وما لا يصحّ يُردّ: ترويسةٌ أطول من ستّة أسطر، وعبارةٌ فوق حدّها أو غائبة، وشعارٌ ليس صورةً مرفوعة", async () => {
    await put(sheet({ header: Array.from({ length: 7 }, (_, i) => `سطر ${i}`) })).expect(400);
    await put(sheet({ signLabel: "x".repeat(81) })).expect(400);
    await put(sheet({ universityLogo: "javascript:alert(1)" })).expect(400);
    await put(sheet({ facultyLogo: "/uploads/../../etc/passwd" })).expect(400);
    const withoutTitle: Record<string, unknown> = { ...DEFAULT_SUPERVISION_SHEET };
    delete withoutTitle.title;
    await put(withoutTitle).expect(400);
    expect(await prisma.siteContent.count({ where: { slug: SLUG } })).toBe(0);
  });

  it("تُحفظ مقلَّمة، والشعار الفارغ «لا شعار» فيُطبع شعار المنصّة", async () => {
    const res = await put(
      sheet({
        title: "  طلب موافقة  ",
        header: [" الجمهورية ", "الجامعة"],
        degrees: { licence: "الليسانس", master: "الماستر", doctorate: " الدكتوراه " },
        universityLogo: "",
        facultyLogo: "/uploads/cards/faculty.png",
      }),
    ).expect(200);
    expect(res.body.content).toMatchObject({
      title: "طلب موافقة",
      header: ["الجمهورية", "الجامعة"],
      degrees: { doctorate: "الدكتوراه" },
      universityLogo: null,
      facultyLogo: "/uploads/cards/faculty.png",
    });
    expect((await get().expect(200)).body.content.title).toBe("طلب موافقة");
  });

  it("سطر التخصّص تحت خانات الشهادة: ورقةٌ حُفظت قبله تأخذه كالأصل؛ ويُطفأ ويُعاد تسميته", async () => {
    expect(DEFAULT_SUPERVISION_SHEET.specialization).toEqual({ show: true, label: "التخصّص:" });
    // Saved before the line existed: still read — with the line, as the original has it.
    const old: Record<string, unknown> = { ...DEFAULT_SUPERVISION_SHEET, title: "ورقةٌ قديمة" };
    delete old.specialization;
    await prisma.siteContent.upsert({ where: { slug: SLUG }, create: { slug: SLUG, value: old as object }, update: { value: old as object } });
    const read = (await get().expect(200)).body.content;
    expect(read).toMatchObject({ title: "ورقةٌ قديمة", specialization: { show: true, label: "التخصّص:" } });

    const off = await put(sheet({ specialization: { show: false, label: "  الاختصاص:  " } })).expect(200);
    expect(off.body.content.specialization).toEqual({ show: false, label: "الاختصاص:" });
    await put(sheet({ specialization: { show: true, label: "x".repeat(61) } })).expect(400);
    await put(sheet({ specialization: { label: "التخصّص:" } })).expect(400);
  });

  it("وكلّ حقلٍ اختياريّ: الفارغ يُحفظ فارغاً فلا يُطبع، وسطرُ الترويسة الفارغ يسقط", async () => {
    const res = await put(
      sheet({ header: ["سطر", "  ", "آخر"], title: " ", supervisorLead: "", yearLabel: "", signLabel: "" }),
    ).expect(200);
    expect(res.body.content).toMatchObject({ header: ["سطر", "آخر"], title: "", supervisorLead: "", yearLabel: "", signLabel: "" });
    expect((await put(sheet({ header: [] })).expect(200)).body.content.header).toEqual([]);
  });

  it("قبل الطباعة تتبع الورقة النصّ الجاري برقمها ورمزها؛ وأوّل طباعة تثبّته فيها", async () => {
    await put(sheet({ title: "النصّ الأوّل" })).expect(200);
    await revoke((await activeOf(topicId)).id, adminToken).expect(200);
    const doc = (await issueFor(topicId, adminToken).expect(201)).body.document;
    expect(doc.snapshot.template.title).toBe("النصّ الأوّل");
    expect(doc.printedAt).toBeNull();

    await put(sheet({ title: "النصّ الثاني" })).expect(200);
    const unprinted = (await read(doc.id, adminToken).expect(200)).body.document;
    expect(unprinted.snapshot.template.title).toBe("النصّ الثاني");
    expect([unprinted.documentNumber, unprinted.barcode]).toEqual([doc.documentNumber, doc.barcode]);

    await printDoc(doc.id, memberToken, unprinted.version).expect(200);
    await put(sheet({ title: "النصّ الثالث" })).expect(200);
    // Printed: as it was printed.
    expect((await read(doc.id, adminToken).expect(200)).body.document.snapshot.template.title).toBe("النصّ الثاني");
    // The draft: as a new one would be issued now.
    expect((await preview(topicId, adminToken).expect(200)).body.snapshot.template.title).toBe("النصّ الثالث");
  });

  it("واستعادة الأصل تمحو المحفوظ: غير المطبوعة تعود إليه، والمطبوعة تبقى كما طُبعت", async () => {
    await put(sheet({ title: "نصٌّ مخصّص" })).expect(200);
    await revoke((await activeOf(topicId)).id, adminToken).expect(200);
    const doc = (await issueFor(topicId, adminToken).expect(201)).body.document;
    expect(doc.snapshot.template.title).toBe("نصٌّ مخصّص");

    const res = await del().expect(200);
    expect(res.body.content).toBeNull();
    expect(await prisma.siteContent.count({ where: { slug: SLUG } })).toBe(0);
    expect((await preview(topicId, adminToken).expect(200)).body.snapshot.template).toEqual(DEFAULT_SUPERVISION_SHEET);
    const back = (await read(doc.id, adminToken).expect(200)).body.document;
    expect(back.snapshot.template).toEqual(DEFAULT_SUPERVISION_SHEET);

    await printDoc(doc.id, adminToken, back.version).expect(200);
    await put(sheet({ title: "بعد الطباعة" })).expect(200);
    expect((await read(doc.id, adminToken).expect(200)).body.document.snapshot.template).toEqual(DEFAULT_SUPERVISION_SHEET);
    await del().expect(200);
    // And again: nothing to restore, nothing fails.
    await del().expect(200);
  });

  it("ومحفوظٌ لم يعد يطابق الشكل يُعامَل كغير المحفوظ — فلا تنكسر الورقة", async () => {
    await prisma.siteContent.create({ data: { slug: SLUG, value: { title: "ناقص" } } });
    expect((await get().expect(200)).body.content).toBeNull();
    expect((await preview(topicId, adminToken).expect(200)).body.snapshot.template).toEqual(DEFAULT_SUPERVISION_SHEET);
    await del().expect(200);
  });
});

//
// ═══ الطباعة: قبلها تتبع الورقة موضوعها، وأوّلها يثبّتها ويُحفظ من طبعها ═══
//

describe("الطباعة", () => {
  let supervisorToken = "";
  let otherProfessorToken = "";

  beforeAll(async () => {
    supervisorToken = await professorLogin(`${TAG}.emp@test.local`);
    otherProfessorToken = await professorLogin(`${TAG}.emp2@test.local`);
  });

  /** A new document for the project's topic, never printed. */
  async function fresh() {
    const active = await prisma.supervisionDocument.findFirst({ where: { topicId, status: "active" } });
    if (active) await revoke(active.id, adminToken).expect(200);
    return (await issueFor(topicId, adminToken).expect(201)).body.document as {
      id: string;
      version: string;
      documentNumber: string;
      barcode: string;
      printedAt: string | null;
      printCount: number;
    };
  }

  /** The topic's title changed for a while — then back as it was. */
  async function retitled(run: (title: string) => Promise<void>) {
    const { title } = await prisma.graduationTopic.findUniqueOrThrow({ where: { id: topicId } });
    await prisma.graduationTopic.update({ where: { id: topicId }, data: { title: `${title} — مصحَّح` } });
    try {
      await run(`${title} — مصحَّح`);
    } finally {
      await prisma.graduationTopic.update({ where: { id: topicId }, data: { title } });
    }
  }

  it("قبلها تتبع الورقة موضوعها: عنوانٌ صُحّح يظهر فيها برقمها ورمزها نفسيهما، وفي صفحة التحقّق", async () => {
    const doc = await fresh();
    expect(doc).toMatchObject({ printedAt: null, printCount: 0 });
    await retitled(async (title) => {
      const now = (await read(doc.id, memberToken).expect(200)).body.document;
      expect(now.snapshot.topicTitle).toBe(title);
      expect([now.documentNumber, now.barcode]).toEqual([doc.documentNumber, doc.barcode]);
      expect(now.version).not.toBe(doc.version);
      expect((await request(app).get(`/api/verify/${doc.barcode}`).expect(200)).body.topicTitle).toBe(title);
    });
  });

  it("أوّلها يثبّتها ويحفظ من طبعها ومتى؛ وما بعدها يُعدّ ولا يغيّر شيئاً", async () => {
    const doc = await fresh();
    const first = (await printDoc(doc.id, memberToken, doc.version).expect(200)).body.document;
    expect(first).toMatchObject({ printedByRole: "student", printCount: 1, documentNumber: doc.documentNumber, barcode: doc.barcode });
    expect(first.printedByName).toBeTruthy();
    expect(first.printedAt).toBeTruthy();
    expect(first).not.toHaveProperty("printedById");

    await retitled(async (title) => {
      const after = (await read(doc.id, supervisorToken).expect(200)).body.document;
      expect(after.snapshot.topicTitle).not.toBe(title);
      expect(after.version).toBe(first.version);
    });

    const again = (await printDoc(doc.id, supervisorToken).expect(200)).body.document;
    expect(again).toMatchObject({ printedByRole: "student", printedByName: first.printedByName, printCount: 2, printedAt: first.printedAt });
    expect(again.lastPrintedAt).toBeTruthy();
  });

  it("ورقةٌ تغيّرت منذ قرأتها الشاشة ⇒ ٤٠٩ ولا تُثبَّت؛ وبصيغتها الجديدة تُطبع", async () => {
    const doc = await fresh();
    await retitled(async () => {
      const refused = await printDoc(doc.id, memberToken, doc.version).expect(409);
      expect(refused.body.errorCode).toBe("DOCUMENT_CHANGED");
      expect((await prisma.supervisionDocument.findUniqueOrThrow({ where: { id: doc.id } })).printedAt).toBeNull();
      const now = (await read(doc.id, memberToken).expect(200)).body.document;
      await printDoc(doc.id, memberToken, now.version).expect(200);
    });
  });

  it("وإن طبعتها الإدارة: يُسمّى الموظّف للإدارة وحدها، ولغيرها «الإدارة»", async () => {
    const doc = await fresh();
    await printDoc(doc.id, adminToken, doc.version).expect(200);
    const forAdmin = (await read(doc.id, adminToken).expect(200)).body.document;
    expect(forAdmin.printedByRole).toBe("admin");
    expect(forAdmin.printedByName).toBeTruthy();
    for (const token of [memberToken, supervisorToken]) {
      expect((await read(doc.id, token).expect(200)).body.document).toMatchObject({ printedByRole: "admin", printedByName: null });
    }
  });

  it("ولا يطبعها من ليس من أهلها، ولا تُطبع ملغاة، وما لا يصحّ يُردّ", async () => {
    const doc = await fresh();
    await printDoc(doc.id, outsiderToken).expect(401);
    await printDoc(doc.id, otherProfessorToken).expect(401);
    await as(request(app).post(`/api/supervision-documents/${doc.id}/print`), adminToken).send({ version: 5 }).expect(400);
    await printDoc("00000000-0000-4000-8000-000000000000", adminToken).expect(404);
    await printDoc("not-a-uuid", adminToken).expect(400);
    expect((await prisma.supervisionDocument.findUniqueOrThrow({ where: { id: doc.id } })).printCount).toBe(0);

    await revoke(doc.id, adminToken).expect(200);
    await printDoc(doc.id, adminToken).expect(400);
  });
});
