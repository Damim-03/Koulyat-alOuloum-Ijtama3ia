/**
 * اختبارات HTTP على الواجهة البرمجية نفسها — عبر supertest.
 *
 * الفارق عن اختبارات التكامل ليس شكلياً: تلك تستدعي دوالّ الخدمة مباشرة،
 * فتتخطّى التوجيه والمصادقة وحُرّاس الأدوار ومعالِج الأخطاء تماماً. وهذه تمرّ
 * بكل ذلك، فتُجيب عن أسئلة لا تجيب عنها الأخرى:
 *
 *   - هل يُمنع الطالب من مسارات الإدارة أصلاً؟
 *   - هل يعود الرفض برمز 400 أم 500؟
 *   - هل تصل رسالة الخادم إلى العميل، أم يبتلعها معالِج الأخطاء؟
 *
 * وهذا الأخير هو ما تبنيه الواجهة عليه: عرضت شهراً «فشل الحذف» بدل «أرشفه
 * بدلاً من ذلك» — والفرق بينهما يقع في هذه الطبقة، لا في الخدمات.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  makeTopic,
  teardown,
  residue,
  TEST_PASSWORD,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken: string;
let studentToken: string;

/** يسجّل الدخول عبر المسار الحقيقي ويُعيد رمز الوصول. */
async function login(path: string, body: Record<string, string>) {
  const res = await request(app).post(path).send(body).expect(200);
  const token = res.body.accessToken ?? res.body.token;
  expect(typeof token).toBe("string");
  return token as string;
}

beforeAll(async () => {
  await teardown(); // بقايا تشغيل انقطع سابقاً
  f = await seed();

  adminToken = await login("/api/auth/admin/login", {
    email: f.admin.email!,
    password: TEST_PASSWORD,
  });
  studentToken = await login("/api/auth/student/login", {
    registrationNumber: f.students[0].reg,
    password: TEST_PASSWORD,
  });
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const asAdmin = (r: request.Test) =>
  r.set("Authorization", `Bearer ${adminToken}`);

describe("المصادقة والصلاحيات", () => {
  it("بلا رمز ⇒ 401، لا 500 ولا تسريب", async () => {
    const res = await request(app).get("/api/admin/topics").expect(401);
    expect(res.body).not.toHaveProperty("stack");
  });

  it("برمز طالب على مسار إدارة ⇒ ممنوع", async () => {
    const res = await request(app)
      .get("/api/admin/topics")
      .set("Authorization", `Bearer ${studentToken}`);
    expect([401, 403]).toContain(res.status);
  });

  it("برمز تالف ⇒ 401 لا انهيار", async () => {
    await request(app)
      .get("/api/admin/topics")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });
});

describe("GET /api/admin/topics", () => {
  it("يُرسل حكم الخادم مع كل موضوع، لا الحالة وحدها", async () => {
    const topic = await makeTopic(f, "API list", "approved");
    const res = await asAdmin(
      request(app).get("/api/admin/topics").query({ search: topic.title }),
    ).expect(200);

    const row = res.body.items.find(
      (t: { id: string }) => t.id === topic.id,
    );
    expect(row).toBeDefined();
    expect(row.actions).toBeDefined();
    expect(typeof row.actions.canDelete).toBe("boolean");
    expect(row.occupancy).toEqual({
      hasGroup: false,
      groupMemberCount: 0,
      hasPendingRequest: false,
      pendingRequestMemberCount: 0,
      hasAcceptedRequest: false,
    });
  });
});

describe("DELETE /api/admin/topics/:id", () => {
  it("يحذف موضوعاً لا يُفقِد حذفه شيئاً ⇒ 200", async () => {
    const topic = await makeTopic(f, "API deletable", "approved");
    await asAdmin(request(app).delete(`/api/admin/topics/${topic.id}`)).expect(
      200,
    );
    expect(
      await prisma.graduationTopic.findUnique({ where: { id: topic.id } }),
    ).toBeNull();
  });

  it("يرفض حذف موضوع تشكّلت له مجموعة ⇒ 400 ورسالة تقول ماذا يُفعل بدلاً", async () => {
    const topic = await makeTopic(f, "API has-group", "approved");
    await prisma.projectGroup.create({ data: { topicId: topic.id } });

    const res = await asAdmin(
      request(app).delete(`/api/admin/topics/${topic.id}`),
    ).expect(400);

    // الرسالة تصل العميل كما هي — وهذا ما تعرضه الواجهة.
    expect(res.body.message).toContain("أرشفه");
    expect(
      await prisma.graduationTopic.findUnique({ where: { id: topic.id } }),
    ).not.toBeNull();
  });

  it("موضوع غير موجود ⇒ 404", async () => {
    await asAdmin(
      request(app).delete("/api/admin/topics/00000000-0000-0000-0000-000000000000"),
    ).expect(404);
  });
});

describe("PATCH /api/admin/topics/:id/publish", () => {
  it("موضوع معتمَد يُنشر ⇒ 200 و status=open", async () => {
    const topic = await makeTopic(f, "API publish", "approved");
    await asAdmin(
      request(app).patch(`/api/admin/topics/${topic.id}/publish`),
    ).expect(200);

    const after = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(after?.status).toBe("open");
    expect(after?.publishedAt).not.toBeNull();
  });

  it("موضوع قيد الانتظار لا يُنشر ⇒ 400 بسبب مفهوم", async () => {
    const topic = await makeTopic(f, "API publish-pending", "pending");
    const res = await asAdmin(
      request(app).patch(`/api/admin/topics/${topic.id}/publish`),
    ).expect(400);
    expect(res.body.message).toBeTruthy();
    expect(res.body.message).not.toMatch(/error|Error|undefined/);
  });
});
