/**
 * الواجهة العامّة — ما يُعرَض على أوسع جمهور.
 *
 * اسمها «عامّة» وهي محميّة بالمصادقة (قرارٌ موثَّق في `public.routes.ts`:
 * المواضيع للأعضاء لا للزوّار). لكنها تبقى **الأوسع قراءةً** في النظام: كل
 * طالب وكل أستاذ يراها. فما يُعاد فيها يراه الجميع.
 *
 * ولذلك سؤالان يحكمانها:
 *
 *   **ماذا يُعرَض؟** — المنشور والمأخوذ، لا قيد الانتظار ولا المرفوض ولا
 *   المؤرشف. وموضوعٌ لم تعتمده الإدارة يجب ألّا يظهر ولو بالرابط المباشر.
 *
 *   **وماذا لا يُعاد؟** — لا بريد الأستاذ، ولا رقم موظّفه، ولا أسماء الطلبة
 *   الذين طلبوا الموضوع. الاسم وحده يكفي للبطاقة.
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

async function topic(title: string, status: string) {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents: 3,
      status: status as never,
      publishedAt: status === "open" || status === "full" ? new Date() : null,
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

const list = (who: string, query: Record<string, unknown> = {}) =>
  as(request(app).get("/api/public/topics").query(query), who);

beforeAll(async () => {
  await teardown();
  f = await seed(6);

  tok.student = (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[0].reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;

  tok.professor = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({
        universityEmail: f.professor.universityEmail,
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
// ═══ ماذا يُعرَض ═══
//

describe("GET /api/public/topics — ما يظهر وما لا يظهر", () => {
  it("المنشور يظهر", async () => {
    const t = await topic("PUB open", "open");
    const res = await list("student", { search: `${TAG} PUB open` }).expect(200);
    expect(ids(res.body)).toContain(t.id);
  });

  it.each([["pending"], ["rejected"], ["archived"], ["approved"]])(
    "وما هو %s لا يظهر",
    async (status) => {
      const t = await topic(`PUB hidden-${status}`, status);
      const res = await list("student", {
        search: `${TAG} PUB hidden-${status}`,
      }).expect(200);
      expect(ids(res.body)).not.toContain(t.id);
    },
  );

  /**
   * `approved` مستبعَد عمداً وهو المفاجئ: الموضوع مقبول لكنه لم يُنشر بعد.
   * والصفحة العامّة تعرض المنشور وحده — النشر قرارٌ ثانٍ مستقلّ عن القبول.
   */
  it("و«معتمَد غير منشور» مستبعَد — القبول ليس نشراً", async () => {
    const approved = await topic("PUB approved-only", "approved");
    const res = await list("student", { search: `${TAG} PUB approved` }).expect(
      200,
    );
    expect(ids(res.body)).not.toContain(approved.id);
  });
});

describe("تبويبا «متاح» و«محجوز»", () => {
  it("المتاح: منشورٌ بلا مجموعة ولا طلب حيّ", async () => {
    const free = await topic("PUB free", "open");

    const res = await list("student", {
      availability: "available",
      search: `${TAG} PUB free`,
    }).expect(200);

    expect(ids(res.body)).toContain(free.id);
    const row = rows(res.body).find((r) => r.id === free.id)!;
    expect(row.isAvailable).toBe(true);
    expect(row.isReserved).toBe(false);
  });

  /** الموضوع الذي اكتمل بطلب كان يختفي من التبويبين معاً قبل الإصلاح. */
  it("والمحجوز: ما تشكّلت له مجموعة", async () => {
    const taken = await topic("PUB taken", "full");
    await prisma.projectGroup.create({ data: { topicId: taken.id } });

    const reserved = await list("student", {
      availability: "reserved",
      search: `${TAG} PUB taken`,
    }).expect(200);
    expect(ids(reserved.body)).toContain(taken.id);

    const available = await list("student", {
      availability: "available",
      search: `${TAG} PUB taken`,
    }).expect(200);
    expect(ids(available.body)).not.toContain(taken.id);
  });

  it("وموضوعٌ يحجزه طلب معلّق: محجوز لا متاح", async () => {
    const claimed = await topic("PUB claimed", "open");
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
        topicId: claimed.id,
        memberRegistrationNumbers: [member.reg],
        priority: 1,
      })
      .expect(201);

    const available = await list("student", {
      availability: "available",
      search: `${TAG} PUB claimed`,
    }).expect(200);
    expect(ids(available.body)).not.toContain(claimed.id);

    const reserved = await list("student", {
      availability: "reserved",
      search: `${TAG} PUB claimed`,
    }).expect(200);
    expect(ids(reserved.body)).toContain(claimed.id);
  });

  it("وبلا تبويب ⇒ الاثنان معاً", async () => {
    const free = await topic("PUB both-free", "open");
    const taken = await topic("PUB both-taken", "full");
    await prisma.projectGroup.create({ data: { topicId: taken.id } });

    const res = await list("student", { search: `${TAG} PUB both` }).expect(200);
    expect(ids(res.body)).toEqual(expect.arrayContaining([free.id, taken.id]));
  });
});

//
// ═══ الترقيم والترشيح ═══
//

