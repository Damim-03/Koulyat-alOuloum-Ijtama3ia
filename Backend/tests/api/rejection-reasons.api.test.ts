/**
 * أسباب الرفض: تُكتب كاملةً، وبحدٍّ يقوله الخادم قبل قاعدة البيانات.
 *
 * كانت أعمدتها VARCHAR(191) والتحقّق لا يعرف ذلك: سببٌ من جملتين يُفشل الرفض
 * بخطأ قاعدة بيانات، وسببُ رفض طلب الفريق لم يكن يُتحقَّق منه أصلاً (رقمٌ أو
 * كائنٌ يصل القاعدة). والأسوأ ما يكتبه الخادم وحده: حين يُقبل فريق، تُلغى
 * طلباتُ أعضائه الأخرى بسببٍ يسمّي الموضوع والأعضاء — وعنوانٌ طويلٌ وحده
 * يقارب 191، فكان قبولُ الفريق نفسه يسقط على طول سببٍ لم يكتبه أحد.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { computeTopicStatus } from "../../src/core/topic/topic-status";
import { REASON_MAX } from "../../src/modules/admin/admin.validation";
import { seed, teardown, residue, makeTopic, TAG, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
let adminToken = "";
const as = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

/** سببٌ عربيّ بالطول المطلوب. */
const words = (length: number) => "سببٌ مفصَّل للرفض ".repeat(Math.ceil(length / 17)).slice(0, length);

/** طلبٌ معلَّق على موضوع، بأعضائه — المرسِل أوّلهم. */
const pendingRequest = async (topicId: string, team: { id: string }[]) => {
  const created = await prisma.groupRequest.create({
    data: {
      topicId,
      leaderStudentId: team[0]!.id,
      priority: 1,
      status: "pending",
      members: { create: team.map((s) => ({ studentId: s.id })) },
    },
  });
  await computeTopicStatus(prisma, topicId);
  return created;
};

beforeAll(async () => {
  await teardown();
  f = await seed(8);
  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email!, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("رفض موضوع", () => {
  it("سببٌ أطول من 191 ⇒ يُحفظ كاملاً", async () => {
    const topic = await makeTopic(f, "رفض بسببٍ طويل", "pending");
    const reason = words(600);
    await as(request(app).patch(`/api/admin/topics/${topic.id}/reject`)).send({ reason }).expect(200);
    const saved = await prisma.graduationTopic.findUniqueOrThrow({ where: { id: topic.id } });
    expect(saved.status).toBe("rejected");
    expect(saved.rejectionReason).toBe(reason.trim());
  });

  it("وفوق الحدّ ⇒ 400 قبل أن يُمسّ شيء", async () => {
    const topic = await makeTopic(f, "رفض بسببٍ أطول من الحدّ", "pending");
    const res = await as(request(app).patch(`/api/admin/topics/${topic.id}/reject`))
      .send({ reason: "س".repeat(REASON_MAX + 1) })
      .expect(400);
    expect(res.body.errorCode).toBe("VALIDATION_ERROR");
    expect((await prisma.graduationTopic.findUniqueOrThrow({ where: { id: topic.id } })).status).toBe("pending");
  });
});

describe("رفض طلب فريق", () => {
  it("سببٌ ليس نصّاً، أو فوق الحدّ ⇒ 400، والطلب باقٍ معلَّقاً", async () => {
    const topic = await makeTopic(f, "طلبٌ يُرفض", "open");
    const req = await pendingRequest(topic.id, f.nextStudents(2));
    const reject = (body: object) => as(request(app).patch(`/api/admin/group-requests/${req.id}/reject`)).send(body);

    expect((await reject({ reason: 42 }).expect(400)).body.errorCode).toBe("VALIDATION_ERROR");
    expect((await reject({ reason: { a: 1 } }).expect(400)).body.errorCode).toBe("VALIDATION_ERROR");
    await reject({ reason: "س".repeat(REASON_MAX + 1) }).expect(400);
    expect((await prisma.groupRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("pending");

    const reason = words(700);
    await reject({ reason }).expect(200);
    const saved = await prisma.groupRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(saved).toMatchObject({ status: "rejected", rejectionReason: reason.trim() });
  });
});

describe("السبب الذي يكتبه الخادم وحده", () => {
  it("قبول فريقٍ على موضوعٍ بعنوانٍ طويل ⇒ ينجح، وطلبُ زميله الآخر يُلغى بسببه كاملاً", async () => {
    // عنوانٌ قريبٌ من أقصى عموده (191): سبب الإلغاء يحويه ويزيد عليه جملةً وأسماء.
    const long = await makeTopic(f, "دراسة ميدانية ".repeat(13).slice(0, 180 - TAG.length), "open");
    const other = await makeTopic(f, "موضوع الطلب الآخر", "open");
    const [a, b, c] = f.nextStudents(3);
    const accepted = await pendingRequest(long.id, [a!, b!]);
    // فريقٌ آخر فيه b — يُلغى طلبه حين يُقبل الأوّل.
    const released = await pendingRequest(other.id, [c!, b!]);

    await as(request(app).patch(`/api/admin/group-requests/${accepted.id}/accept`)).send({}).expect(200);

    const after = await prisma.groupRequest.findUniqueOrThrow({ where: { id: released.id } });
    expect(after.status).toBe("rejected");
    expect(after.rejectionReason).toContain(long.title);
    expect(after.rejectionReason!.length).toBeGreaterThan(191);
  });
});
