/**
 * عدد الطلبة في كلّ موضوع، لكلّ مستوى — `/api/admin/academic-years/:id/team-size`.
 *
 * ما يستحقّ حارساً:
 *   ١. بلا قواعد: كلّ موضوعٍ بعدده كما كان؛
 *   ٢. المعاينة تقول ما ستفعله قاعدة كلّ مستوى بمواضيعه ولا تغيّر شيئاً؛ والحفظ
 *      يطبّقها — «بالضبط» يرفع وينزل، و«حتى» ينزل ما تجاوزه وحده — ولا يُخرج
 *      طالباً: ما فيه طلبةٌ أكثر تُغلق مقاعده الشاغرة فقط؛ ومستوى بلا قاعدة لا يُمسّ؛
 *   ٣. ثمّ لا يُقبل ما يخالف قاعدة مستوى الموضوع، من الإدارة ولا من الأستاذ،
 *      بفريقٍ أو بدونه؛ وموضوعٌ سبقها يُعدَّل بعدده كما هو؛ ونقلُه إلى مستوى آخر
 *      يُفحص بقاعدة ذاك؛
 *   ٤. و«الجديدة وحدها» لا تمسّ القائم؛ وإلغاؤها يعيد الحرّية؛
 *   ٥. وللإدارة وحدها، وما لا يصحّ يُردّ.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, makeTopic, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let prof = "";
let licenceSpec = "";

const as = (r: request.Test, token = admin) => r.set("Authorization", `Bearer ${token}`);
const url = (yearId = f.academicYear.id) => `/api/admin/academic-years/${yearId}/team-size`;
const sizeOf = async (id: string) => (await prisma.graduationTopic.findUniqueOrThrow({ where: { id } })).maxStudents;
const NONE = { licence: null, master: null, doctorate: null };

/** A topic of the year — of the fixture's master specialization, or of the licence one — with `members` students already. */
async function topic(title: string, maxStudents: number, members = 0, level: "master" | "licence" = "master") {
  const t = await makeTopic(f, title, members ? "full" : "open", maxStudents);
  if (level === "licence") await prisma.graduationTopic.update({ where: { id: t.id }, data: { specializationId: licenceSpec } });
  if (members) {
    const team = f.nextStudents(members);
    await prisma.projectGroup.create({
      data: { topicId: t.id, members: { create: team.map((s, i) => ({ studentId: s.id, isLeader: i === 0 })) } },
    });
  }
  return t.id;
}

const topicBody = (maxStudents: number, specializationId = f.specialization.id) => ({
  title: `${TAG} مقترح ${maxStudents} ${Math.random().toString(36).slice(2, 7)}`,
  description: `${TAG} وصف`,
  maxStudents,
  specializationId,
  academicYearId: f.academicYear.id,
});

let ids: Record<"mThree" | "mOne" | "mTwo" | "mFullThree" | "mFourWithThree" | "lFour" | "lTwo" | "lOne", string>;