describe("الترقيم", () => {
  it("يحترم limit ويُعيد المجموع الكلّي", async () => {
    for (let i = 0; i < 5; i++) await topic(`PUB page-${i}`, "open");

    const res = await list("student", {
      search: `${TAG} PUB page-`,
      page: 1,
      limit: 2,
    }).expect(200);

    expect(rows(res.body)).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });

  it("والصفحة الثانية تحمل غير الأولى", async () => {
    for (let i = 0; i < 4; i++) await topic(`PUB p2-${i}`, "open");

    const first = await list("student", {
      search: `${TAG} PUB p2-`,
      page: 1,
      limit: 2,
    }).expect(200);
    const second = await list("student", {
      search: `${TAG} PUB p2-`,
      page: 2,
      limit: 2,
    }).expect(200);

    for (const id of ids(second.body)) expect(ids(first.body)).not.toContain(id);
  });

  it("وصفحة بعد النهاية ⇒ قائمة فارغة لا خطأ", async () => {
    const res = await list("student", {
      search: `${TAG} PUB nothing-here`,
      page: 99,
    }).expect(200);
    expect(rows(res.body)).toHaveLength(0);
  });

  it("و limit فوق الحدّ ⇒ 400 لا تحميل غير محدود", async () => {
    const res = await list("student", { limit: 5000 });
    expect(res.status).toBe(400);
  });
});

describe("الترشيح", () => {
  it("بالتخصّص", async () => {
    const t = await topic("PUB by-spec", "open");

    const mine = await list("student", {
      specializationId: f.specialization.id,
      search: `${TAG} PUB by-spec`,
    }).expect(200);
    expect(ids(mine.body)).toContain(t.id);

    const other = await list("student", {
      specializationId: "00000000-0000-0000-0000-000000000000",
      search: `${TAG} PUB by-spec`,
    }).expect(200);
    expect(ids(other.body)).not.toContain(t.id);
  });

  it("وبالبحث في العنوان", async () => {
    const t = await topic("PUB findme-qwerty", "open");
    const res = await list("student", { search: "qwerty" }).expect(200);
    expect(ids(res.body)).toContain(t.id);
  });
});

//
// ═══ ماذا لا يُعاد ═══
//

describe("لا تُسرّب الواجهة العامّة ما لا يخصّها", () => {
  it("اسم الأستاذ يظهر، وبريده ورقم موظّفه لا", async () => {
    await topic("PUB professor-privacy", "open");

    const res = await list("student", {
      search: `${TAG} PUB professor-privacy`,
    }).expect(200);
    const body = JSON.stringify(res.body);

    expect(body).toContain(TAG); // اسم الأستاذ في التجهيزة يحمل الوسم
    expect(body).not.toContain(f.professor.universityEmail);
    expect(body).not.toContain(f.professor.employeeNumber);
    expect(body).not.toContain("password");
  });

  it("ولا أسماء الطلبة الذين طلبوا الموضوع", async () => {
    const claimed = await topic("PUB requesters-hidden", "open");
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
        topicId: claimed.id,
        memberRegistrationNumbers: [member.reg],
        priority: 1,
      })
      .expect(201);

    const res = await as(
      request(app).get(`/api/public/topics/${claimed.id}`),
      "student",
    ).expect(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(leader.reg);
    expect(body).not.toContain(member.reg);
  });
});

//
// ═══ صفحة الموضوع الواحد ═══
//

describe("GET /api/public/topics/:id", () => {
  it("موضوع منشور ⇒ 200 مع حالة الإتاحة", async () => {
    const t = await topic("PUB detail", "open");

    const res = await as(
      request(app).get(`/api/public/topics/${t.id}`),
      "student",
    ).expect(200);

    // الردّ ملفوف في { topic }.
    expect(res.body.topic.id).toBe(t.id);
    expect(res.body.topic.isAvailable).toBe(true);
    expect(res.body.topic.isReserved).toBe(false);
  });

  /** الرابط المحفوظ يصل موضوعاً مأخوذاً، فيجب أن يقول ذلك لا أن يَعِد به. */
  it("وموضوع مأخوذ ⇒ 200 لكن isReserved، فلا يَعِد الرابط المحفوظ بما لا يُنال", async () => {
    const t = await topic("PUB detail-taken", "full");
    await prisma.projectGroup.create({ data: { topicId: t.id } });

    const res = await as(
      request(app).get(`/api/public/topics/${t.id}`),
      "student",
    ).expect(200);

    expect(res.body.topic.isAvailable).toBe(false);
    expect(res.body.topic.isReserved).toBe(true);
  });

  it.each([["pending"], ["rejected"], ["archived"], ["approved"]])(
    "وموضوع %s ⇒ 404 ولو بالرابط المباشر",
    async (status) => {
      const t = await topic(`PUB direct-${status}`, status);
      await as(
        request(app).get(`/api/public/topics/${t.id}`),
        "student",
      ).expect(404);
    },
  );

  it("وموضوع غير موجود ⇒ 404", async () => {
    await as(
      request(app).get(
        "/api/public/topics/00000000-0000-0000-0000-000000000000",
      ),
      "student",
    ).expect(404);
  });
});

//
// ═══ قوائم الترشيح ═══
//

describe("الأقسام والتخصّصات للترشيح", () => {
  it("تُعاد لكل مستخدم مصادَق", async () => {
    for (const who of ["student", "professor"]) {
      for (const p of [
        "/api/public/departments",
        "/api/public/specializations",
      ]) {
        const res = await as(request(app).get(p), who).expect(200);
        expect(Array.isArray(rows(res.body))).toBe(true);
      }
    }
  });

  it("والتخصّصات تُرشَّح بالقسم", async () => {
    const res = await as(
      request(app)
        .get("/api/public/specializations")
        .query({ departmentId: f.department.id }),
      "student",
    ).expect(200);

    expect(ids(res.body)).toContain(f.specialization.id);
  });
});
