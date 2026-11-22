/**
 * تصدير المواضيع — `GET /api/admin/topics/export`.
 *
 * بفلاتر صفحة المواضيع نفسها (والشرط شرط القائمة)، وملفّ Excel بورقةٍ واحدة:
 * بلا طلبة، أو بطلبة كلّ موضوع — كلّ طالبٍ في خانته ورقمه بجانبه، المرسِل أوّلاً.
 * والمسار لا يُقرأ «export» معرّفاً لموضوع؛ وليس لغير الإدارة.
 */
import request from "supertest";
import ExcelJS from "exceljs";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { seed, teardown, residue, makeTopic, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let prof = "";
let memoir: { leader: Fixture["students"][number]; member: Fixture["students"][number] };

beforeAll(async () => {
  await teardown();
  f = await seed(4);
  admin = (await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)).body.accessToken;
  prof = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({ universityEmail: f.professor.universityEmail, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;

  // مذكرةٌ بطالبين (المرسِل ثانياً في الإدخال، ليُرى أنّه يأتي أوّلاً)، وموضوعٌ منشور بلا طلبة.
  const t = await makeTopic(f, "مذكرة مسندة", "full", 2);
  const group = await prisma.projectGroup.create({ data: { topicId: t.id } });
  const [member, leader] = f.nextStudents(2);
  await prisma.projectMember.create({ data: { groupId: group.id, studentId: member!.id, isLeader: false } });
  await prisma.projectMember.create({ data: { groupId: group.id, studentId: leader!.id, isLeader: true } });
  memoir = { leader: leader!, member: member! };
  await makeTopic(f, "موضوع منشور", "open");
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const exportXlsx = async (query: Record<string, string>) => {
  const res = await request(app)
    .get("/api/admin/topics/export")
    .query({ academicYearId: f.academicYear.id, specializationId: f.specialization.id, ...query })
    .set("Authorization", `Bearer ${admin}`)
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    })
    .expect(200);
  expect(res.headers["content-type"]).toContain("spreadsheetml");
  expect(res.headers["content-disposition"]).toContain("topics.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.body as unknown as ArrayBuffer);
  // The test's topics are all master's: one sheet, the master's.
  expect(wb.worksheets.map((w) => w.name)).toEqual(["المواضيع - ماستر"]);
  return wb.worksheets[0]!;
};

/** صفوف الجدول بقيمها، بعد الرأس (الصفّ الذي أوّله «#»). */
function table(ws: ExcelJS.Worksheet) {
  let header = 0;
  ws.eachRow((r, n) => {
    if (!header && r.getCell(1).value === "#") header = n;
  });
  const heads = (ws.getRow(header).values as unknown[]).slice(1) as string[];
  const rows = Array.from({ length: ws.rowCount - header }, (_, i) => {
    const values = (ws.getRow(header + 1 + i).values as unknown[]).slice(1);
    return Object.fromEntries(heads.map((h, k) => [h, values[k]]));
  });
  return { heads, rows };
}

describe("GET /api/admin/topics/export", () => {
  it("بلا طلبة: مواضيع النطاق، وسطر النطاق والسنة والعدد في رأس الورقة", async () => {
    const ws = await exportXlsx({});
    expect(ws.getCell("A1").value).toBe("قائمة المواضيع — ماستر");
    expect(ws.getCell("A2").value).toBe(`${f.specialization.name} — ماستر`);
    expect(ws.getCell("A3").value).toBe(`السنة الجامعية ${f.academicYear.title} — موضوعان`);

    const { heads, rows } = table(ws);
    expect(heads).not.toContain("الطلبة");
    expect(heads).not.toContain("السنة الجامعية");
    expect(rows.map((r) => r["عنوان الموضوع"]).sort()).toEqual([`${TAG} مذكرة مسندة`, `${TAG} موضوع منشور`].sort());
    expect(rows.map((r) => r["الحالة"]).sort()).toEqual(["مسند", "منشور"].sort());
  });

  it("بالطلبة: كلّ طالبٍ في خانته ورقمه بجانبه، والمرسِل أوّلاً؛ والمكان بلا طالب يقول لماذا", async () => {
    const { heads, rows } = table(await exportXlsx({ students: "with" }));
    // أكبر سعةٍ في الملف ثلاثة (الموضوع المنشور): ثلاثة أزواج.
    expect(heads).toEqual(
      expect.arrayContaining(["الطالب الأول (المرسِل)", "رقم تسجيل الأول", "الطالب الثالث", "رقم تسجيل الثالث", "المسنَدون"]),
    );
    expect(heads).not.toContain("الطالب الرابع");

    const assigned = rows.find((r) => r["عنوان الموضوع"] === `${TAG} مذكرة مسندة`)!;
    expect(assigned["رقم تسجيل الأول"]).toBe(memoir.leader.reg);
    expect(assigned["رقم تسجيل الثاني"]).toBe(memoir.member.reg);
    expect(assigned["الطالب الأول (المرسِل)"]).toBeTruthy();
    // موضوعٌ لاثنين: مكانه الثالث خارج سعته.
    expect(assigned["الطالب الثالث"]).toBe("—");
    expect(assigned["المسنَدون"]).toBe(2);
    expect(assigned["السعة"]).toBe(2);

    const open = rows.find((r) => r["عنوان الموضوع"] === `${TAG} موضوع منشور`)!;
    expect([open["الطالب الأول (المرسِل)"], open["رقم تسجيل الأول"], open["الطالب الثالث"]]).toEqual(["مكان شاغر", "—", "مكان شاغر"]);
    expect(open["المسنَدون"]).toBe(0);
  });

  it("والمستوى يحصر الملف: الماستر بمواضيعه، والليسانس بلا مواضيع ⇒ ورقةٌ فارغة", async () => {
    const master = table(await exportXlsx({ level: "master" }));
    expect(master.rows).toHaveLength(2);
    const res = await request(app)
      .get("/api/admin/topics/export")
      .query({ academicYearId: f.academicYear.id, specializationId: f.specialization.id, level: "licence" })
      .set("Authorization", `Bearer ${admin}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["المواضيع"]);
    expect(table(wb.worksheets[0]!).rows).toEqual([]);
    // And the list itself, by the same rule.
    const listed = await request(app).get("/api/admin/topics").query({ specializationId: f.specialization.id, level: "licence" }).set("Authorization", `Bearer ${admin}`).expect(200);
    expect(listed.body.items).toEqual([]);
  });

  it("وفلاتر الصفحة تحصر الملف: الحالة، والبحث", async () => {
    const full = table(await exportXlsx({ status: "full" }));
    expect(full.rows.map((r) => r["عنوان الموضوع"])).toEqual([`${TAG} مذكرة مسندة`]);
    const searched = await exportXlsx({ search: "منشور" });
    expect(table(searched).rows.map((r) => r["عنوان الموضوع"])).toEqual([`${TAG} موضوع منشور`]);
    expect(searched.getCell("A2").value).toContain("البحث: «منشور»");
  });

  it("وقيمةٌ غير معروفة ⇒ 400، وبلا حساب ⇒ 401، والأستاذ ⇒ 403", async () => {
    const as = (q: string) => request(app).get(`/api/admin/topics/export${q}`).set("Authorization", `Bearer ${admin}`);
    await as("?students=maybe").expect(400);
    await as("?status=lost").expect(400);
    await request(app).get("/api/admin/topics/export").expect(401);
    await request(app).get("/api/admin/topics/export").set("Authorization", `Bearer ${prof}`).expect(403);
  });
});
