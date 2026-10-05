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

async function topic(
  title: string,
  status: string,
  over: { maxStudents?: number; professorId?: string; createdAt?: Date } = {},
) {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents: over.maxStudents ?? 3,
      status: status as never,
      publishedAt: status === "open" || status === "full" ? new Date() : null,
      professorId: over.professorId ?? f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
      ...(over.createdAt ? { createdAt: over.createdAt } : {}),
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
  f = await seed(14);
  // الطالب الأوّل هو قارئ الملفّ («student»)، فلا يُسلَّم لفريق: لو صار
  // مرسِلَ طلبٍ لانفتح له المحجوزُ الذي يُختبر إغلاقه عليه.
  f.nextStudents(1);

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

  /** كلمةً كلمة: العنوانُ مع اسم المشرف، ولا يُشترط ترتيبٌ ولا تجاور. */
  it("وبالبحث باسم المشرف مع كلمةٍ من العنوان", async () => {
    const t = await topic("PUB zebra-by-name", "open", {
      professorId: f.professor2.id,
    });
    const prof2 = await prisma.user.findUniqueOrThrow({
      where: { id: f.prof2User.id },
      select: { lastName: true },
    });

    const hit = await list("student", {
      search: `zebra-by-name ${prof2.lastName}`,
    }).expect(200);
    expect(ids(hit.body)).toContain(t.id);

    // وكلمةٌ لا تطابق شيئاً تُسقطه: كلّ الكلمات شرط.
    const miss = await list("student", {
      search: `zebra-by-name ${TAG}-nobody-xyz`,
    }).expect(200);
    expect(ids(miss.body)).not.toContain(t.id);
  });

  it("وبالمشرف", async () => {
    const mine = await topic("PUB by-prof-2", "open", {
      professorId: f.professor2.id,
    });
    const other = await topic("PUB by-prof-1", "open");

    const res = await list("student", {
      professorId: f.professor2.id,
      search: `${TAG} PUB by-prof`,
    }).expect(200);
    expect(ids(res.body)).toContain(mine.id);
    expect(ids(res.body)).not.toContain(other.id);
  });

  it("وبحجم المجموعة", async () => {
    const pair = await topic("PUB size-2", "open", { maxStudents: 2 });
    const trio = await topic("PUB size-3", "open", { maxStudents: 3 });

    const res = await list("student", {
      maxStudents: 2,
      search: `${TAG} PUB size-`,
    }).expect(200);
    expect(ids(res.body)).toContain(pair.id);
    expect(ids(res.body)).not.toContain(trio.id);
  });

  it("والترتيب: الأحدث، والأقدم، وأبجدياً", async () => {
    const a = await topic("PUB sort-a", "open", {
      createdAt: new Date("2020-01-02"),
    });
    const b = await topic("PUB sort-b", "open", {
      createdAt: new Date("2020-01-01"),
    });
    const q = { search: `${TAG} PUB sort-` };

    const newest = ids((await list("student", q).expect(200)).body);
    const oldest = ids(
      (await list("student", { ...q, sort: "oldest" }).expect(200)).body,
    );
    const title = ids(
      (await list("student", { ...q, sort: "title" }).expect(200)).body,
    );

    expect(newest).toEqual([a.id, b.id]);
    expect(oldest).toEqual([b.id, a.id]);
    expect(title).toEqual([a.id, b.id]);

    expect((await list("student", { sort: "random" })).status).toBe(400);
  });

  /**
   * العدّادات تُحسب بفلاتر الطالب — لا بالتبويب: يرى كم في «المتاح» وهو
   * واقفٌ على «المحجوز»، فيعرف قبل أن ينتقل.
   */
  it("والعدّادات بفلاتر الطالب، لا بالتبويب المختار", async () => {
    await topic("PUB counts-free", "open");
    const taken = await topic("PUB counts-taken", "full");
    await prisma.projectGroup.create({ data: { topicId: taken.id } });

    const res = await list("student", {
      availability: "reserved",
      search: `${TAG} PUB counts-`,
    }).expect(200);

    expect(res.body.counts).toEqual({ all: 2, available: 1, reserved: 1 });
    expect(res.body.total).toBe(1); // المحجوز وحده، لأنّه التبويب المختار
  });
});

