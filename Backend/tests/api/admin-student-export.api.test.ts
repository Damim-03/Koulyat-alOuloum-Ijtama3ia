/**
 * تصدير قوائم الطلبة: الفلاتر نفسها التي في صفحة الطلبة، وملفّ Excel —
 * ورقةٌ لكلّ تخصص أو ورقةٌ واحدة.
 */
import request from "supertest";
import ExcelJS from "exceljs";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, TEST_PASSWORD, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let student = "";

beforeAll(async () => {
  await teardown();
  f = await seed(3);
  admin = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
  student = (
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

const exportXlsx = async (query: Record<string, string>) => {
  const res = await request(app)
    .get("/api/admin/students/export")
    .query(query)
    .set("Authorization", `Bearer ${admin}`)
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    })
    .expect(200);
  expect(res.headers["content-type"]).toContain("spreadsheetml");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.body as unknown as ArrayBuffer);
  return wb;
};

/** كلّ قيم الورقة نصّاً واحداً — يكفي للبحث عن رقم تسجيل. */
const textOf = (ws: ExcelJS.Worksheet) => {
  const out: string[] = [];
  ws.eachRow((row) => out.push((row.values as unknown[]).map(String).join("|")));
  return out.join("\n");
};

describe("GET /api/admin/students/export", () => {
  it("ورقةٌ لتخصص الطلبة، فيها أرقامهم ورأسٌ باللاتيني أوّلاً", async () => {
    const wb = await exportXlsx({ specializationId: f.specialization.id, academicYearId: f.academicYear.id });
    expect(wb.worksheets).toHaveLength(1);
    const ws = wb.worksheets[0]!;
    expect(ws.name).toContain(f.specialization.name.slice(0, 10));
    const all = textOf(ws);
    for (const s of f.students.slice(0, 3)) expect(all).toContain(s.reg);
    expect(all).toContain("اللقب (Nom)|الاسم (Prénom)|اللقب بالعربية|الاسم بالعربية");
    expect(all).toContain("الكلية|القسم|الشعبة|المستوى|التخصص");
    // طلبة الاختبار بلا هاتف: الخانة تقول «لا يوجد» لا فراغ.
    expect(all).toContain("لا يوجد");
  });

  it("والخانات الفارغة فارغةٌ فعلاً حين يُطلب — لتعمل التعبئة السريعة", async () => {
    const wb = await exportXlsx({ specializationId: f.specialization.id, empty: "blank" });
    expect(textOf(wb.worksheets[0]!)).not.toContain("لا يوجد");
  });

  it("وورقةٌ واحدة بأعمدة الهرم حين يُطلب", async () => {
    const wb = await exportXlsx({ specializationId: f.specialization.id, layout: "single" });
    expect(wb.worksheets.map((w) => w.name)).toEqual(["الطلبة"]);
    expect(textOf(wb.worksheets[0]!)).toContain("الكلية|القسم|الشعبة|المستوى|التخصص");
  });

  it("وقيمةٌ غير معروفة ⇒ 400، وبلا حساب ⇒ 401، والطالب ⇒ 403", async () => {
    await request(app).get("/api/admin/students/export?level=phd").set("Authorization", `Bearer ${admin}`).expect(400);
    await request(app).get("/api/admin/students/export").expect(401);
    await request(app).get("/api/admin/students/export").set("Authorization", `Bearer ${student}`).expect(403);
  });
});
