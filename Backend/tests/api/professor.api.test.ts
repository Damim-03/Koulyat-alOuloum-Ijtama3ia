/**
 * وحدة الأستاذ — الملكية ودورة حياة الموضوع.
 *
 * كانت هذه الوحدة على **٠٪ فروع**: الملفّ يُحمَّل ولا يُتَّخذ فيه قرار واحد.
 * ومعظم قراراتها من نوع واحد: **«هل هذا لك؟»**
 *
 *   لا تملك هذا الموضوع · لا تملك هذه المجموعة · لا تملك هذه المرحلة
 *
 * وهذه ليست تحقّقات شكلية. حارس المسار يمنع الطالب من دخول `/api/professor`،
 * لكنه لا يمنع **أستاذاً من العبث بموضوع أستاذ آخر** — فكلاهما أستاذ، وكلاهما
 * يجتاز البوّابة. الحارس الوحيد هناك هو فحص الملكية في طبقة الخدمة، وهو ما لم
 * يكن يُنفَّذ في أي اختبار.
 *
 * ولا يمكن اختباره بأستاذ واحد: يلزم صاحبٌ ودخيل.
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
let ownerToken: string; // الأستاذ صاحب الموضوع
let intruderToken: string; // أستاذ آخر، شرعيّ لكنه ليس المالك
let studentToken: string;

const asOwner = (r: request.Test) =>
  r.set("Authorization", `Bearer ${ownerToken}`);
const asIntruder = (r: request.Test) =>
  r.set("Authorization", `Bearer ${intruderToken}`);

async function loginProfessor(universityEmail: string) {
  const res = await request(app)
    .post("/api/auth/professor/login")
    .send({ universityEmail, password: TEST_PASSWORD })
    .expect(200);
  return res.body.accessToken as string;
}

/** موضوعٌ يملكه الأستاذ الأوّل، بالحالة المطلوبة. */
async function ownedTopic(title: string, status = "pending") {
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

beforeAll(async () => {
  await teardown();
  f = await seed(4);
  ownerToken = await loginProfessor(f.professor.universityEmail);
  intruderToken = await loginProfessor(f.professor2.universityEmail);

  studentToken = (
    await request(app)
      .post("/api/auth/student/login")
      .send({
        registrationNumber: f.students[0].reg,
        password: TEST_PASSWORD,
      })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ بوّابة المسار ═══
//

describe("بوّابة /api/professor", () => {
  it("بلا رمز ⇒ 401", async () => {
    await request(app).get("/api/professor/topics").expect(401);
  });

  it("برمز طالب ⇒ 403", async () => {
    await request(app)
      .get("/api/professor/topics")
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);
  });

  it("وبرمز أستاذ ⇒ 200", async () => {
    await asOwner(request(app).get("/api/professor/topics")).expect(200);
  });
});

//
// ═══ الملكية — قلب الوحدة ═══
//

describe("أستاذٌ آخر لا يمسّ موضوعاً ليس له", () => {
  it("قراءة موضوع غيره ⇒ يُرفض", async () => {
    const topic = await ownedTopic("PROF read");
    const res = await asIntruder(
      request(app).get(`/api/professor/topics/${topic.id}`),
    );
    expect([401, 403]).toContain(res.status);
  });

  it("تعديل موضوع غيره ⇒ يُرفض، ولا يتغيّر شيء", async () => {
    const topic = await ownedTopic("PROF update");

    const res = await asIntruder(
      request(app)
        .put(`/api/professor/topics/${topic.id}`)
        .send({ title: "عنوان الدخيل" }),
    );
    expect([401, 403]).toContain(res.status);

    const after = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(after?.title).toBe(topic.title);
  });

  it("حذف موضوع غيره ⇒ يُرفض، والموضوع باقٍ", async () => {
    const topic = await ownedTopic("PROF delete");

    const res = await asIntruder(
      request(app).delete(`/api/professor/topics/${topic.id}`),
    );
    expect([401, 403]).toContain(res.status);

    expect(
      await prisma.graduationTopic.findUnique({ where: { id: topic.id } }),
    ).not.toBeNull();
  });

  it("وقائمة «مواضيعي» تعرض مواضيعه هو لا مواضيع غيره", async () => {
    const mine = await ownedTopic("PROF mine");

    const ownerList = await asOwner(
      request(app).get("/api/professor/topics"),
    ).expect(200);
    const intruderList = await asIntruder(
      request(app).get("/api/professor/topics"),
    ).expect(200);

    // الردّ يلفّ القائمة في { topics }.
    const ids = (body: unknown) =>
      ((body as { topics: { id: string }[] }).topics ?? []).map((t) => t.id);

    expect(ids(ownerList.body)).toContain(mine.id);
    expect(ids(intruderList.body)).not.toContain(mine.id);
  });
});

describe("أستاذٌ آخر لا يمسّ مجموعةً ولا مرحلةً ليست له", () => {
  /** مشروعٌ على موضوع الأستاذ الأوّل، وله مرحلة. */
  async function ownedGroupWithMilestone() {
    const topic = await ownedTopic("PROF group", "approved");
    const group = await prisma.projectGroup.create({
      data: { topicId: topic.id },
    });
    const milestone = await prisma.milestone.create({
      data: {
        title: `${TAG} مرحلة`,
        deadline: new Date(Date.now() + 86_400_000),
        order: 1,
        groupId: group.id,
      },
    });
    return { topic, group, milestone };
  }

  it("قراءة مجموعة غيره ⇒ يُرفض", async () => {
    const { group } = await ownedGroupWithMilestone();
    const res = await asIntruder(
      request(app).get(`/api/professor/groups/${group.id}`),
    );
    expect([401, 403]).toContain(res.status);
  });

  it("قراءة مراحل مجموعة غيره ⇒ يُرفض", async () => {
    const { group } = await ownedGroupWithMilestone();
    const res = await asIntruder(
      request(app).get(`/api/professor/groups/${group.id}/milestones`),
    );
    expect([401, 403]).toContain(res.status);
  });

  it("إضافة مرحلة إلى مجموعة غيره ⇒ يُرفض، ولا تُنشأ", async () => {
    const { group } = await ownedGroupWithMilestone();
    const before = await prisma.milestone.count({
      where: { groupId: group.id },
    });

    const res = await asIntruder(
      request(app)
        .post(`/api/professor/groups/${group.id}/milestones`)
        .send({
          title: "مرحلة الدخيل",
          deadline: new Date(Date.now() + 86_400_000).toISOString(),
          order: 2,
        }),
    );
    expect([401, 403]).toContain(res.status);

    expect(
      await prisma.milestone.count({ where: { groupId: group.id } }),
    ).toBe(before);
  });

  it("والمالك يفعل كل ذلك بنجاح — فالرفض للملكية لا لعطل", async () => {
    const { group } = await ownedGroupWithMilestone();

    await asOwner(request(app).get(`/api/professor/groups/${group.id}`)).expect(
      200,
    );
    await asOwner(
      request(app).get(`/api/professor/groups/${group.id}/milestones`),
    ).expect(200);
    await asOwner(
      request(app)
        .post(`/api/professor/groups/${group.id}/milestones`)
        .send({
          title: `${TAG} مرحلة المالك`,
          deadline: new Date(Date.now() + 86_400_000).toISOString(),
          order: 2,
        }),
    ).expect(201);
  });
});

//
// ═══ دورة حياة الموضوع ═══
//

describe("إنشاء الموضوع", () => {
  it("يُنشأ «قيد الانتظار» دائماً — الأستاذ لا يعتمد موضوعه بنفسه", async () => {
    const res = await asOwner(
      request(app)
        .post("/api/professor/topics")
        .send({
          title: `${TAG} PROF created`,
          description: "وصف",
          maxStudents: 3,
          specializationId: f.specialization.id,
          academicYearId: f.academicYear.id,
        }),
    );
    expect([200, 201]).toContain(res.status);

    const created = await prisma.graduationTopic.findFirst({
      where: { title: `${TAG} PROF created` },
    });
    expect(created?.status).toBe("pending");
    expect(created?.professorId).toBe(f.professor.id);
  });

  it("ولا يستطيع نسبته إلى أستاذ آخر", async () => {
    await asIntruder(
      request(app)
        .post("/api/professor/topics")
        .send({
          title: `${TAG} PROF forged-owner`,
          description: "وصف",
          maxStudents: 3,
          specializationId: f.specialization.id,
          academicYearId: f.academicYear.id,
          professorId: f.professor.id, // محاولة نسبته للأوّل
        }),
    );

    const created = await prisma.graduationTopic.findFirst({
      where: { title: `${TAG} PROF forged-owner` },
    });
    // إن أُنشئ فهو للمُرسِل، لا لمن ادّعى.
    if (created) expect(created.professorId).toBe(f.professor2.id);
  });

  it("جسم ناقص ⇒ 400 لا 500", async () => {
    const res = await asOwner(
      request(app).post("/api/professor/topics").send({ title: "بلا بقيّة" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("التعديل والحذف محكومان بالحالة", () => {
  it.each([
    ["approved", "معتمَد"],
    ["open", "منشور"],
    ["full", "مكتمل"],
  ])("موضوع %s لا يُعدَّل", async (status) => {
    const topic = await ownedTopic(`PROF edit-${status}`, status);

    const res = await asOwner(
      request(app)
        .put(`/api/professor/topics/${topic.id}`)
        .send({ title: "محاولة تعديل" }),
    );
    expect([401, 403]).toContain(res.status);

    const after = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(after?.title).toBe(topic.title);
  });

  it.each([
    ["approved", "معتمَد"],
    ["open", "منشور"],
  ])("وموضوع %s لا يُحذف", async (status) => {
    const topic = await ownedTopic(`PROF del-${status}`, status);

    const res = await asOwner(
      request(app).delete(`/api/professor/topics/${topic.id}`),
    );
    expect([401, 403]).toContain(res.status);

    expect(
      await prisma.graduationTopic.findUnique({ where: { id: topic.id } }),
    ).not.toBeNull();
  });

  it("والموضوع قيد الانتظار يُعدَّل ويُحذف", async () => {
    const editable = await ownedTopic("PROF pending-edit");
    await asOwner(
      request(app)
        .put(`/api/professor/topics/${editable.id}`)
        .send({ title: `${TAG} PROF edited` }),
    ).expect(200);
    expect(
      (
        await prisma.graduationTopic.findUnique({ where: { id: editable.id } })
      )?.title,
    ).toBe(`${TAG} PROF edited`);

    const deletable = await ownedTopic("PROF pending-del");
    await asOwner(
      request(app).delete(`/api/professor/topics/${deletable.id}`),
    ).expect(200);
    expect(
      await prisma.graduationTopic.findUnique({ where: { id: deletable.id } }),
    ).toBeNull();
  });

  /**
   * تعديل موضوع مرفوض **هو** إعادة تقديمه: يعود إلى الطابور ويفقد سبب الرفض
   * القديم. بدون هذا كان يبقى «مرفوضاً» بعد تصحيحه — مصنَّفاً تحت المرفوضات
   * عند الطرفين، ولا شيء يُخبر الإدارة أنه أُجيب.
   */
  it("تعديل موضوع مرفوض يُعيده «قيد الانتظار» ويمحو سبب الرفض", async () => {
    const topic = await prisma.graduationTopic.create({
      data: {
        title: `${TAG} PROF rejected`,
        description: `${TAG} description`,
        maxStudents: 3,
        status: "rejected",
        rejectionReason: "الوصف غير كافٍ",
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

    await asOwner(
      request(app)
        .put(`/api/professor/topics/${topic.id}`)
        .send({ description: "وصف مُصحَّح وأوفى" }),
    ).expect(200);

    const after = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(after?.status).toBe("pending");
    expect(after?.rejectionReason).toBeNull();
  });

  it("موضوع غير موجود ⇒ 404", async () => {
    await asOwner(
      request(app).get(
        "/api/professor/topics/00000000-0000-0000-0000-000000000000",
      ),
    ).expect(404);
  });
});
