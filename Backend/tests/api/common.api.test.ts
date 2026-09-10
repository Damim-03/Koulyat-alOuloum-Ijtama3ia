/**
 * القوائم المشتركة — الكلّيات والأقسام والتخصّصات والسنوات.
 *
 * وحدة صغيرة كانت على **٠٪ فروع**، وفروعها كلّها من نوع واحد: **الترشيح
 * الاختياري**. `facultyId ? {facultyId} : undefined` — سطرٌ يبدو تافهاً، وهو
 * الفرق بين قائمة أقسام كلّية واحدة وقائمة أقسام الجامعة كلّها في نموذج
 * يملؤه مستخدم.
 *
 * وهذه القوائم تُغذّي كل قائمة منسدلة في التطبيق. خطأ فيها لا يُسقط شيئاً —
 * يُظهر خيارات لا تخصّ ما اختاره المستخدم، وهو عطل يُلاحَظ متأخّراً.
 *
 * ويُختبَر معها ما لا تقوله الشيفرة: **ماذا لا يُعاد؟** فهذه المسارات مفتوحة
 * لكل مستخدم مصادَق — طالباً كان أو أستاذاً — فما يُعاد فيها يراه الجميع.
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

/** كلّية ثانية بشجرتها، فيصير للترشيح معنى: نتيجتان مختلفتان لا واحدة. */
let other: {
  facultyId: string;
  departmentId: string;
  filiereId: string;
  specializationId: string;
};

const as = (path: string, who: string) =>
  request(app).get(path).set("Authorization", `Bearer ${tok[who]}`);

