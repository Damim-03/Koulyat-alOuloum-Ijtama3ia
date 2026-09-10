/**
 * وجه الطالب — التصفّح وطلب المجموعة والمشروع.
 *
 * سبعة مسارات فقط، لكنها **كل ما يراه الطالب من النظام**. ومنطقها مُختبَر
 * جزئياً في اختبارات التكامل التي تستدعي الخدمات مباشرة — أمّا هذه فتمرّ
 * بالـHTTP كاملاً: الترشيح والتحقّق من المدخلات وشكل الردّ.
 *
 * وثلاثة أسئلة تحكم الوحدة كلّها:
 *
 *   ماذا يرى الطالب؟ — المتاح وحده، لا المؤرشف ولا المحجوز ولا قيد الانتظار
 *   ماذا يستطيع؟   — طلبٌ واحد على موضوع متاح، بفريق صحيح
 *   وماذا يملك؟    — طلبه هو ومشروعه هو، لا طلب غيره
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
const tok: Record<string, string> = {};

const as = (r: request.Test, who: string) =>
  r.set("Authorization", `Bearer ${tok[who]}`);

const login = async (reg: string) =>
  (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;

/** موضوعٌ بالحالة المطلوبة على تخصّص الطلبة. */
async function topic(title: string, status: string, maxStudents = 3) {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents,
      status: status as never,
      publishedAt: status === "open" ? new Date() : null,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
}

const rows = (body: unknown): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body;
  const o = body as Record<string, unknown>;
  for (const v of Object.values(o)) if (Array.isArray(v)) return v;
  return [];
};
const ids = (body: unknown) => rows(body).map((r) => r.id as string);

let me: { id: string; userId: string; reg: string };
let mate: { id: string; userId: string; reg: string };
let stranger: { id: string; userId: string; reg: string };

