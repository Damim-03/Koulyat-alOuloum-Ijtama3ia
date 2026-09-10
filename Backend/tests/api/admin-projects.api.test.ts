/**
 * الإدارة — طلبات المجموعات والمشاريع والمواضيع، عبر HTTP.
 *
 * منطق هذا المجال مُختبَر أصلاً في `tests/integration/topic-status.test.ts`
 * بخمسة وثلاثين ثابتاً. فما الذي يبقى؟
 *
 * **العقد.** تلك تستدعي الخدمات مباشرة، فلا تعرف شيئاً عن رمز الحالة الذي
 * يصل العميل، ولا عن وصول رسالة الرفض إليه، ولا عن شكل الحمولة التي تبني
 * عليها الواجهة أزرارها. وقد كلّف ذلك المشروع شهراً: الواجهة عرضت «فشل
 * الحذف» بدل «أرشفه بدلاً من ذلك» — والفرق يقع في هذه الطبقة لا في الخدمات.
 *
 * فالسؤال هنا ليس «هل المنطق صحيح؟» — أُجيب عنه — بل:
 *
 *   > هل يصل الجواب إلى من يحتاجه، بالشكل الذي يفهمه؟
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

const as = (r: request.Test, who = "admin") =>
  r.set("Authorization", `Bearer ${tok[who]}`);

const rows = (body: unknown): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body;
  const o = body as Record<string, unknown>;
  for (const v of Object.values(o)) if (Array.isArray(v)) return v;
  return [];
};

async function topic(title: string, status = "open") {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents: 3,
      status: status as never,
      publishedAt: status === "open" ? new Date() : null,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
}

/** موضوعٌ عليه طلب فريق معلّق. */
async function withPendingRequest(title: string) {
  const t = await topic(title);
  const [leader, member] = f.nextStudents(2);
  const bearer = (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: leader.reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;

  await request(app)
    .post("/api/student/group-requests")
    .set("Authorization", `Bearer ${bearer}`)
    .send({
      topicId: t.id,
      memberRegistrationNumbers: [member.reg],
      priority: 1,
    })
    .expect(201);

  const req = (await prisma.groupRequest.findFirst({
    where: { topicId: t.id },
  }))!;
  return { topic: t, request: req, leader, member };
}

/** موضوعٌ قُبل طلبه، فصار مشروعاً. */
async function acceptedProject(title: string) {
  const made = await withPendingRequest(title);
  await as(
    request(app).patch(`/api/admin/group-requests/${made.request.id}/accept`),
  ).expect(200);
  const group = (await prisma.projectGroup.findUnique({
    where: { topicId: made.topic.id },
  }))!;
  return { ...made, group };
}

beforeAll(async () => {
  await teardown();
  f = await seed(60);

  tok.admin = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ طلبات المجموعات ═══
//

describe("GET /api/admin/group-requests", () => {
  it("تعرض الطلبات المعلّقة بأعضائها ومرسِلها", async () => {
    const { topic: t, leader } = await withPendingRequest("APJ list");

    const res = await as(
      request(app).get("/api/admin/group-requests").query({ status: "pending" }),
    ).expect(200);

    const body = JSON.stringify(res.body);
    expect(body).toContain(t.title);
    expect(body).toContain(leader.reg);
  });

  it("وطلبٌ بعينه ⇒ 200، وغير موجود ⇒ 404", async () => {
    const { request: r } = await withPendingRequest("APJ single");
    await as(request(app).get(`/api/admin/group-requests/${r.id}`)).expect(200);
    await as(
      request(app).get(
        "/api/admin/group-requests/00000000-0000-0000-0000-000000000000",
      ),
    ).expect(404);
  });
});

describe("PATCH /api/admin/group-requests/:id/accept", () => {
  it("القبول ⇒ 200، وتتشكّل المجموعة بقائدها، ويصير الموضوع full", async () => {
    const { topic: t, request: r, leader } = await withPendingRequest("APJ accept");

    await as(
      request(app).patch(`/api/admin/group-requests/${r.id}/accept`),
    ).expect(200);

    const group = await prisma.projectGroup.findUnique({
      where: { topicId: t.id },
      include: { members: true },
    });
    expect(group).not.toBeNull();
    expect(group!.members).toHaveLength(2);
    expect(group!.members.filter((m) => m.isLeader)).toHaveLength(1);
    expect(group!.members.find((m) => m.isLeader)!.studentId).toBe(leader.id);

    const after = await prisma.graduationTopic.findUnique({ where: { id: t.id } });
    expect(after!.status).toBe("full");
  });

  it("وقبولٌ ثانٍ لنفس الطلب ⇒ 400", async () => {
    const { request: r } = await acceptedProject("APJ accept-twice");
    const res = await as(
      request(app).patch(`/api/admin/group-requests/${r.id}/accept`),
    );
    expect(res.status).toBe(400);
  });

  it("وطلبٌ غير موجود ⇒ 404", async () => {
    await as(
      request(app).patch(
        "/api/admin/group-requests/00000000-0000-0000-0000-000000000000/accept",
      ),
    ).expect(404);
  });
});

describe("PATCH /api/admin/group-requests/:id/reject", () => {
  it("الرفض ⇒ 200، ويعود الموضوع للتداول", async () => {
    const { topic: t, request: r } = await withPendingRequest("APJ reject");

    await as(
      request(app)
        .patch(`/api/admin/group-requests/${r.id}/reject`)
        .send({ rejectionReason: "الفريق غير مكتمل" }),
    ).expect(200);

    expect(await prisma.groupRequest.findUnique({ where: { id: r.id } })).toBeNull();

    const list = await as(
      request(app).get("/api/admin/topics").query({ search: `${TAG} APJ reject` }),
    ).expect(200);
    const row = rows(list.body).find((x) => x.id === t.id) as
      | { occupancy?: { hasPendingRequest: boolean } }
      | undefined;
    expect(row?.occupancy?.hasPendingRequest).toBe(false);
  });

  /**
   * رفض طلبٍ صار مشروعاً ليس رفضاً بل حذفٌ للأثر من تحت مشروع حيّ. والرسالة
   * توجّه إلى الإجراء الصحيح — وهذا ما يجب أن يصل الواجهة نصّاً لا رمزاً.
   */
  it("ورفضُ طلبٍ صار مشروعاً ⇒ 400 مع توجيه إلى الفسخ", async () => {
    const { request: r } = await acceptedProject("APJ reject-accepted");

    const res = await as(
      request(app).patch(`/api/admin/group-requests/${r.id}/reject`),
    ).expect(400);

    expect(res.body.message).toContain("فسخ");
  });
});

describe("تعديل أعضاء الطلب قبل البتّ", () => {
  it("يُزال عضو، ويُغيَّر المرسِل", async () => {
    const t = await topic("APJ members");
    const [leader, m2, m3] = f.nextStudents(3);
    const bearer = (
      await request(app)
        .post("/api/auth/student/login")
        .send({ registrationNumber: leader.reg, password: TEST_PASSWORD })
        .expect(200)
    ).body.accessToken;

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${bearer}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [m2.reg, m3.reg],
        priority: 1,
      })
      .expect(201);

    const r = (await prisma.groupRequest.findFirst({ where: { topicId: t.id } }))!;

    await as(
      request(app).delete(`/api/admin/group-requests/${r.id}/members/${m3.id}`),
    ).expect(200);
    expect(
      await prisma.groupRequestMember.count({ where: { requestId: r.id } }),
    ).toBe(2);

    await as(
      request(app).patch(`/api/admin/group-requests/${r.id}/leader/${m2.id}`),
    ).expect(200);
    expect(
      (await prisma.groupRequest.findUnique({ where: { id: r.id } }))!
        .leaderStudentId,
    ).toBe(m2.id);
  });

  it("ولا يُزال المرسِل نفسه ⇒ 400", async () => {
    const { request: r, leader } = await withPendingRequest("APJ drop-leader");
    const res = await as(
      request(app).delete(
        `/api/admin/group-requests/${r.id}/members/${leader.id}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("ولا يُعدَّل الطلب بعد قبوله ⇒ 400", async () => {
    const { request: r, member } = await acceptedProject("APJ edit-accepted");
    const res = await as(
      request(app).delete(
        `/api/admin/group-requests/${r.id}/members/${member.id}`,
      ),
    );
    expect(res.status).toBe(400);
  });
});

//
// ═══ المشاريع ═══
//

describe("GET /api/admin/projects", () => {
  it("القائمة تعرض المشروع بموضوعه وأعضائه", async () => {
    const { topic: t, leader } = await acceptedProject("APJ project-list");

    const res = await as(request(app).get("/api/admin/projects")).expect(200);
    const body = JSON.stringify(res.body);
    expect(body).toContain(t.title);
    expect(body).toContain(leader.reg);
  });

  it("ومشروعٌ بعينه ⇒ 200، وغير موجود ⇒ 404", async () => {
    const { group } = await acceptedProject("APJ project-single");
    await as(request(app).get(`/api/admin/projects/${group.id}`)).expect(200);
    await as(
      request(app).get(
        "/api/admin/projects/00000000-0000-0000-0000-000000000000",
      ),
    ).expect(404);
  });
});

describe("تصحيح طاقم المشروع", () => {
  it("تغيير المشرف ⇒ 200، وينتقل الموضوع إلى الأستاذ الجديد", async () => {
    const { topic: t, group } = await acceptedProject("APJ supervisor");

    await as(
      request(app)
        .patch(`/api/admin/projects/${group.id}/supervisor`)
        .send({ professorId: f.professor2.id }),
    ).expect(200);

    expect(
      (await prisma.graduationTopic.findUnique({ where: { id: t.id } }))!
        .professorId,
    ).toBe(f.professor2.id);
  });

  it("وأستاذٌ غير موجود ⇒ 404", async () => {
    const { group } = await acceptedProject("APJ supervisor-404");
    await as(
      request(app)
        .patch(`/api/admin/projects/${group.id}/supervisor`)
        .send({ professorId: "00000000-0000-0000-0000-000000000000" }),
    ).expect(404);
  });

  it("وإسناد طالب ⇒ 200، وتكراره ⇒ 400", async () => {
    const { group } = await acceptedProject("APJ assign");
    const [extra] = f.nextStudents(1);

    await as(
      request(app)
        .post(`/api/admin/projects/${group.id}/assign`)
        .send({ studentId: extra.id }),
    ).expect(200);

    const again = await as(
      request(app)
        .post(`/api/admin/projects/${group.id}/assign`)
        .send({ studentId: extra.id }),
    );
    expect(again.status).toBe(400);
  });

  it("وتجاوز الحدّ الأقصى ⇒ 400 برسالة تذكر الحدّ", async () => {
    const { group } = await acceptedProject("APJ capacity");
    const [third, fourth] = f.nextStudents(2);

    // maxStudents=3 والمجموعة فيها 2 ⇒ الثالث يمرّ.
    await as(
      request(app)
        .post(`/api/admin/projects/${group.id}/assign`)
        .send({ studentId: third.id }),
    ).expect(200);

    const res = await as(
      request(app)
        .post(`/api/admin/projects/${group.id}/assign`)
        .send({ studentId: fourth.id }),
    ).expect(400);
    expect(res.body.message).toMatch(/\d/);
  });

  it("وتعيين قائد من أعضاء المشروع ⇒ 200، ومن خارجه ⇒ 400", async () => {
    const { group, member } = await acceptedProject("APJ leader");
    const [outsider] = f.nextStudents(1);

    await as(
      request(app).patch(`/api/admin/projects/${group.id}/leader/${member.id}`),
    ).expect(200);
    const leaders = await prisma.projectMember.findMany({
      where: { groupId: group.id, isLeader: true },
    });
    expect(leaders).toHaveLength(1);
    expect(leaders[0].studentId).toBe(member.id);

    const res = await as(
      request(app).patch(
        `/api/admin/projects/${group.id}/leader/${outsider.id}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  /** إزالة آخر عضو ليست إزالة بل فسخ — والرسالة توجّه إلى الإجراء الصحيح. */
  it("وإزالة آخر عضو ⇒ 400 مع توجيه إلى الفسخ", async () => {
    const { group, leader, member } = await acceptedProject("APJ last-member");

    await as(
      request(app).delete(`/api/admin/projects/${group.id}/members/${leader.id}`),
    ).expect(200);

    const res = await as(
      request(app).delete(`/api/admin/projects/${group.id}/members/${member.id}`),
    ).expect(400);
    expect(res.body.message).toContain("فسخ");

    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).not.toBeNull();
  });
});

describe("DELETE /api/admin/projects/:id — الفسخ", () => {
  it("مشروعٌ نظيف يُفسَخ ⇒ 200، ويُبلَّغ بما حُذف، ويعود الموضوع للتداول", async () => {
    const { topic: t, group } = await acceptedProject("APJ dissolve");

    const res = await as(
      request(app)
        .delete(`/api/admin/projects/${group.id}`)
        .send({ reason: "قُبل الفريق الخطأ" }),
    ).expect(200);

    expect(res.body.removedMembers).toBe(2);
    expect(res.body.topicStatus).toBe("open");

    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).toBeNull();
    expect(
      (await prisma.graduationTopic.findUnique({ where: { id: t.id } }))!.status,
    ).toBe("open");
  });

  it("ومشروعٌ عليه تسليم ⇒ 400 مع ذكر ما يمنع", async () => {
    const { group, leader } = await acceptedProject("APJ dissolve-blocked");

    const milestone = await prisma.milestone.create({
      data: {
        title: `${TAG} مرحلة`,
        deadline: new Date(Date.now() + 86_400_000),
        order: 1,
        groupId: group.id,
      },
    });
    const leaderUser = (await prisma.student.findUnique({
      where: { id: leader.id },
      select: { userId: true },
    }))!;
    await prisma.submission.create({
      data: {
        fileUrl: "/uploads/x.pdf",
        fileName: "x.pdf",
        version: 1,
        milestoneId: milestone.id,
        uploadedById: leaderUser.userId,
      },
    });

    const res = await as(
      request(app).delete(`/api/admin/projects/${group.id}`),
    ).expect(400);
    expect(res.body.message).toContain("تسليم");

    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).not.toBeNull();

    await prisma.submission.deleteMany({ where: { milestoneId: milestone.id } });
  });
});

//
// ═══ المراحل ═══
//

describe("مراحل المشروع", () => {
  it("تُنشأ وتُقرأ وتُعدَّل وتُحذف", async () => {
    const { group } = await acceptedProject("APJ milestones");

    const created = await as(
      request(app)
        .post(`/api/admin/projects/${group.id}/milestones`)
        .send({
          title: `${TAG} مرحلة أولى`,
          deadline: new Date(Date.now() + 86_400_000).toISOString(),
          order: 1,
        }),
    );
    expect([200, 201]).toContain(created.status);

    const list = await as(
      request(app).get(`/api/admin/projects/${group.id}/milestones`),
    ).expect(200);
    expect(JSON.stringify(list.body)).toContain("مرحلة أولى");

    const row = (await prisma.milestone.findFirst({
      where: { groupId: group.id },
    }))!;

    await as(
      request(app)
        .patch(`/api/admin/milestones/${row.id}`)
        .send({ title: `${TAG} مرحلة معدَّلة` }),
    ).expect(200);
    expect(
      (await prisma.milestone.findUnique({ where: { id: row.id } }))!.title,
    ).toBe(`${TAG} مرحلة معدَّلة`);

    await as(request(app).delete(`/api/admin/milestones/${row.id}`)).expect(200);
    expect(
      await prisma.milestone.findUnique({ where: { id: row.id } }),
    ).toBeNull();
  });

  it("ومرحلةٌ غير موجودة ⇒ 404", async () => {
    await as(
      request(app).delete(
        "/api/admin/milestones/00000000-0000-0000-0000-000000000000",
      ),
    ).expect(404);
  });
});

//
// ═══ قرارات المواضيع عبر HTTP ═══
//

describe("قرارات الموضوع: الرمز والرسالة يصلان العميل", () => {
  it("الاعتماد والنشر وإلغاء النشر والأرشفة وإلغاؤها", async () => {
    const t = await topic("APJ lifecycle", "pending");

    await as(request(app).patch(`/api/admin/topics/${t.id}/approve`)).expect(200);
    await as(request(app).patch(`/api/admin/topics/${t.id}/publish`)).expect(200);
    await as(request(app).patch(`/api/admin/topics/${t.id}/unpublish`)).expect(200);
    await as(request(app).patch(`/api/admin/topics/${t.id}/publish`)).expect(200);
    await as(request(app).patch(`/api/admin/topics/${t.id}/archive`)).expect(200);
    await as(request(app).patch(`/api/admin/topics/${t.id}/unarchive`)).expect(200);

    // والأرشفة لم تُلغِ النشر.
    expect(
      (await prisma.graduationTopic.findUnique({ where: { id: t.id } }))!.status,
    ).toBe("open");
  });

  it("والرفض يحمل سببه إلى قاعدة البيانات", async () => {
    const t = await topic("APJ reject-reason", "pending");

    await as(
      request(app)
        .patch(`/api/admin/topics/${t.id}/reject`)
        .send({ reason: "الوصف غير كافٍ" }),
    ).expect(200);

    const after = await prisma.graduationTopic.findUnique({ where: { id: t.id } });
    expect(after!.status).toBe("rejected");
    expect(after!.rejectionReason).toBe("الوصف غير كافٍ");
  });

  /**
   * هذا هو التأكيد الذي كلّف غيابُه شهراً: الرسالة التي تشرح **ماذا يُفعل
   * بدلاً** يجب أن تصل العميل نصّاً. الواجهة تعرضها كما هي.
   */
  it("والمنع يصل برسالة تشرح البديل، لا برمزٍ مجرَّد", async () => {
    const { topic: t } = await acceptedProject("APJ blocked-msg");

    const del = await as(request(app).delete(`/api/admin/topics/${t.id}`)).expect(
      400,
    );
    expect(del.body.message).toContain("أرشفه");

    const waiting = await withPendingRequest("APJ blocked-waiting");
    const pub = await as(
      request(app).patch(`/api/admin/topics/${waiting.topic.id}/publish`),
    ).expect(400);
    expect(pub.body.message).toContain("فريق");
  });

  it("وحمولة الموضوع تحمل حكم الخادم على كل إجراء", async () => {
    const { topic: t } = await acceptedProject("APJ actions");

    const res = await as(request(app).get(`/api/admin/topics/${t.id}`)).expect(
      200,
    );

    // الردّ ملفوف في { topic }.
    const { actions, occupancy } = res.body.topic;
    expect(actions.canDelete).toBe(false);
    expect(actions.canArchive).toBe(true);
    expect(occupancy.hasGroup).toBe(true);
    expect(actions.blockedReasons.delete).toBeTruthy();
    expect(actions.blockedCodes.delete.code).toBe("hasGroup");
  });
});
