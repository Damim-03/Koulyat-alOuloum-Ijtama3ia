/**
 * الإدارة — الحسابات والطلبة والأساتذة.
 *
 * سبعة عشر مسارًا، وهي أخطر ما في وحدة الإدارة: **إنشاء حسابات وتعطيلها
 * وحذفها**. خطأ في موضوع يُضيع موضوعاً؛ خطأ هنا يُضيع إنساناً من النظام —
 * بطلباته ومشروعه وتسليماته.
 *
 * وثلاثة أسئلة تحكم المجال:
 *
 *   **من يحذف؟** — ثلاثة مسارات محميّة بـ`adminOnly()`. وكان الحذف محجوزاً
 *   لدور `owner` فوق المدير؛ فلمّا أُلغي ذلك الدور انتقل إليه. والأستاذ
 *   والطالب ممنوعان كما كانا — وهذا ما يجب أن يبقى مشهوداً.
 *
 *   **وماذا يُحذف معه؟** — حذف الطالب يمسح طلباته وعضوياته وتسليماته في
 *   معاملة واحدة. وترك صفٍّ واحد يعني مفتاحاً أجنبياً معلّقاً أو بياناتٍ
 *   يتيمة لا تظهر لأحد ولا تختفي.
 *
 *   **ومتى يُمنع الحذف؟** — أستاذٌ له مواضيع لا يُحذف. والحساب الذي يخصّ
 *   طالباً أو أستاذاً يُحذف من شاشته لا من شاشة الحسابات.
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
const tok: Record<"admin" | "professor" | "student", string> = {
  admin: "",
  professor: "",
  student: "",
};

const as = (r: request.Test, who: keyof typeof tok) =>
  r.set("Authorization", `Bearer ${tok[who]}`);

const rows = (body: unknown): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body;
  const o = body as Record<string, unknown>;
  for (const v of Object.values(o)) if (Array.isArray(v)) return v;
  return [];
};

/** بيانات حساب جديد فريدة في كل نداء. */
let n = 0;
const newUser = () => {
  n += 1;
  return {
    firstName: TAG,
    lastName: `New${n}`,
    email: `${TAG}.new${n}@test.local`,
    password: "A-strong-Passw0rd!",
    role: "admin",
  };
};