//
// ═══ خيارات الفلاتر ═══
//

describe("GET /api/public/topic-filters", () => {
  /**
   * ما يُعرض خياراً يجب أن يُرجع شيئاً: لا أستاذ بلا موضوعٍ منشور، ولا
   * حجمٌ لا موضوع به. وبجانب كلّ خيارٍ عدده.
   */
  it("المشرفون والسنوات والأحجام — من المنشور وحده، ومع أعدادها", async () => {
    await topic("PUB facets-open", "open", { maxStudents: 4 });
    await topic("PUB facets-hidden", "pending", { maxStudents: 7 });

    const res = await as(
      request(app).get("/api/public/topic-filters"),
      "student",
    ).expect(200);
    const body = res.body as {
      professors: { id: string; count: number }[];
      academicYears: { id: string; count: number }[];
      sizes: { value: number; count: number }[];
    };

    const prof = body.professors.find((p) => p.id === f.professor.id);
    expect(prof?.count).toBeGreaterThan(0);
    expect(body.academicYears.map((y) => y.id)).toContain(f.academicYear.id);
    expect(body.sizes.map((s) => s.value)).toContain(4);
    // قيد الانتظار لا يصنع خياراً.
    expect(body.sizes.map((s) => s.value)).not.toContain(7);

    // ولا يُسرَّب ما يُتّصل به المشرف.
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(f.professor.universityEmail);
    expect(raw).not.toContain(f.professor.employeeNumber);
  });

  it("و`mine` للطالب تخصّصُه، ولغيره لا شيء", async () => {
    const asStudent = await as(
      request(app).get("/api/public/topic-filters"),
      "student",
    ).expect(200);
    expect(asStudent.body.mine.specializationId).toBe(f.specialization.id);
    expect(asStudent.body.mine.departmentId).toBe(f.department.id);

    const asProfessor = await as(
      request(app).get("/api/public/topic-filters"),
      "professor",
    ).expect(200);
    expect(asProfessor.body.mine).toBeNull();
  });

  it("وبلا مصادقة ⇒ 401", async () => {
    await request(app).get("/api/public/topic-filters").expect(401);
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

    // الأستاذ يقرأ المحجوز — والطالب من خارج الفريق لا يصله أصلاً (أدناه).
    const res = await as(
      request(app).get(`/api/public/topics/${claimed.id}`),
      "professor",
    ).expect(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(leader.reg);
    expect(body).not.toContain(member.reg);
  });

  /**
   * صفحة الموضوع تُعرّف بالمشرف كما يُعرّف به دليل الجامعة: صورته ورتبته
   * وقسمه وكلّيته — لا بريده ولا هاتفه ولا رقمه الوظيفيّ.
   */
  it("والمشرف يُعرَّف بصورته ورتبته وقسمه، لا بما يُتّصل به", async () => {
    await prisma.user.update({
      where: { id: f.profUser.id },
      data: {
        avatarUrl: "/uploads/cards/pub-prof.png",
        phone: `${TAG}-0550999999`,
      },
    });
    await prisma.professor.update({
      where: { id: f.professor.id },
      data: { grade: ["أستاذ محاضر أ"] },
    });
    const t = await topic("PUB supervisor card", "open");

    const res = await as(
      request(app).get(`/api/public/topics/${t.id}`),
      "student",
    ).expect(200);
    const tp = (res.body.topic ?? res.body) as {
      publishedAt: string | null;
      specialization: { level: string };
      professor: {
        grade: unknown;
        user: { avatarUrl: string | null };
        department: { name: string; faculty: { name: string } };
      };
    };

    expect(tp.professor.user.avatarUrl).toBe("/uploads/cards/pub-prof.png");
    expect(tp.professor.grade).toEqual(["أستاذ محاضر أ"]);
    expect(tp.professor.department.name).toBe(f.department.name);
    expect(tp.professor.department.faculty.name).toBe(f.faculty.name);
    expect(tp.specialization.level).toBe("master");
    expect(tp.publishedAt).not.toBeNull();

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(f.professor.universityEmail);
    expect(body).not.toContain(f.professor.employeeNumber);
    expect(body).not.toContain(`${TAG}-0550999999`);
    expect(body).not.toContain(f.profUser.email);
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

  /**
   * المحجوز يُغلق على الطالب من غير فريقه.
   *
   * كانت القائمة وحدها تمنع النقر، والرابط المباشر يفتحه لمن نسخه أو حفظه.
   * فصار الخادم هو الحَكَم: 403 برمزٍ تعرفه الواجهة، وبلا شيءٍ من التفاصيل.
   */
  describe("الموضوع المحجوز", () => {
    /** فريقٌ حيّ على موضوعٍ جديد: الأوّل مرسِلُه، والثاني عضوٌ فيه. */
    async function claimed(title: string) {
      const t = await topic(title, "open");
      const [leader, member] = f.nextStudents(2);
      const login = async (reg: string) =>
        (
          await request(app)
            .post("/api/auth/student/login")
            .send({ registrationNumber: reg, password: TEST_PASSWORD })
            .expect(200)
        ).body.accessToken as string;
      const leaderToken = await login(leader.reg);
      await request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ topicId: t.id, memberRegistrationNumbers: [member.reg], priority: 1 })
        .expect(201);
      return { t, leaderToken, memberToken: await login(member.reg) };
    }

    it("والطالب من خارج الفريق ⇒ 403 TOPIC_RESERVED، ولا تفاصيل", async () => {
      const { t } = await claimed("PUB locked-other");

      const res = await as(
        request(app).get(`/api/public/topics/${t.id}`),
        "student",
      ).expect(403);

      expect(res.body.errorCode).toBe("TOPIC_RESERVED");
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("PUB locked-other");
      expect(body).not.toContain(`${TAG} description`);
    });

    it("وفريقُه يفتحه — المرسِل والعضو معاً — ويُعرف أنّه له", async () => {
      const { t, leaderToken, memberToken } = await claimed("PUB locked-mine");

      for (const bearer of [leaderToken, memberToken]) {
        const res = await request(app)
          .get(`/api/public/topics/${t.id}`)
          .set("Authorization", `Bearer ${bearer}`)
          .expect(200);
        expect(res.body.topic.isReserved).toBe(true);
        expect(res.body.topic.isMine).toBe(true);
      }
    });

    it("والأستاذ يقرؤه كما هو", async () => {
      const t = await topic("PUB detail-taken", "full");
      await prisma.projectGroup.create({ data: { topicId: t.id } });

      const res = await as(
        request(app).get(`/api/public/topics/${t.id}`),
        "professor",
      ).expect(200);

      expect(res.body.topic.isAvailable).toBe(false);
      expect(res.body.topic.isReserved).toBe(true);
      expect(res.body.topic.isMine).toBe(false);
    });

    /** والقائمة تقول لكلّ قارئ أيّ المحجوز له — فتفتحه بطاقتُه ولا تُغلق. */
    it("والقائمة تُعلّم ما هو للقارئ بـisMine", async () => {
      const { t, memberToken } = await claimed("PUB list-mine");
      const q = { search: `${TAG} PUB list-mine` };

      const asMember = await request(app)
        .get("/api/public/topics")
        .query(q)
        .set("Authorization", `Bearer ${memberToken}`)
        .expect(200);
      expect(rows(asMember.body).find((r) => r.id === t.id)?.isMine).toBe(true);

      const asOther = await list("student", q).expect(200);
      const row = rows(asOther.body).find((r) => r.id === t.id);
      expect(row?.isReserved).toBe(true);
      expect(row?.isMine).toBe(false);
    });
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
