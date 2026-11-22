/**
 * استيراد المواضيع المُسنَدة من Excel — «إنشاء موضوع وإسناده» دفعةً، بنموذجٍ
 * مستقلّ عن استيراد المواضيع:
 *
 *   **خانات الموضوع** بقاعدة استيراد المواضيع نفسها، بلا عمود الحالة.
 *   **الطلبة** برقم تسجيلهم: لا مذكرة لهم ولا طلب قائم، ولا يتكرّرون؛ والأوّل
 *     المرسِل؛ واختلاف التخصّص تنبيه.
 *   **والدفعة كلّها أو لا شيء**: موضوعٌ «مسند» بمجموعته، وإشعارٌ لكلّ طالب.
 */
import request from "supertest";
import ExcelJS from "exceljs";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { ASSIGNED_COLUMNS, ASSIGNED_SPEC } from "../../src/modules/admin/assigned-topic-import/columns";
import { TOPIC_COLUMNS } from "../../src/modules/admin/topic-import/columns";
import { parseImportFile } from "../../src/modules/admin/import-kit/parser";
import { seed, teardown, residue, makeTopic, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";
import * as notifications from "../../src/modules/notification/notification.service";
import { tr } from "../../src/core/i18n";

let f: Fixture;
let admin = "";
let student = "";

const auth = (r: request.Test, bearer = admin) => r.set("Authorization", `Bearer ${bearer}`);

let seq = 0;
const title = () => `${TAG} مُسنَد ${Date.now().toString(36)}${++seq}`;

type Row = Partial<Record<(typeof ASSIGNED_COLUMNS)[number]["header"], ExcelJS.CellValue>>;

async function xlsx(rows: Row[], headers: string[] = ASSIGNED_COLUMNS.map((c) => c.header)) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("المواضيع المسندة");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => (r as Record<string, ExcelJS.CellValue>)[h] ?? null));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const valid = (over: Row = {}): Row => ({
  "الأستاذ": f.professor.universityEmail,
  "عنوان الموضوع": title(),
  "الوصف": "وصفٌ كافٍ لموضوعٍ مُسنَدٍ يُستورد من ملفّ Excel في الاختبار.",
  "عدد الطلبة": 2,
  "السنة الجامعية": f.academicYear.title,
  "التخصص": f.specialization.name,
  ...over,
});

type Cell = { value: string; saved?: string; state: string; issues?: { level: string; message: string }[] };
type ReportRow = { row: number; cells: Record<string, Cell>; errors: number; warnings: number };
const rowOf = (res: request.Response, n: number) =>
  (res.body.report.rows as ReportRow[]).find((r) => r.row === n)!;
const said = (c: Cell, level = "error") =>
  (c.issues ?? [])
    .filter((i) => i.level === level)
    .map((i) => i.message)
    .join(" | ");

const upload = (path: string, buf: Buffer, name = "assigned.xlsx") =>
  auth(request(app).post(`/api/admin/topics/assigned/import${path}`)).attach("file", buf, name);

