/**
 * الإدارة — الحسابات والطلبة والأساتذة.
 *
 * سبعة عشر مسارًا، وهي أخطر ما في وحدة الإدارة: **إنشاء حسابات وتعطيلها
 * وحذفها**. خطأ في موضوع يُضيع موضوعاً؛ خطأ هنا يُضيع إنساناً من النظام —
 * بطلباته ومشروعه وتسليماته.
 *
 * وثلاثة أسئلة تحكم المجال:
 *
 *   **من يحذف؟** — ثلاثة مسارات محميّة بـ`ownerOnly()`، أي أن المدير نفسه
 *   لا يملك الحذف. وهذا فرقٌ في الامتياز لا يُختبَر بحساب واحد.
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
const tok: Record<"admin" | "owner" | "professor" | "student", string> = {
  admin: "",
  owner: "",
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

  tok.owner = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.owner.email, password: TEST_PASSWORD })
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
// ═══ الحذف: امتياز المالك وحده ═══
//

describe("DELETE — للمالك دون المدير", () => {
  async function aPlainUser() {
    const data = newUser();
    await as(request(app).post("/api/admin/users").send(data), "admin");
    return (await prisma.user.findUnique({ where: { email: data.email } }))!;
  }

  it("المدير لا يحذف حساباً ⇒ 403، والحساب باقٍ", async () => {
    const u = await aPlainUser();

    await as(request(app).delete(`/api/admin/users/${u.id}`), "admin").expect(
      403,
    );
    expect(await prisma.user.findUnique({ where: { id: u.id } })).not.toBeNull();
  });

  it("والمالك يحذفه ⇒ 200", async () => {
    const u = await aPlainUser();

    await as(request(app).delete(`/api/admin/users/${u.id}`), "owner").expect(
      200,
    );
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
  });

  it("والمدير لا يحذف طالباً ولا أستاذاً", async () => {
    const [s] = f.nextStudents(1);

    await as(
      request(app).delete(`/api/admin/students/${s.id}`),
      "admin",
    ).expect(403);
    await as(
      request(app).delete(`/api/admin/professors/${f.professor2.id}`),
      "admin",
    ).expect(403);

    expect(await prisma.student.findUnique({ where: { id: s.id } })).not.toBeNull();
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
      "owner",
    ).expect(400);

    expect(res.body.message).toContain("الطلبة");
    expect(await prisma.user.findUnique({ where: { id: s.userId } })).not.toBeNull();
  });

  it("وحساب أستاذ ⇒ 400 مع توجيه إلى إدارة الأساتذة", async () => {
    const res = await as(
      request(app).delete(`/api/admin/users/${f.prof2User.id}`),
      "owner",
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
      "owner",
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
      "owner",
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
      "owner",
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
      "owner",
    ).expect(200);

    expect(
      await prisma.professor.findUnique({ where: { id: spare.id } }),
    ).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: created.id } })).toBeNull();
  });
});
