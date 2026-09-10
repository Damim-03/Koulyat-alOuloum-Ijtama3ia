/**
 * كنسة الحُرّاس: **كل** مسار في الـAPI، بلا استثناء.
 *
 * أشيع ثغرة في أي واجهة برمجية ليست منطقاً خاطئاً، بل **مساراً أُضيف ونُسي
 * حارسه**. لا تراه مراجعة الشيفرة — السطر يشبه إخوته تماماً — ولا تكشفه
 * التغطية، لأن المسار الجديد يعمل ويُختبَر مسار نجاحه فتُحسب أسطره مغطّاة.
 *
 * وهذه الاختبارات لا تعرف شيئاً عن المسارات: تقرؤها من ملفّات التوجيه عند كل
 * تشغيل. فمسارٌ يُضاف غداً يُكنَس تلقائياً — وإن نُسي حارسه احمرّ فوراً.
 *
 * ولا تختبر ما يفعله المسار؛ ذلك شغل ملفّات أخرى. تختبر شيئاً واحداً:
 *
 *   > لا يصل مجهولٌ إلى ما ليس عامّاً، ولا يصل دورٌ إلى ما ليس له.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { allEndpoints, concretePath, type Endpoint } from "../helpers/routes";
import { seed, teardown, residue, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
const token: Record<"admin" | "professor" | "student", string> = {
  admin: "",
  professor: "",
  student: "",
};

/**
 * المسارات المفتوحة عمداً: تسجيل الدخول والتحديث وفحص الحياة.
 * كل ما عداها يجب أن يُحرَس — وإضافة سطر هنا قرارٌ واعٍ لا سهو.
 */
const PUBLIC_ON_PURPOSE = new Set([
  "POST /api/auth/student/login",
  "POST /api/auth/professor/login",
  "POST /api/auth/admin/login",
  "POST /api/auth/refresh",
]);

/** الدور المتوقَّع لكل بادئة. `public` و`common` يقبلان أي مستخدم مصادَق. */
const OWNER_ROLE: Record<string, "admin" | "professor" | "student" | "any"> = {
  admin: "admin",
  professor: "professor",
  student: "student",
  auth: "any",
  common: "any",
  public: "any",
  messages: "any",
};

const key = (e: Endpoint) => `${e.method} ${e.path}`;

const send = (e: Endpoint, bearer?: string) => {
  const method = e.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  const r = request(app)[method](concretePath(e.path));
  return bearer ? r.set("Authorization", `Bearer ${bearer}`) : r;
};

beforeAll(async () => {
  await teardown();
  f = await seed(2);

  token.admin = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;

  token.professor = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({
        universityEmail: f.professor.universityEmail,
        password: TEST_PASSWORD,
      })
      .expect(200)
  ).body.accessToken;

  token.student = (
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

describe("جرد المسارات", () => {
  it("يُقرأ من ملفّات التوجيه، وليس فارغاً", () => {
    const all = allEndpoints();
    expect(all.length).toBeGreaterThan(100);

    // كل وحدة ممثَّلة — لو تعطّل التحليل لسقطت واحدة بصمت.
    for (const m of ["admin", "auth", "professor", "student", "public", "common", "messages"])
      expect(all.some((e) => e.module === m)).toBe(true);
  });

  it("وكل مسار عامّ مُعلَن هنا موجود فعلاً", () => {
    const all = new Set(allEndpoints().map(key));
    for (const p of PUBLIC_ON_PURPOSE) expect(all.has(p)).toBe(true);
  });
});

describe("لا يصل مجهول إلى مسار محميّ", () => {
  /**
   * بلا ترويسة مصادقة. المقبول 401 وحده — و**404 غير مقبول**: مسارٌ يردّ
   * «غير موجود» لمجهول قد يكون بلا حارس ووصل إلى معالجه فلم يجد الصفّ.
   */
  it.each(
    allEndpoints()
      .filter((e) => !PUBLIC_ON_PURPOSE.has(key(e)))
      .map((e) => [key(e), e] as const),
  )("%s ⇒ 401", async (_label, e) => {
    const res = await send(e);
    expect(res.status).toBe(401);
  });
});

describe("ولا يصل دورٌ إلى مسار ليس له", () => {
  const wrongRoleFor = (e: Endpoint) => {
    const expected = OWNER_ROLE[e.module];
    if (expected === "any" || !expected) return null;
    // طالبٌ على مسار إدارة أو أستاذ، وأستاذٌ على مسار طالب.
    return expected === "student" ? "professor" : "student";
  };

  const cases = allEndpoints()
    .filter((e) => !PUBLIC_ON_PURPOSE.has(key(e)))
    .map((e) => [e, wrongRoleFor(e)] as const)
    .filter(([, role]) => role !== null)
    .map(([e, role]) => [`${key(e)}  ⟵ ${role}`, e, role!] as const);

  it.each(cases)("%s ⇒ 403", async (_label, e, role) => {
    const res = await send(e, token[role as "student" | "professor"]);
    expect(res.status).toBe(403);
  });
});