beforeAll(async () => {
  await teardown();
  f = await seed(14);
  admin = (
    await request(app).post("/api/auth/admin/login").send({ email: f.admin.email, password: TEST_PASSWORD }).expect(200)
  ).body.accessToken;
  student = (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: f.students[0]!.reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

describe("نموذج المواضيع المُسنَدة", () => {
  it("مستقلٌّ عن نموذج المواضيع: خانات الموضوع بلا الحالة، ثم مقاعد الطلبة", async () => {
    const res = await auth(request(app).get("/api/admin/topics/assigned/import/template"))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const headers = (wb.getWorksheet("المواضيع المسندة")!.getRow(2).values as unknown[]).slice(1);
    expect(headers).toEqual(ASSIGNED_COLUMNS.map((c) => c.header));
    expect(headers).not.toContain("الحالة");
    expect(headers).toContain("الطالب 1 (المرسِل)");

    // ملفّ استيراد المواضيع لا يُقرأ هنا: لا مقعد فيه للطلبة.
    const topicsFile = new ExcelJS.Workbook();
    topicsFile.addWorksheet("المواضيع").addRow(TOPIC_COLUMNS.map((c) => c.header));
    const parsed = await parseImportFile(Buffer.from(await topicsFile.xlsx.writeBuffer()), ASSIGNED_SPEC);
    expect(parsed.fileErrors.join(" ")).toContain("الطالب 1 (المرسِل)");
  });
});

describe("معاينة المواضيع المُسنَدة", () => {
  it("الطلبة بقاعدة المقاعد: المرسِل إلزاميّ، ولا تكرار، والعدد لا يتجاوز الحدّ", async () => {
    const [a, b, c] = f.nextStudents(3);
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "الطالب 1 (المرسِل)": a!.reg, "الطالب 2": b!.reg }), // 2 — a في الصفّ 4 أيضاً
        valid({ "الطالب 2": c!.reg }), // 3 — بلا مرسِل
        valid({ "الطالب 1 (المرسِل)": a!.reg }), // 4 — a في الصفّ 2 أيضاً
        valid({ "عدد الطلبة": 1, "الطالب 1 (المرسِل)": c!.reg, "الطالب 2": "999999999" }), // 5
      ]),
    ).expect(200);
    // المكرّر يُعلَّم في صفّيه كليهما، كما في سائر الاستيرادات («في الصفّ … أيضاً»):
    // الاستيراد كلّه أو لا شيء، فأيُّ الموضوعين للطالب يقرّره المسؤول لا ترتيبُ الصفوف.
    expect(rowOf(res, 2).errors).toBe(1);
    expect(said(rowOf(res, 2).cells.student1!)).toContain("الصفّ 4");
    expect(said(rowOf(res, 4).cells.student1!)).toContain("الصفّ 2");
    // وبقيّة الصفّ تُقرأ كما هي: المقعد السليم محفوظ.
    expect(rowOf(res, 2).cells.student2!.saved).toContain(b!.reg);
    expect(said(rowOf(res, 3).cells.student1!)).toContain("المرسِل");
    expect(said(rowOf(res, 5).cells.student2!)).toContain("لا طالب برقم التسجيل");
    expect(await prisma.projectMember.count({ where: { studentId: a!.id } })).toBe(0);
  });
});

describe("استيراد المواضيع المُسنَدة", () => {
  it("ينشئ الموضوع «مسنداً» بمجموعته والأوّل مرسِلها، ويُعلم الطلبة — ولا يُعاد ملفٌّ استورد", async () => {
    const [a, b] = f.nextStudents(2);
    const row = valid({ "الطالب 1 (المرسِل)": a!.reg, "الطالب 2": b!.reg });
    const buf = await xlsx([row]);
    const res = await upload("", buf).expect(201);
    expect(res.body).toMatchObject({ created: 1, assigned: 2 });

    const topic = await prisma.graduationTopic.findFirstOrThrow({
      where: { title: row["عنوان الموضوع"] as string },
      select: { status: true, publishedAt: true, projectGroup: { select: { members: true } } },
    });
    expect(topic.status).toBe("full");
    expect(topic.publishedAt).toBeNull();
    const leader = topic.projectGroup!.members.find((m) => m.isLeader)!;
    expect(leader.studentId).toBe(a!.id);
    expect(topic.projectGroup!.members).toHaveLength(2);
    expect(
      await prisma.notification.count({ where: { userId: { in: [a!.userId, b!.userId] }, title: "تم إسنادكم إلى موضوع" } }),
    ).toBe(2);

    const again = await upload("", buf).expect(400);
    expect(again.body.message).toContain("لم يُسنَد أيّ طالب");
    expect(said(rowOf(again, 2).cells.student1!)).toContain("له مذكرة");
  });

  it("للإدارة وحدها", async () => {
    const buf = await xlsx([valid()]);
    await request(app).post("/api/admin/topics/assigned/import/preview").attach("file", buf, "t.xlsx").expect(401);
    await auth(request(app).post("/api/admin/topics/assigned/import/preview"), student)
      .attach("file", buf, "t.xlsx")
      .expect(403);
  });
});