beforeAll(async () => {
  await teardown();
  f = await seed(8);

  tok.admin = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
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

  tok.student = (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[0].reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ الحسابات ═══
//

describe("POST /api/admin/users", () => {
  it("بيانات صحيحة ⇒ يُنشأ الحساب، ويُخزَّن مجزَّأً لا نصّاً", async () => {
    const data = newUser();
    const res = await as(
      request(app).post("/api/admin/users").send(data),
      "admin",
    );
    expect([200, 201]).toContain(res.status);

    const created = await prisma.user.findUnique({
      where: { email: data.email },
    });
    expect(created).not.toBeNull();
    expect(created!.password).not.toBe(data.password);
    expect(created!.password.startsWith("$2")).toBe(true);
  });

  /**
   * التوثيق عمودٌ ظلّ يُقرأ ولا يُكتب: تعرضه ثلاث صفحات وتُرشّح به القائمة،
   * ولم يكن في المنصّة كلّها مسارٌ يجعله `true`. فمن هنا يُكتب الآن، ومن
   * هنا يجب أن يُختبَر — وإلّا عاد الحقل زينةً في استمارة.
   */
  it("والتوثيق يُحفظ كما أرسلته الإدارة", async () => {
    const data = { ...newUser(), isVerified: true };
    const res = await as(
      request(app).post("/api/admin/users").send(data),
      "admin",
    );
    expect([200, 201]).toContain(res.status);

    const created = await prisma.user.findUnique({
      where: { email: data.email },
    });
    expect(created!.isVerified).toBe(true);
  });

  it("وإن لم تُرسله بقي الحساب غير موثّق", async () => {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");

    const created = await prisma.user.findUnique({
      where: { email: data.email },
    });
    expect(created!.isVerified).toBe(false);
  });

  it("ولا يُعيد الردّ كلمة السرّ ولا تجزئتها", async () => {
    const res = await as(
      request(app).post("/api/admin/users").send(newUser()),
      "admin",
    );
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("$2a$");
    expect(body).not.toContain("$2b$");
    expect(body).not.toContain("A-strong-Passw0rd!");
  });

  it("وبريدٌ مكرّر ⇒ يُرفض، ولا يُنشأ حسابٌ ثانٍ", async () => {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");

    const res = await as(
      request(app).post("/api/admin/users").send(data),
      "admin",
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500); // لا انهيار على قيد التفرّد

    expect(
      await prisma.user.count({ where: { email: data.email } }),
    ).toBe(1);
  });

  /**
   * كان هذا يردّ **500 «Internal Server Error»** برقم حادثة: تعارض التفرّد
   * في القاعدة (P2002) لم يكن له فرع في معالج الأخطاء، فيسقط إلى العامّ.
   * والمستخدم لم يُخطئ في النظام بل في حقل — والمخطّط فيه ٢٣ حقلاً فريداً
   * ولا يُفحص منها يدوياً إلا اثنان.
   */
  it("ويقول أي حقلٍ تكرّر — لا «خطأ خادم»", async () => {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");

    const res = await as(
      request(app).post("/api/admin/users").send(data),
      "admin",
    ).expect(409);

    expect(res.body.message).toContain("email");
    expect(res.body.message).not.toContain("Internal");
    // اسم الحقل يكفي؛ إعادة القيمة تُثبت للمهاجم أن ما جرّبه مسجَّل.
    expect(JSON.stringify(res.body)).not.toContain(data.email);
  });

  it("وبلا بريد ولا اسم مستخدم ⇒ 400", async () => {
    const { email, ...rest } = newUser();
    void email;
    const res = await as(
      request(app).post("/api/admin/users").send(rest),
      "admin",
    );
    expect(res.status).toBe(400);
  });

  it("ودورٌ غير معروف ⇒ 400 لا 500", async () => {
    const res = await as(
      request(app)
        .post("/api/admin/users")
        .send({ ...newUser(), role: "superuser" }),
      "admin",
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/users", () => {
  it("القائمة لا تحمل كلمات السرّ", async () => {
    const res = await as(request(app).get("/api/admin/users"), "admin").expect(
      200,
    );
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("$2a$");
    expect(body).not.toContain("$2b$");
    for (const row of rows(res.body)) expect(row.password).toBeUndefined();
  });

  it("وحسابٌ بعينه كذلك", async () => {
    const res = await as(
      request(app).get(`/api/admin/users/${f.admin.id}`),
      "admin",
    ).expect(200);
    expect(JSON.stringify(res.body)).not.toContain("$2");
  });

  it("وحسابٌ غير موجود ⇒ 404", async () => {
    await as(
      request(app).get(
        "/api/admin/users/00000000-0000-0000-0000-000000000000",
      ),
      "admin",
    ).expect(404);
  });
});

describe("PATCH /api/admin/users/:id/status", () => {
  /**
   * التعطيل ليس تغيير حقل: الحساب المعطَّل يجب أن يتوقّف عن العمل **فوراً**،
   * وأن يعود بالتفعيل. وهذا ما يُختبَر هنا — لا قيمة العمود.
   */
  it("التعطيل يُوقف الحساب فوراً، والتفعيل يُعيده", async () => {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");
    const created = (await prisma.user.findUnique({
      where: { email: data.email },
    }))!;

    const bearer = (
      await request(app)
        .post("/api/auth/admin/login")
        .send({ email: data.email, password: data.password })
        .expect(200)
    ).body.accessToken;

    await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);

    await as(
      request(app)
        .patch(`/api/admin/users/${created.id}/status`)
        .send({ status: "suspended" }),
      "admin",
    ).expect(200);

    await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(403);

    await as(
      request(app)
        .patch(`/api/admin/users/${created.id}/status`)
        .send({ status: "active" }),
      "admin",
    ).expect(200);

    await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);
  });

  it("وحالة غير معروفة ⇒ 400", async () => {
    const res = await as(
      request(app)
        .patch(`/api/admin/users/${f.admin.id}/status`)
        .send({ status: "on-vacation" }),
      "admin",
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/users/:id/verification", () => {
  /**
   * التوثيق عند الإنشاء وحده يترك الحسابات التي سبقته بلا طريق: وهي كل
   * حسابٍ في القاعدة اليوم. فالمسار هنا هو ما يجعل العمود قابلاً للتصحيح
   * لا للتعيين مرّةً واحدةً إلى الأبد.
   */
  it("التوثيق يُرفع ويُرجَع", async () => {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");
    const created = (await prisma.user.findUnique({
      where: { email: data.email },
    }))!;
    expect(created.isVerified).toBe(false);

    await as(
      request(app)
        .patch(`/api/admin/users/${created.id}/verification`)
        .send({ isVerified: true }),
      "admin",
    ).expect(200);
    expect(
      (await prisma.user.findUnique({ where: { id: created.id } }))!.isVerified,
    ).toBe(true);

    // ويُسحب: التوثيق قرارٌ يُراجَع، لا بابٌ يُغلق خلفه.
    await as(
      request(app)
        .patch(`/api/admin/users/${created.id}/verification`)
        .send({ isVerified: false }),
      "admin",
    ).expect(200);
    expect(
      (await prisma.user.findUnique({ where: { id: created.id } }))!.isVerified,
    ).toBe(false);
  });

  it("وقيمةٌ ليست منطقية ⇒ 400", async () => {
    const res = await as(
      request(app)
        .patch(`/api/admin/users/${f.admin.id}/verification`)
        .send({ isVerified: "yes" }),
      "admin",
    );
    expect(res.status).toBe(400);
  });

  /**
   * ولا يوثّق أحدٌ نفسه: الطالب والأستاذ ممنوعان من المسار كلّه، وهو ما
   * يجعل «موثّق» شهادةً من الإدارة لا إقراراً ذاتياً.
   */
  it("والطالب والأستاذ ممنوعان", async () => {
    for (const who of ["student", "professor"] as const) {
      const res = await as(
        request(app)
          .patch(`/api/admin/users/${f.admin.id}/verification`)
          .send({ isVerified: true }),
        who,
      );
      expect(res.status).toBe(403);
    }
  });
});

describe("POST /api/admin/users/:id/reset-password", () => {
  it("كلمة السرّ الجديدة تعمل، والقديمة تتوقّف", async () => {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");
    const created = (await prisma.user.findUnique({
      where: { email: data.email },
    }))!;

    const fresh = "Another-Str0ng-Pass!";
    await as(
      request(app)
        .post(`/api/admin/users/${created.id}/reset-password`)
        .send({ password: fresh }),
      "admin",
    ).expect(200);

    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: data.email, password: fresh })
      .expect(200);

    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: data.email, password: data.password })
      .expect(401);
  });
});

//
// ═══ الحذف: من يملكه ومن لا يملكه ═══
//

describe("DELETE — للمدير دون غيره", () => {
  async function aPlainUser() {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");
    return (await prisma.user.findUnique({ where: { email: data.email } }))!;
  }

  /**
   * كان هذا المسار محجوزاً لدور `owner`، والمدير يُردّ عنه بـ403. ويوم أُلغي
   * ذلك الدور انتقل الحذف إلى المدير — **بقرارٍ صريح**: لولا نقله لَما بقي
   * في المنصّة من يحذف حساباً.
   */
  it("المدير يحذف حساباً ⇒ 200، والحساب يزول", async () => {
    const u = await aPlainUser();

    await as(request(app).delete(`/api/admin/users/${u.id}`), "admin").expect(
      200,
    );
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
  });

  /**
   * وما لم ينتقل: الأستاذ والطالب ممنوعان من مسارات الحذف كما كانا. وهذا
   * هو الحدّ الذي كان يحرسه الفرق بين المالك والمدير، وقد بقي بعده.
   */
  it.each(["professor", "student"] as const)(
    "و«%s» لا يحذف حساباً ⇒ 403، والحساب باقٍ",
    async (who) => {
      const u = await aPlainUser();

      await as(request(app).delete(`/api/admin/users/${u.id}`), who).expect(403);
      expect(
        await prisma.user.findUnique({ where: { id: u.id } }),
      ).not.toBeNull();
    },
  );

  it("ولا يحذفان طالباً ولا أستاذاً", async () => {
    const [s] = f.nextStudents(1);

    await as(
      request(app).delete(`/api/admin/students/${s.id}`),
      "professor",
    ).expect(403);
    await as(
      request(app).delete(`/api/admin/professors/${f.professor2.id}`),
      "student",
    ).expect(403);

    expect(
      await prisma.student.findUnique({ where: { id: s.id } }),
    ).not.toBeNull();
  });
});

describe("حسابٌ يخصّ طالباً أو أستاذاً لا يُحذف من شاشة الحسابات", () => {
  /**
   * الحساب وحده ليس كل شيء: للطالب طلبات وعضويات وتسليمات، وحذف الصفّ
   * الأعلى وحده يترك ذلك كلّه يتيماً. فالرسالة توجّه إلى الشاشة التي تعرف
   * كيف تُنظّف.
   */
  it("حساب طالب ⇒ 400 مع توجيه إلى إدارة الطلبة", async () => {
    const [s] = f.nextStudents(1);
    const res = await as(
      request(app).delete(`/api/admin/users/${s.userId}`),
      "admin",
    ).expect(400);

    expect(res.body.message).toContain("الطلبة");
    expect(await prisma.user.findUnique({ where: { id: s.userId } })).not.toBeNull();
  });

  it("وحساب أستاذ ⇒ 400 مع توجيه إلى إدارة الأساتذة", async () => {
    const res = await as(
      request(app).delete(`/api/admin/users/${f.prof2User.id}`),
      "admin",
    ).expect(400);

    expect(res.body.message).toContain("الأساتذة");
  });
});

//
// ═══ الطلبة ═══
//

describe("الطلبة", () => {
  it("القائمة تُرشَّح بالتخصّص", async () => {
    const res = await as(
      request(app)
        .get("/api/admin/students")
        .query({ specializationId: f.specialization.id }),
      "admin",
    ).expect(200);
    expect(rows(res.body).length).toBeGreaterThan(0);

    const none = await as(
      request(app)
        .get("/api/admin/students")
        .query({ specializationId: "00000000-0000-0000-0000-000000000000" }),
      "admin",
    ).expect(200);
    expect(rows(none.body)).toHaveLength(0);
  });

  it("ورقم تسجيل مكرّر ⇒ يُرفض", async () => {
    const [existing] = f.nextStudents(1);

    const res = await as(
      request(app)
        .post("/api/admin/students")
        .send({
          firstName: TAG,
          lastName: "Dup",
          email: `${TAG}.dup@test.local`,
          password: "A-strong-Passw0rd!",
          registrationNumber: existing.reg, // مكرّر
          specializationId: f.specialization.id,
          academicYearId: f.academicYear.id,
        }),
      "admin",
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  /**
   * والطالب يمرّ بمسارٍ آخر: حسابه يُنشأ **متداخلاً** داخل `student.create`،
   * لا باستدعاءٍ مستقلّ. فنجاح التوثيق في `POST /users` لا يضمنه هنا — وقد
   * يسقط الحقل في التداخل وحده فلا يشعر به أحد.
   */
  it("وتوثيق الطالب يبلغ حسابه المتداخل", async () => {
    const email = `${TAG}.verified.student@test.local`;

    const res = await as(
      request(app)
        .post("/api/admin/students")
        .send({
          firstName: TAG,
          lastName: "Verified",
          email,
          password: "A-strong-Passw0rd!",
          registrationNumber: `${TAG}VR${Date.now()}`,
          specializationId: f.specialization.id,
          academicYearId: f.academicYear.id,
          isVerified: true,
        }),
      "admin",
    );
    expect([200, 201]).toContain(res.status);

    const created = await prisma.user.findUnique({ where: { email } });
    expect(created!.isVerified).toBe(true);
  });

  /**
   * أثمن تأكيد في الملفّ: الحذف يمسح كل ما تعلّق بالطالب في معاملة واحدة.
   * صفٌّ واحد يبقى يعني مفتاحاً أجنبياً معلّقاً أو بياناتٍ يتيمة.
   */
  it("وحذف الطالب يمسح طلباته وعضوياته وحسابه معاً", async () => {
    const [leader, member] = f.nextStudents(2);

    const t = await prisma.graduationTopic.create({
      data: {
        title: `${TAG} ADMU cascade`,
        description: `${TAG} d`,
        maxStudents: 3,
        status: "open",
        publishedAt: new Date(),
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

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

    await as(
      request(app).delete(`/api/admin/students/${leader.id}`),
      "admin",
    ).expect(200);

    expect(await prisma.student.findUnique({ where: { id: leader.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: leader.userId } })).toBeNull();
    expect(
      await prisma.groupRequest.count({ where: { leaderStudentId: leader.id } }),
    ).toBe(0);
    expect(
      await prisma.groupRequestMember.count({ where: { studentId: leader.id } }),
    ).toBe(0);

    // والموضوع تحرّر بزوال الطلب.
    const free = await as(
      request(app).get("/api/admin/topics").query({ search: `${TAG} ADMU cascade` }),
      "admin",
    ).expect(200);
    const row = rows(free.body).find((r) => r.id === t.id) as
      | { occupancy?: { hasPendingRequest: boolean } }
      | undefined;
    expect(row?.occupancy?.hasPendingRequest).toBe(false);
  });

  it("وطالبٌ غير موجود ⇒ 404", async () => {
    await as(
      request(app).delete(
        "/api/admin/students/00000000-0000-0000-0000-000000000000",
      ),
      "admin",
    ).expect(404);
  });
});

//
// ═══ الأساتذة ═══
//

describe("الأساتذة", () => {
  it("بريدٌ جامعيّ مكرّر ⇒ يُرفض", async () => {
    const res = await as(
      request(app)
        .post("/api/admin/professors")
        .send({
          firstName: TAG,
          lastName: "DupProf",
          email: `${TAG}.dupprof@test.local`,
          password: "A-strong-Passw0rd!",
          employeeNumber: `${TAG}-EMP-DUP`,
          universityEmail: f.professor.universityEmail, // مكرّر
          departmentId: f.department.id,
        }),
      "admin",
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  /**
   * الحارس الذي يمنع فقدان المواضيع: أستاذٌ يحمل مواضيع لا يُحذف حتى
   * تُعاد إسناداً أو تُؤرشف. والرسالة تقول العدد، فيعرف المستخدم حجم العمل.
   */
  it("وأستاذٌ له مواضيع لا يُحذف، والرسالة تقول كم", async () => {
    await prisma.graduationTopic.create({
      data: {
        title: `${TAG} ADMU prof-topic`,
        description: `${TAG} d`,
        maxStudents: 3,
        status: "approved",
        professorId: f.professor2.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

    const res = await as(
      request(app).delete(`/api/admin/professors/${f.professor2.id}`),
      "admin",
    ).expect(400);

    expect(res.body.message).toMatch(/\d/); // العدد مذكور
    expect(
      await prisma.professor.findUnique({ where: { id: f.professor2.id } }),
    ).not.toBeNull();
  });

  it("وأستاذٌ بلا مواضيع يُحذف مع حسابه", async () => {
    const created = await prisma.user.create({
      data: {
        firstName: TAG,
        lastName: "Spare",
        email: `${TAG}.spare@test.local`,
        password: "x",
        role: "professor",
      },
    });
    const spare = await prisma.professor.create({
      data: {
        employeeNumber: `${TAG}-EMP-SPARE`,
        universityEmail: `${TAG}.spare-uni@test.local`,
        userId: created.id,
        departmentId: f.department.id,
      },
    });

    await as(
      request(app).delete(`/api/admin/professors/${spare.id}`),
      "admin",
    ).expect(200);

    expect(
      await prisma.professor.findUnique({ where: { id: spare.id } }),
    ).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: created.id } })).toBeNull();
  });
});
