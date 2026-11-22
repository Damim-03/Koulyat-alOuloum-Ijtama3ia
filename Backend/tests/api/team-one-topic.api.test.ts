/**
 * فريقٌ قُبل طلبه على موضوع لا يسجّل في موضوعٍ آخر — من أوّل القصّة إلى آخرها.
 *
 * طالبٌ واحد لمذكرةٍ واحدة. فحين تقبل الإدارة طلب فريقٍ على موضوع:
 *   ١. تُرفض طلباتُ الفريق نفسه على مواضيع أخرى (أولويّاته الأدنى)، بسببٍ يقوله؛
 *   ٢. ولا يُرسل أيٌّ من أعضائه — القائد ولا العضو — طلباً جديداً؛
 *   ٣. ولا يضيفه طالبٌ آخر زميلاً في طلبه؛
 *   ٤. ولا تقبل الإدارة له طلباً ثانياً؛
 *   ٥. ولا تُفتح له تفاصيل موضوعٍ غير موضوعه — قفلٌ كقفل المحجوز.
 * وما قبل القبول: من هو في طلبٍ حيٍّ لفريقٍ آخر لا يُضاف زميلاً — لو قُبل
 * الطلبان لصار له مشروعان.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { tr } from "../../src/core/i18n";
import { seed, teardown, residue, makeTopic, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
const tokens = new Map<string, string>();

async function as(reg: string) {
  if (!tokens.has(reg)) {
    const res = await request(app).post("/api/auth/student/login").send({ registrationNumber: reg, password: TEST_PASSWORD }).expect(200);
    tokens.set(reg, res.body.accessToken);
  }
  return `Bearer ${tokens.get(reg)!}`;
}

const ask = async (reg: string, topicId: string, mates: string[] = [], priority = 1) =>
  request(app)
    .post("/api/student/group-requests")
    .set("Authorization", await as(reg))
    .send({ topicId, memberRegistrationNumbers: mates, priority });

beforeAll(async () => {
  await teardown();
  f = await seed(6);
  admin = `Bearer ${(await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body.accessToken}`;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("فريقٌ قُبل طلبه لا يسجّل في موضوعٍ آخر", () => {
  it("من الطلب إلى القبول، ثمّ كلّ بابٍ إلى موضوعٍ ثانٍ مغلق", async () => {
    const [leader, member, outsider] = f.students;
    const [first, second, third] = await Promise.all([
      makeTopic(f, "TEAM first choice", "open", 3),
      makeTopic(f, "TEAM second choice", "open", 3),
      makeTopic(f, "TEAM third topic", "open", 3),
    ]);

    // The team asks for two topics, by priority.
    const chosen = (await ask(leader!.reg, first.id, [member!.reg], 1)).body.request;
    const fallback = (await ask(leader!.reg, second.id, [member!.reg], 2)).body.request;
    expect(chosen.status).toBe("pending");
    expect(fallback.status).toBe("pending");

    // The administration accepts the first.
    await request(app).patch(`/api/admin/group-requests/${chosen.id}/accept`).set("Authorization", admin).expect(200);
    const project = await prisma.projectGroup.findUniqueOrThrow({ where: { topicId: first.id }, include: { members: true } });
    expect(project.members.map((m) => m.studentId).sort()).toEqual([leader!.id, member!.id].sort());

    // ١. Its other request ended, saying why.
    const ended = await prisma.groupRequest.findUniqueOrThrow({ where: { id: fallback.id } });
    expect(ended.status).toBe("rejected");
    expect(ended.rejectionReason).toBe(tr("request.teamPlacedReason", { title: first.title }));

    // ٢. Neither the leader nor the member can ask again — alone or together.
    const byLeader = await ask(leader!.reg, third.id, [member!.reg]);
    expect(byLeader.status).toBe(400);
    expect(byLeader.body.message).toBe(tr("student.selfHasProject", { title: first.title }));
    const byMember = await ask(member!.reg, third.id);
    expect(byMember.status).toBe(400);
    expect(byMember.body.message).toBe(tr("student.selfHasProject", { title: first.title }));

    // ٣. Nobody else can take one of them along.
    const taken = await ask(outsider!.reg, third.id, [member!.reg]);
    expect(taken.status).toBe(400);
    expect(taken.body.message).toBe(tr("student.memberHasProject", { reg: member!.reg }));

    // ٤. Nor can the administration accept the ended one now.
    await request(app).patch(`/api/admin/group-requests/${fallback.id}/accept`).set("Authorization", admin).expect(400);

    // ٥. And the details of other topics are locked for them, as a reserved one is; their own opens.
    const locked = await request(app).get(`/api/public/topics/${third.id}`).set("Authorization", await as(member!.reg));
    expect(locked.status).toBe(403);
    expect(locked.body).toMatchObject({ errorCode: "TOPIC_PLACED", message: tr("public.topicPlaced", { title: first.title }) });
    const own = await request(app).get(`/api/public/topics/${first.id}`).set("Authorization", await as(leader!.reg)).expect(200);
    expect(own.body.topic.id).toBe(first.id);
    // Anyone without a thesis still reads it.
    await request(app).get(`/api/public/topics/${third.id}`).set("Authorization", await as(outsider!.reg)).expect(200);

    // Nothing more was written: one project, no live request of theirs but the accepted one.
    expect(await prisma.projectMember.count({ where: { studentId: { in: [leader!.id, member!.id] } } })).toBe(2);
    const live = await prisma.groupRequest.findMany({
      where: { status: { in: ["pending", "accepted"] }, members: { some: { studentId: { in: [leader!.id, member!.id] } } } },
      select: { id: true },
    });
    expect(live.map((r) => r.id)).toEqual([chosen.id]);
  });

  it("وقبل القبول: من هو في طلبٍ حيٍّ لفريقٍ آخر لا يُضاف زميلاً", async () => {
    const [, , , a, b, c] = f.students;
    const [one, two] = await Promise.all([makeTopic(f, "TEAM live one", "open", 3), makeTopic(f, "TEAM live two", "open", 3)]);
    await ask(a!.reg, one.id, [b!.reg]).then((r) => expect(r.status).toBe(201));

    const res = await ask(c!.reg, two.id, [b!.reg]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(tr("student.memberInOtherTeam", { reg: b!.reg }));
  });
});