describe("استيراد المواضيع المُسنَدة — على الحافّة", () => {
  it("ملفٌّ ليس نموذجها (ملف استيراد المواضيع) ⇒ تقريرٌ يقول ما ينقصه، ولا صفّ يُقرأ", async () => {
    const res = await upload("/preview", await xlsx([{}], TOPIC_COLUMNS.map((c) => c.header))).expect(200);
    expect(res.body.report.fileErrors.join(" ")).toContain("الطالب 1 (المرسِل)");
    expect(res.body.report.rows).toEqual([]);
  });

  it("ولا رقم تسجيلٍ في الملف كلّه ⇒ كلّ صفٍّ يطلب مرسِله", async () => {
    const res = await upload("/preview", await xlsx([valid()])).expect(200);
    expect(said(rowOf(res, 2).cells.student1!)).toContain("المرسِل");
  });

  it("وطالبٌ بلا اسمٍ في المنصّة يُعرف برقمه", async () => {
    const [a] = f.nextStudents(1);
    await prisma.user.update({
      where: { id: a!.userId },
      data: { firstName: null, lastName: null, firstNameLatin: null, lastNameLatin: null },
    });
    const res = await upload("/preview", await xlsx([valid({ "الطالب 1 (المرسِل)": a!.reg })])).expect(200);
    expect(rowOf(res, 2).cells.student1!.saved).toBe(`${a!.reg} — ${a!.reg}`);
  });

  /**
   * بين المعاينة والكتابة قد يُسند طالبٌ أو يقدّم طلباً — ولا قيدَ في القاعدة
   * يمنع طالباً من مجموعتين. فيُسأل ثانيةً داخل المعاملة. ويُحاكى هنا بطلبٍ
   * يُنشأ للطالب لحظةَ تُفتح المعاملة، بعد أن مرّ الفحص.
   */
  it("وطالبٌ قدّم طلباً بين الفحص والكتابة ⇒ 400 يسمّيه، ولا يُستورد شيء", async () => {
    const [a, b] = f.nextStudents(2);
    const other = await makeTopic(f, "ASSIGNED raced-elsewhere", "open");
    const row = valid({ "الطالب 1 (المرسِل)": a!.reg, "الطالب 2": b!.reg });

    const real = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, "$transaction").mockImplementationOnce((async (...args: Parameters<typeof real>) => {
      await prisma.groupRequest.create({
        data: { topicId: other.id, leaderStudentId: a!.id, status: "pending", members: { create: [{ studentId: a!.id }] } },
      });
      return real(...args);
    }) as never);

    const res = await upload("", await xlsx([row])).expect(400);
    expect(res.body.message).toBe(tr("assigned.importRaced", { reg: a!.reg }));
    expect(await prisma.graduationTopic.count({ where: { title: row["عنوان الموضوع"] as string } })).toBe(0);
  });

  /** الإشعار بعد المعاملة: يسقط فلا يُرجع استيراداً ثبت — يُسجَّل ويمضي. */
  it("وإشعاراتٌ تسقط بعد الكتابة لا تُفشل الاستيراد", async () => {
    const [a] = f.nextStudents(1);
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(notifications, "createNotifications").mockRejectedValueOnce(new Error("bell down"));

    const res = await upload("", await xlsx([valid({ "الطالب 1 (المرسِل)": a!.reg })])).expect(201);
    expect(res.body).toMatchObject({ created: 1, assigned: 1 });
    expect(logged).toHaveBeenCalledWith("[assigned-topic-import] notifications failed:", expect.any(Error));
  });

  it("وأستاذٌ بلا اسمٍ في المنصّة يُذكر في النتيجة ببريده الجامعي", async () => {
    const [a] = f.nextStudents(1);
    const names = await prisma.user.findUniqueOrThrow({
      where: { id: f.professor.userId },
      select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true },
    });
    await prisma.user.update({
      where: { id: f.professor.userId },
      data: { firstName: null, lastName: null, firstNameLatin: null, lastNameLatin: null },
    });
    try {
      const res = await upload("", await xlsx([valid({ "الطالب 1 (المرسِل)": a!.reg })])).expect(201);
      expect(res.body.topics[0].professor).toBe(f.professor.universityEmail);
    } finally {
      await prisma.user.update({ where: { id: f.professor.userId }, data: names });
    }
  });
});