beforeAll(async () => {
  await teardown();
  f = await seed(2);

  const faculty = await prisma.faculty.create({
    data: { name: `${TAG} faculty B`, code: `${TAG}-FAC-B` },
  });
  const department = await prisma.department.create({
    data: {
      name: `${TAG} dept B`,
      code: `${TAG}-DEP-B`,
      facultyId: faculty.id,
    },
  });
  const filiere = await prisma.filiere.create({
    data: {
      name: `${TAG} filiere B`,
      code: `${TAG}-FIL-B`,
      departmentId: department.id,
    },
  });
  const specialization = await prisma.specialization.create({
    data: {
      name: `${TAG} spec B`,
      level: "licence",
      filiereId: filiere.id,
    },
  });
  other = {
    facultyId: faculty.id,
    departmentId: department.id,
    filiereId: filiere.id,
    specializationId: specialization.id,
  };

  tok.admin = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;

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

/** يستخرج المصفوفة أيّاً كان اسم غلافها في الردّ. */
const rows = (body: unknown): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body;
  const o = body as Record<string, unknown>;
  for (const v of Object.values(o)) if (Array.isArray(v)) return v;
  return [];
};
const ids = (body: unknown) => rows(body).map((r) => r.id as string);

//
// ═══ الوصول ═══
//

describe("القوائم متاحة لكل مستخدم مصادَق", () => {
  const paths = [
    "/api/common/faculties",
    "/api/common/departments",
    "/api/common/specializations",
    "/api/common/academic-years",
  ];

  it.each(paths)("%s — الإدارة والأستاذ والطالب سواء", async (p) => {
    for (const who of ["admin", "professor", "student"]) {
      const res = await as(p, who).expect(200);
      expect(Array.isArray(rows(res.body))).toBe(true);
    }
  });
});

//
// ═══ الترشيح — كل فروع هذه الوحدة ═══
//

describe("الأقسام: الترشيح بالكلّية", () => {
  it("بلا ترشيح ⇒ أقسام الكلّيتين معاً", async () => {
    const res = await as("/api/common/departments", "admin").expect(200);
    expect(ids(res.body)).toEqual(
      expect.arrayContaining([f.department.id, other.departmentId]),
    );
  });

  it("وبكلّية بعينها ⇒ أقسامها وحدها", async () => {
    const res = await as(
      `/api/common/departments?facultyId=${f.faculty.id}`,
      "admin",
    ).expect(200);

    expect(ids(res.body)).toContain(f.department.id);
    expect(ids(res.body)).not.toContain(other.departmentId);
  });

  it("وبكلّية لا وجود لها ⇒ قائمة فارغة لا خطأ", async () => {
    const res = await as(
      "/api/common/departments?facultyId=00000000-0000-0000-0000-000000000000",
      "admin",
    ).expect(200);
    expect(rows(res.body)).toHaveLength(0);
  });
});

describe("التخصّصات: الترشيح بالشعبة والقسم", () => {
  it("بلا ترشيح ⇒ تخصّصات الشجرتين", async () => {
    const res = await as("/api/common/specializations", "admin").expect(200);
    expect(ids(res.body)).toEqual(
      expect.arrayContaining([f.specialization.id, other.specializationId]),
    );
  });

  it("وبالشعبة ⇒ تخصّصاتها وحدها", async () => {
    const res = await as(
      `/api/common/specializations?filiereId=${f.filiere.id}`,
      "admin",
    ).expect(200);

    expect(ids(res.body)).toContain(f.specialization.id);
    expect(ids(res.body)).not.toContain(other.specializationId);
  });

  /** القسم يُحلّ عبر علاقة الشعبة، لا بعمود مباشر — فرعٌ يستحقّ تأكيداً. */
  it("وبالقسم ⇒ يُحلّ عبر الشعبة ويُرشّح صحيحاً", async () => {
    const res = await as(
      `/api/common/specializations?departmentId=${other.departmentId}`,
      "admin",
    ).expect(200);

    expect(ids(res.body)).toContain(other.specializationId);
    expect(ids(res.body)).not.toContain(f.specialization.id);
  });

  /**
   * الردّ مُسطَّح: `departmentId` في المستوى الأعلى رغم أنه يعيش داخل الشعبة.
   * كُتب هكذا حفاظاً على توافق العملاء القدامى، فيستحقّ حارساً.
   */
  it("ويحمل كل تخصّص departmentId مسطَّحاً إلى جانب filiereId", async () => {
    const res = await as("/api/common/specializations", "admin").expect(200);
    const row = rows(res.body).find((r) => r.id === f.specialization.id);

    expect(row).toBeDefined();
    expect(row!.filiereId).toBe(f.filiere.id);
    expect(row!.departmentId).toBe(f.department.id);
    expect(row!.level).toBeTruthy();
  });
});

//
// ═══ الترتيب ═══
//

describe("الترتيب مقصود لا عرضيّ", () => {
  it("الكلّيات بالاسم تصاعدياً", async () => {
    const res = await as("/api/common/faculties", "admin").expect(200);
    const names = rows(res.body).map((r) => String(r.name));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  /** السنة النشطة أوّلاً: هي ما يريده المستخدم في كل قائمة منسدلة. */
  it("والسنوات: النشطة أوّلاً", async () => {
    await prisma.academicYear.create({
      data: { title: `${TAG} 2001/2002`, isActive: true },
    });

    const res = await as("/api/common/academic-years", "admin").expect(200);
    const list = rows(res.body);
    const firstInactive = list.findIndex((r) => r.isActive === false);
    const lastActive = list.map((r) => r.isActive === true).lastIndexOf(true);

    if (firstInactive !== -1 && lastActive !== -1)
      expect(lastActive).toBeLessThan(firstInactive);
  });
});

//
// ═══ ماذا لا يُعاد ═══
//

describe("لا تُسرّب القوائم ما لا يخصّها", () => {
  /**
   * هذه المسارات يقرؤها كل مستخدم مصادَق. فما يُعاد فيها يراه كل طالب —
   * ويجب أن يقتصر على ما يلزم قائمةً منسدلة: معرّف واسم ورمز.
   */
  it("الكلّيات: معرّف واسم ورمز لا غير", async () => {
    const res = await as("/api/common/faculties", "admin").expect(200);
    for (const row of rows(res.body))
      expect(Object.keys(row).sort()).toEqual(["code", "id", "name"]);
  });

  it("والسنوات: معرّف وعنوان وحالة النشاط لا غير", async () => {
    const res = await as("/api/common/academic-years", "admin").expect(200);
    for (const row of rows(res.body))
      expect(Object.keys(row).sort()).toEqual(["id", "isActive", "title"]);
  });

  it("ولا تحمل أي قائمة تواريخ إنشاء ولا صور غلاف", async () => {
    for (const p of [
      "/api/common/faculties",
      "/api/common/departments",
      "/api/common/specializations",
      "/api/common/academic-years",
    ]) {
      const res = await as(p, "student").expect(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("createdAt");
      expect(body).not.toContain("updatedAt");
      expect(body).not.toContain("coverUrl");
    }
  });
});