beforeAll(async () => {
  await teardown();
  f = await seed(40);
  [me, mate, stranger] = f.nextStudents(3);

  tok.me = await login(me.reg);
  tok.mate = await login(mate.reg);
  tok.stranger = await login(stranger.reg);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ التصفّح: ماذا يرى الطالب ═══
//

describe("GET /api/student/topics", () => {
  it("يعرض المتاح — المعتمَد والمنشور", async () => {
    const approved = await topic("STU approved", "approved");
    const open = await topic("STU open", "open");

    const res = await as(request(app).get("/api/student/topics"), "me").expect(
      200,
    );
    expect(ids(res.body)).toEqual(
      expect.arrayContaining([approved.id, open.id]),
    );
  });

  it.each([
    ["pending", "قيد الانتظار"],
    ["rejected", "مرفوض"],
    ["archived", "مؤرشف"],
  ])("ولا يعرض ما هو %s", async (status) => {
    const hidden = await topic(`STU hidden-${status}`, status);

    const res = await as(request(app).get("/api/student/topics"), "me").expect(
      200,
    );
    expect(ids(res.body)).not.toContain(hidden.id);
  });

  it("ولا يعرض موضوعاً يحجزه طلب فريق حيّ", async () => {
    const taken = await topic("STU claimed", "open");
    await as(
      request(app)
        .post("/api/student/group-requests")
        .send({
          topicId: taken.id,
          memberRegistrationNumbers: [mate.reg],
          priority: 1,
        }),
      "me",
    ).expect(201);

    const res = await as(
      request(app).get("/api/student/topics"),
      "stranger",
    ).expect(200);
    expect(ids(res.body)).not.toContain(taken.id);
  });

  it("ويُرشّح بالتخصّص والبحث", async () => {
    const t = await topic("STU searchable-xyzzy", "open");

    const bySearch = await as(
      request(app).get("/api/student/topics").query({ search: "xyzzy" }),
      "me",
    ).expect(200);
    expect(ids(bySearch.body)).toContain(t.id);

    const bySpec = await as(
      request(app)
        .get("/api/student/topics")
        .query({ specializationId: "00000000-0000-0000-0000-000000000000" }),
      "me",
    ).expect(200);
    expect(ids(bySpec.body)).not.toContain(t.id);
  });
});

describe("GET /api/student/topics/:id", () => {
  it("موضوع متاح ⇒ 200", async () => {
    const t = await topic("STU detail", "open");
    await as(request(app).get(`/api/student/topics/${t.id}`), "me").expect(200);
  });

  /** موضوع لم يُعتمد بعد ليس للطالب أن يراه ولو بالرابط المباشر. */
  it("وموضوع قيد الانتظار ⇒ يُرفض ولو بالرابط المباشر", async () => {
    const t = await topic("STU detail-pending", "pending");
    const res = await as(
      request(app).get(`/api/student/topics/${t.id}`),
      "me",
    );
    expect([401, 403, 404]).toContain(res.status);
  });

  it("وموضوع غير موجود ⇒ 404", async () => {
    await as(
      request(app).get(
        "/api/student/topics/00000000-0000-0000-0000-000000000000",
      ),
      "me",
    ).expect(404);
  });
});

//
// ═══ البحث عن زميل ═══
//

describe("GET /api/student/students/lookup", () => {
  it("رقم تسجيل موجود ⇒ اسمٌ ورقم، بلا بريد ولا كلمة سرّ", async () => {
    const res = await as(
      request(app).get("/api/student/students/lookup").query({ registration: mate.reg }),
      "me",
    ).expect(200);

    const body = JSON.stringify(res.body);
    expect(body).toContain(mate.reg);
    expect(body).not.toContain("password");
    expect(body).not.toContain("$2a$");
    expect(body).not.toContain("@test.local");
  });

  it("ورقم غير موجود ⇒ 200 بنتيجة فارغة لا خطأ", async () => {
    const res = await as(
      request(app)
        .get("/api/student/students/lookup")
        .query({ registration: `${TAG}-NOBODY` }),
      "me",
    ).expect(200);
    expect(JSON.stringify(res.body)).not.toContain(`${TAG}-NOBODY`);
  });

  it("ورقم فارغ ⇒ 400", async () => {
    const res = await as(
      request(app).get("/api/student/students/lookup").query({ registration: "" }),
      "me",
    );
    expect([400, 422]).toContain(res.status);
  });
});

//
// ═══ طلب المجموعة ═══
//

describe("POST /api/student/group-requests", () => {
  it("موضوع متاح وفريق صحيح ⇒ 201، ويحجز الموضوع", async () => {
    const t = await topic("STU request-ok", "open");

    const res = await as(
      request(app)
        .post("/api/student/group-requests")
        .send({
          topicId: t.id,
          memberRegistrationNumbers: [mate.reg],
          priority: 1,
        }),
      "me",
    ).expect(201);

    const created = await prisma.groupRequest.findFirst({
      where: { topicId: t.id },
    });
    expect(created?.status).toBe("pending");
    expect(created?.leaderStudentId).toBe(me.id);
    expect(created?.activeTopicId).toBe(t.id); // الحجز
    expect(res.body).toBeTruthy();
  });

  it("وموضوع محجوز بالفعل ⇒ 400", async () => {
    const t = await topic("STU request-taken", "open");
    const [a, b, c] = f.nextStudents(3);
    const first = await login(a.reg);

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${first}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [b.reg],
        priority: 1,
      })
      .expect(201);

    const second = await login(c.reg);
    const res = await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${second}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [b.reg],
        priority: 1,
      });
    expect(res.status).toBe(400);
  });

  it.each([["pending"], ["rejected"], ["archived"]])(
    "وموضوع %s لا يُطلَب",
    async (status) => {
      const t = await topic(`STU request-${status}`, status);
      const [x, y] = f.nextStudents(2);
      const who = await login(x.reg);

      const res = await request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${who}`)
        .send({
          topicId: t.id,
          memberRegistrationNumbers: [y.reg],
          priority: 1,
        });
      expect(res.status).toBe(400);
    },
  );

  it("ورقم تسجيل غير موجود بين الأعضاء ⇒ 400", async () => {
    const t = await topic("STU request-badmember", "open");
    const [x] = f.nextStudents(1);
    const who = await login(x.reg);

    const res = await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [`${TAG}-GHOST`],
        priority: 1,
      });
    expect(res.status).toBe(400);
  });

  it("وجسم بلا موضوع ⇒ 400 لا 500", async () => {
    const res = await as(
      request(app).post("/api/student/group-requests").send({ priority: 1 }),
      "me",
    );
    expect(res.status).toBe(400);
  });

  it("وموضوع غير موجود ⇒ 404", async () => {
    const [x, y] = f.nextStudents(2);
    const who = await login(x.reg);

    const res = await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .send({
        topicId: "00000000-0000-0000-0000-000000000000",
        memberRegistrationNumbers: [y.reg],
        priority: 1,
      });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/student/group-requests", () => {
  it("يعرض طلبي أنا لا طلبات غيري", async () => {
    const t = await topic("STU mine", "open");
    const [x, y] = f.nextStudents(2);
    const who = await login(x.reg);

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [y.reg],
        priority: 1,
      })
      .expect(201);

    const mineList = await request(app)
      .get("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .expect(200);
    expect(JSON.stringify(mineList.body)).toContain("STU mine");

    const other = await as(
      request(app).get("/api/student/group-requests"),
      "stranger",
    ).expect(200);
    expect(JSON.stringify(other.body)).not.toContain("STU mine");
  });
});

describe("DELETE /api/student/group-requests/:id", () => {
  /** يُنشئ طلباً ويُعيد معرّفه ورمز صاحبه. */
  async function aRequest(title: string) {
    const t = await topic(title, "open");
    const [leader, member] = f.nextStudents(2);
    const bearer = await login(leader.reg);

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${bearer}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [member.reg],
        priority: 1,
      })
      .expect(201);

    const row = (await prisma.groupRequest.findFirst({
      where: { topicId: t.id },
    }))!;
    return { id: row.id, bearer, topicId: t.id };
  }

  it("المرسِل يلغي طلبه، فيتحرّر الموضوع", async () => {
    const { id, bearer, topicId } = await aRequest("STU cancel");

    await request(app)
      .delete(`/api/student/group-requests/${id}`)
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);

    expect(
      await prisma.groupRequest.findUnique({ where: { id } }),
    ).toBeNull();

    // والموضوع عاد للتداول.
    const res = await as(
      request(app).get("/api/student/topics"),
      "stranger",
    ).expect(200);
    expect(ids(res.body)).toContain(topicId);
  });

  it("وطالبٌ آخر لا يلغي طلباً ليس له", async () => {
    const { id } = await aRequest("STU cancel-other");

    const res = await as(
      request(app).delete(`/api/student/group-requests/${id}`),
      "stranger",
    );
    expect([401, 403]).toContain(res.status);
    expect(await prisma.groupRequest.findUnique({ where: { id } })).not.toBeNull();
  });

  it("وطلبٌ بُتَّ فيه لا يُلغى", async () => {
    const { id, bearer } = await aRequest("STU cancel-decided");
    await prisma.groupRequest.update({
      where: { id },
      data: { status: "accepted" },
    });

    const res = await request(app)
      .delete(`/api/student/group-requests/${id}`)
      .set("Authorization", `Bearer ${bearer}`);
    expect(res.status).toBe(400);
  });
});

//
// ═══ مشروعي ═══
//

describe("GET /api/student/my-project", () => {
  it("بلا مشروع ⇒ 200 بقيمة فارغة، لا 404", async () => {
    const res = await as(
      request(app).get("/api/student/my-project"),
      "stranger",
    ).expect(200);

    // الردّ `{ project: null }` — والمفتاح موجود دائماً، فتعرف الواجهة
    // أن الطلب نجح وأن لا مشروع، لا أن شيئاً أخفق.
    expect(res.body).toHaveProperty("project");
    expect(res.body.project).toBeNull();
  });

  it("ومع مشروع ⇒ يُعيد مجموعته هو", async () => {
    const t = await topic("STU my-project", "full");
    const group = await prisma.projectGroup.create({
      data: { topicId: t.id },
    });
    const [member] = f.nextStudents(1);
    await prisma.projectMember.create({
      data: { groupId: group.id, studentId: member.id, isLeader: true },
    });
    const bearer = await login(member.reg);

    const res = await request(app)
      .get("/api/student/my-project")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);

    expect(JSON.stringify(res.body)).toContain("STU my-project");
  });
});