beforeAll(async () => {
  await teardown();
  f = await seed(10);
  admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body.accessToken;
  prof = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
  licenceSpec = (
    await prisma.specialization.create({ data: { name: `${TAG} spec licence`, level: "licence", filiereId: f.specialization.filiereId } })
  ).id;

  ids = {
    mThree: await topic("ماستر ثلاثة", 3),
    mOne: await topic("ماستر واحد", 1),
    mTwo: await topic("ماستر اثنان", 2),
    mFullThree: await topic("ماستر ثلاثة بفريق", 3, 3),
    mFourWithThree: await topic("ماستر أربعة بفريقٍ من ثلاثة", 4, 3),
    lFour: await topic("ليسانس أربعة", 4, 0, "licence"),
    lTwo: await topic("ليسانس اثنان", 2, 0, "licence"),
    lOne: await topic("ليسانس واحد", 1, 0, "licence"),
  };
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("عدد الطلبة في كلّ موضوع — لكلّ مستوى", () => {
  it("بلا قواعد: لا شيء تحتها، وكلّ موضوعٍ بعدده كما كان", async () => {
    const res = await as(request(app).get(url())).expect(200);
    expect(res.body).toMatchObject({ year: { id: f.academicYear.id, teamSizes: null }, stats: { total: 8, topics: 0, matching: 0, differing: 0 } });
    await as(request(app).post("/api/admin/topics")).send({ ...topicBody(5), professorId: f.professor.id }).expect(201);
    await prisma.graduationTopic.deleteMany({ where: { title: { startsWith: `${TAG} مقترح` } } });
  });

  it("المعاينة: ماستر «بالضبط 2» وليسانس «حتى 3» — ما سيتغيّر في كلّ مستوى، ولا يتغيّر شيء", async () => {
    const res = await as(request(app).get(`${url()}/preview`).query({ master: "exact-2", licence: "max-3" })).expect(200);
    expect(res.body).toMatchObject({ total: 8, ruled: 8, matching: 3, changesCount: 3, overCount: 2, pendingOver: 0 });
    const moves = (rows: { id: string; from: number; to: number; level: string }[]) =>
      Object.fromEntries(rows.map((c) => [c.id, [c.level, c.from, c.to]]));
    expect(moves(res.body.changes)).toEqual({
      [ids.mThree]: ["master", 3, 2],
      [ids.mOne]: ["master", 1, 2],
      // «Up to 3»: only what exceeds it comes down; 1 and 2 keep theirs.
      [ids.lFour]: ["licence", 4, 3],
    });
    // More students than the number: nobody leaves; the free seats close.
    expect(moves(res.body.over)).toEqual({ [ids.mFullThree]: ["master", 3, 3], [ids.mFourWithThree]: ["master", 4, 3] });
    // Each level in detail: its topics, the numbers they have now, and what the rule does there.
    expect(res.body.levels).toEqual({
      licence: { total: 3, sizes: { "1": 1, "2": 1, "4": 1 }, ruled: true, matching: 2, changes: 1, over: 0, pendingOver: 0 },
      master: { total: 5, sizes: { "1": 1, "2": 1, "3": 2, "4": 1 }, ruled: true, matching: 1, changes: 2, over: 2, pendingOver: 0 },
      doctorate: { total: 0, sizes: {}, ruled: false, matching: 0, changes: 0, over: 0, pendingOver: 0 },
    });
    // Each row with what the list shows of it: the supervisor's name and face, the specialization, the status, the students.
    const full = res.body.over.find((c: { id: string }) => c.id === ids.mFullThree);
    expect(full).toMatchObject({ specialization: f.specialization.name, status: "full", members: 3, avatar: { avatarUrl: null } });
    expect(full.professor).toBeTruthy();
    // The lists by level: the licence's first.
    expect(res.body.changes.map((c: { level: string }) => c.level)).toEqual(["licence", "master", "master"]);

    // A level without a rule is left out.
    const onlyLicence = await as(request(app).get(`${url()}/preview`).query({ licence: "exact-2" })).expect(200);
    expect(onlyLicence.body).toMatchObject({ ruled: 3, matching: 1, changesCount: 2, overCount: 0 });

    expect(await sizeOf(ids.mThree)).toBe(3);
    expect((await prisma.academicYear.findUniqueOrThrow({ where: { id: f.academicYear.id } })).teamSizes).toBeNull();
  });

  it("الحفظ يطبّقها على مواضيع السنة، ولا يُخرج طالباً", async () => {
    const res = await as(request(app).put(url()))
      .send({ rules: { master: { n: 2, mode: "exact" }, licence: { n: 3, mode: "max" }, doctorate: null }, applyToExisting: true })
      .expect(200);
    expect(res.body).toMatchObject({
      year: { teamSizes: { master: { n: 2, mode: "exact" }, licence: { n: 3, mode: "max" } } },
      applied: { changed: 4 },
      stats: { total: 8, topics: 8, matching: 6, differing: 2 },
    });
    expect(res.body.year.teamSizes).not.toHaveProperty("doctorate");
    expect(await Promise.all(Object.values(ids).map(sizeOf))).toEqual([2, 2, 2, 3, 3, 3, 2, 1]);
    expect(await prisma.projectMember.count({ where: { group: { topicId: { in: [ids.mFullThree, ids.mFourWithThree] } } } })).toBe(6);
  });

  it("ثمّ لا يُقبل ما يخالف قاعدة المستوى — من الإدارة ولا من الأستاذ، بفريقٍ أو بدونه", async () => {
    const refused = await as(request(app).post("/api/admin/topics")).send({ ...topicBody(3), professorId: f.professor.id }).expect(400);
    expect(refused.body.errorCode).toBe("TOPIC_TEAM_SIZE");
    expect(refused.body.message).toContain("2");
    await as(request(app).post("/api/admin/topics")).send({ ...topicBody(2), professorId: f.professor.id }).expect(201);

    // Licence «up to 3»: 1 to 3, not 4.
    const over = await as(request(app).post("/api/professor/topics"), prof).send(topicBody(4, licenceSpec)).expect(400);
    expect(over.body.errorCode).toBe("TOPIC_TEAM_SIZE");
    await as(request(app).post("/api/professor/topics"), prof).send(topicBody(1, licenceSpec)).expect(201);
    await as(request(app).post("/api/professor/topics"), prof).send(topicBody(1)).expect(400);

    const team = f.nextStudents(2);
    const assigned = (maxStudents: number) =>
      as(request(app).post("/api/admin/topics/assigned")).send({
        ...topicBody(maxStudents),
        professorId: f.professor.id,
        memberStudentIds: team.map((s) => s.id),
        leaderStudentId: team[0]!.id,
      });
    await assigned(3).expect(400);
    await assigned(2).expect(201);
  });

  it("وموضوعٌ سبقها يُعدَّل بعدده كما هو؛ ونقلُه إلى مستوى آخر يُفحص بقاعدة ذاك", async () => {
    const patch = (id: string, body: object) => as(request(app).patch(`/api/admin/topics/${id}/assignment`)).send(body);
    await patch(ids.mFullThree, { title: `${TAG} ماستر ثلاثة — عنوانٌ مصحَّح`, maxStudents: 3 }).expect(200);
    expect((await patch(ids.mFullThree, { maxStudents: 4 }).expect(400)).body.errorCode).toBe("TOPIC_TEAM_SIZE");
    // A master topic of 2 moved to licence: 2 is within «up to 3».
    await patch(ids.mTwo, { specializationId: licenceSpec, maxStudents: 2 }).expect(200);
    // And back to master with 3: refused.
    await patch(ids.mTwo, { specializationId: f.specialization.id, maxStudents: 3 }).expect(400);
  });

  it("و«الجديدة وحدها» لا تمسّ القائم؛ وإلغاؤها يعيد الحرّية", async () => {
    const res = await as(request(app).put(url()))
      .send({ rules: { ...NONE, master: { n: 3, mode: "exact" } }, applyToExisting: false })
      .expect(200);
    expect(res.body).toMatchObject({ year: { teamSizes: { master: { n: 3, mode: "exact" } } }, applied: { changed: 0 } });
    expect(await sizeOf(ids.mThree)).toBe(2);

    const cleared = await as(request(app).delete(url())).expect(200);
    expect(cleared.body).toMatchObject({ year: { teamSizes: null }, stats: { topics: 0 } });
    await as(request(app).post("/api/admin/topics")).send({ ...topicBody(5), professorId: f.professor.id }).expect(201);

    // Every level null: no rules, as cleared.
    const none = await as(request(app).put(url())).send({ rules: NONE }).expect(200);
    expect(none.body.year.teamSizes).toBeNull();
  });

  it("للإدارة وحدها، وما لا يصحّ يُردّ", async () => {
    await as(request(app).put(url()), prof).send({ rules: NONE }).expect(403);
    await as(request(app).get(url()), prof).expect(403);
    const bad = [
      { rules: { ...NONE, master: { n: 0, mode: "exact" } } },
      { rules: { ...NONE, master: { n: 11, mode: "max" } } },
      { rules: { ...NONE, master: { n: 2, mode: "about" } } },
      { rules: { master: { n: 2, mode: "exact" } } },
      { teamSize: 2 },
    ];
    for (const body of bad) await as(request(app).put(url())).send(body).expect(400);
    for (const q of [{ master: "exact-0" }, { master: "max-11" }, { licence: "2" }, { master: "about-2" }])
      await as(request(app).get(`${url()}/preview`).query(q)).expect(400);
    await as(request(app).get(url("00000000-0000-4000-8000-000000000000"))).expect(404);
    expect((await prisma.academicYear.findUniqueOrThrow({ where: { id: f.academicYear.id } })).teamSizes).toBeNull();
  });
});
