/**
 * استيراد مواضيع الأساتذة من Excel — بقاعدة نافذة «إنشاء موضوع» وخدمتها.
 *
 *   **الأستاذ** من القائمة، أو ببريده الجامعي، أو برقمه الوظيفي.
 *   **العنوان** لا يتكرّر للأستاذ نفسه في السنة نفسها — في الملف ولا في المنصّة.
 *   **التخصص** إلزاميّ، والكلية والقسم والشعبة والمستوى تُشتقّ منه.
 *   **الحالة** إلزامية، بأسمائها في الموقع: قيد الانتظار أو تمت الموافقة أو منشور
 *   — والمنشور بتاريخ نشره.
 *   **والدفعة كلّها أو لا شيء**، ولكلّ أستاذٍ إشعارٌ واحد.
 */
import request from "supertest";
import ExcelJS from "exceljs";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { Prisma } from "../../src/generated/prisma";
import { TOPIC_COLUMNS, TOPIC_SPEC } from "../../src/modules/admin/topic-import/columns";
import { parseImportFile } from "../../src/modules/admin/import-kit/parser";
import * as notifications from "../../src/modules/notification/notification.service";
import { seed, teardown, residue, TEST_PASSWORD, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let admin = "";
let student = "";

const auth = (r: request.Test, bearer = admin) => r.set("Authorization", `Bearer ${bearer}`);

let seq = 0;
const title = (s = "") => `${TAG} موضوع ${Date.now().toString(36)}${++seq}${s}`;

type Row = Partial<Record<(typeof TOPIC_COLUMNS)[number]["header"], ExcelJS.CellValue>>;

async function xlsx(rows: Row[], headers: string[] = TOPIC_COLUMNS.map((c) => c.header)) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("المواضيع");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => (r as Record<string, ExcelJS.CellValue>)[h] ?? null));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const valid = (over: Row = {}): Row => ({
  "الأستاذ": f.professor.universityEmail,
  "عنوان الموضوع": title(),
  "الوصف": "وصفٌ كافٍ لموضوعٍ يُستورد من ملفّ Excel في الاختبار.",
  "عدد الطلبة": 2,
  "السنة الجامعية": f.academicYear.title,
  "التخصص": f.specialization.name,
  "الحالة": "تمت الموافقة",
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

const upload = (path: string, buf: Buffer, name = "topics.xlsx") =>
  auth(request(app).post(`/api/admin/topics/import${path}`)).attach("file", buf, name);

const template = async (): Promise<Buffer> =>
  (
    await auth(request(app).get("/api/admin/topics/import/template"))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200)
  ).body;

beforeAll(async () => {
  await teardown();
  f = await seed(2);
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

describe("نموذج المواضيع", () => {
  it("يُنزَّل بعناوين الاستيراد، وبالأساتذة والتخصصات والحالات، وقوائمه منسدلة", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await template());
    const ws = wb.getWorksheet("المواضيع")!;
    expect((ws.getRow(2).values as unknown[]).slice(1)).toEqual(TOPIC_COLUMNS.map((c) => c.header));

    const lists = wb.getWorksheet("القوائم")!;
    expect(lists.state).toBe("hidden");
    const col = (c: string) => lists.getColumn(c).values.slice(2);
    expect(col("A")).toContain(f.specialization.name);
    expect(col("AB")).toEqual(["قيد الانتظار", "تمت الموافقة", "منشور"]); // كما في الموقع
    expect(col("Z").length).toBeGreaterThanOrEqual(2);

    const dvAt = (k: string) => ws.getRow(3).getCell(TOPIC_COLUMNS.findIndex((c) => c.key === k) + 1).dataValidation;
    for (const k of ["professor", "academicYear", "faculty", "specialization", "status"]) expect(dvAt(k)?.type).toBe("list");
    expect(dvAt("professor")?.errorStyle).toBe("warning"); // البريد والرقم يُقبلان
    expect(dvAt("maxStudents")?.type).toBe("whole");

    const parsed = await parseImportFile(await template(), TOPIC_SPEC);
    expect(parsed.fileErrors).toEqual(["الملف لا يحتوي على أيّ موضوع."]);
  });
});

describe("معاينة المواضيع", () => {
  it("تحكم على كلّ صفّ ولا تكتب شيئاً، والهرم يُملأ من التخصص", async () => {
    const a = valid({
      "الأستاذ": f.professor.employeeNumber,
      "الأهداف": "- الأوّل\n- الثاني",
      "المراجع": "دليل: https://example.org/guide.",
    });
    const res = await upload("/preview", await xlsx([a])).expect(200);
    expect(res.body.report.summary).toEqual({ total: 1, valid: 1, invalid: 0, warned: 0 });

    const { cells } = rowOf(res, 2);
    expect(cells.professor!.issues?.[0]?.message).toContain("رقمه الوظيفي");
    expect(cells.faculty).toMatchObject({ state: "auto", saved: f.faculty.name });
    expect(cells.level).toMatchObject({ state: "auto", saved: "ماستر" });
    expect(cells.status).toMatchObject({ state: "ok", value: "تمت الموافقة" });
    expect(cells.maxRequests).toMatchObject({ state: "auto", saved: "بلا سقف" });
    expect(cells.objectives!.saved).toBe("1. الأوّل\n2. الثاني");
    expect(cells.references!.saved).toBe("دليل — https://example.org/guide");
    expect(await prisma.graduationTopic.count({ where: { title: a["عنوان الموضوع"] as string } })).toBe(0);
  });

  it("والأستاذ والعدد والمراجع والحالة: كلٌّ بسببه", async () => {
    const t = title();
    const res = await upload(
      "/preview",
      await xlsx([
        valid({ "الأستاذ": "أستاذ لا وجود له" }), // 2
        valid({ "عدد الطلبة": 12 }), // 3
        valid({ "المراجع": "كتابٌ بلا رابط" }), // 4
        valid({ "الحالة": "منشوور" }), // 5
        valid({ "عنوان الموضوع": t }), // 6
        valid({ "عنوان الموضوع": `  ${t} ` }), // 7 — هو نفسه للأستاذ نفسه
        valid({ "التخصص": null }), // 8
        valid({ "الحالة": null }), // 9 — الحالة إلزامية
        valid({ "الحالة": "مقبول" }), // 10 — الاسم القديم يُقبل، ويُحفظ باسم الموقع
      ]),
    ).expect(200);
    expect(said(rowOf(res, 2).cells.professor!)).toContain("ليس أستاذاً");
    expect(said(rowOf(res, 3).cells.maxStudents!)).toContain("من 1 إلى 10");
    expect(said(rowOf(res, 4).cells.references!)).toContain("لا رابط فيه");
    expect(said(rowOf(res, 5).cells.status!)).toContain("هل تقصد «منشور»");
    expect(said(rowOf(res, 6).cells.title!)).toContain("الصفّ 7");
    expect(said(rowOf(res, 8).cells.specialization!)).toContain("إلزامي");
    expect(said(rowOf(res, 9).cells.status!)).toContain("إلزامية");
    expect(rowOf(res, 10).cells.status).toMatchObject({ state: "ok", saved: "تمت الموافقة" });
  });
});

describe("عدد الطلبة الذي قرّرته الإدارة لمستوى التخصّص", () => {
  // The fixture's specialization is a master's.
  const rule = (teamSizes: object | null) =>
    prisma.academicYear.update({ where: { id: f.academicYear.id }, data: { teamSizes: teamSizes ?? Prisma.DbNull } });
  afterEach(() => rule(null));

  it("«بالضبط 2»: الخانة الفارغة تأخذه، وعددٌ غيره يُردّ بسببه، وهو نفسه يمرّ", async () => {
    await rule({ master: { n: 2, mode: "exact" } });
    const res = await upload(
      "/preview",
      await xlsx([valid({ "عدد الطلبة": null }), valid({ "عدد الطلبة": 3 }), valid({ "عدد الطلبة": 2 })]),
    ).expect(200);
    expect(rowOf(res, 2).cells.maxStudents).toMatchObject({ state: "auto", saved: "2" });
    expect(said(rowOf(res, 2).cells.maxStudents!, "info")).toContain("ماستر");
    expect(said(rowOf(res, 3).cells.maxStudents!)).toContain("قرّرته الإدارة، لا 3");
    expect(rowOf(res, 4).errors).toBe(0);
  });

  it("«حتى 3»: ما دونه يمرّ، وما فوقه يُردّ، والفارغة تأخذ 3", async () => {
    await rule({ master: { n: 3, mode: "max" } });
    const res = await upload(
      "/preview",
      await xlsx([valid({ "عدد الطلبة": 1 }), valid({ "عدد الطلبة": 4 }), valid({ "عدد الطلبة": null })]),
    ).expect(200);
    expect(rowOf(res, 2).errors).toBe(0);
    expect(said(rowOf(res, 3).cells.maxStudents!)).toContain("لا يتجاوز 3");
    expect(rowOf(res, 4).cells.maxStudents).toMatchObject({ state: "auto", saved: "3" });
  });

  it("ومستوى بلا قاعدة، أو بلا قواعد أصلاً: الخانة الفارغة إلزامية كما كانت", async () => {
    await rule({ licence: { n: 2, mode: "exact" } });
    const res = await upload("/preview", await xlsx([valid({ "عدد الطلبة": null }), valid({ "عدد الطلبة": 5 })])).expect(200);
    expect(said(rowOf(res, 2).cells.maxStudents!)).toContain("إلزامي");
    expect(rowOf(res, 3).errors).toBe(0);
  });
});

describe("معاينة المواضيع — ملفٌّ لا يُحكم على صفوفه", () => {
  it("ملفٌّ بلا مواضيع ⇒ خطأ الملف وحده، بلا صفوف", async () => {
    const res = await upload("/preview", await xlsx([])).expect(200);
    expect(res.body.report).toMatchObject({
      fileErrors: ["الملف لا يحتوي على أيّ موضوع."],
      rows: [],
      summary: { total: 0, valid: 0, invalid: 0, warned: 0 },
    });
  });

  /** بلا أستاذٍ معروف أو بلا عنوان، أو بلا الاثنين: ما يُبحث به في المنصّة ناقص، والصفّ يُردّ بسببه. */
  it("صفوفٌ بلا أستاذٍ معروف، أو بلا عنوان، أو بلا الاثنين ⇒ تُردّ بأسبابها", async () => {
    const files: [Row, string, string][] = [
      [valid({ "الأستاذ": "أستاذ لا وجود له" }), "professor", "ليس أستاذاً"],
      [valid({ "عنوان الموضوع": null }), "title", "إلزامي"],
      [valid({ "الأستاذ": "أستاذ لا وجود له", "عنوان الموضوع": null }), "title", "إلزامي"],
    ];
    for (const [row, k, why] of files) {
      const res = await upload("/preview", await xlsx([row])).expect(200);
      expect(res.body.report.summary).toMatchObject({ total: 1, invalid: 1 });
      expect(said(rowOf(res, 2).cells[k]!)).toContain(why);
    }
  });
});

describe("استيراد المواضيع", () => {
  it("ينشئ الدفعة كلّها بقرارها، ويُعلم كلّ أستاذٍ مرّة — ولا يُعاد ملفٌّ استورد", async () => {
    const rows = [
      valid({ "الحالة": "منشور", "سقف الطلبات": 4, "الوصف": "و".repeat(400) }),
      valid({ "الحالة": "قيد الانتظار" }),
      valid({ "الأستاذ": f.professor2.universityEmail }),
    ];
    const buf = await xlsx(rows);
    const res = await upload("", buf).expect(201);
    expect(res.body.created).toBe(3);
    expect(res.body.topics.map((t: { status: string }) => t.status)).toEqual(["منشور", "قيد الانتظار", "تمت الموافقة"]);

    const saved = await prisma.graduationTopic.findMany({
      where: { title: { in: rows.map((r) => r["عنوان الموضوع"] as string) } },
      select: { title: true, status: true, publishedAt: true, maxRequests: true, description: true },
    });
    const by = new Map(saved.map((s) => [s.title, s]));
    const open = by.get(rows[0]!["عنوان الموضوع"] as string)!;
    expect(open).toMatchObject({ status: "open", maxRequests: 4 });
    expect(open.publishedAt).not.toBeNull(); // النشر بتاريخه، لا بالحالة وحدها
    expect(open.description).toHaveLength(400); // لا يُقطع عند 191
    expect(by.get(rows[1]!["عنوان الموضوع"] as string)!.status).toBe("pending");
    expect(by.get(rows[2]!["عنوان الموضوع"] as string)!.status).toBe("approved");

    const bells = await prisma.notification.findMany({
      where: { userId: { in: [f.professor.userId, f.professor2.userId] }, title: { contains: "باسمك" } },
      select: { userId: true, message: true },
    });
    expect(bells.filter((b) => b.userId === f.professor.userId)).toHaveLength(1);
    expect(bells.find((b) => b.userId === f.professor.userId)!.message).toContain("موضوعين");

    // الملف نفسه مرّةً ثانية: كلّ صفٍّ موجودٌ مسبقاً، ولا يُنشأ شيء.
    const again = await upload("", buf).expect(400);
    expect(again.body.message).toContain("لم يُستورد أيّ موضوع");
    expect(said(rowOf(again, 2).cells.title!)).toContain("موجودٌ في المنصّة مسبقاً");
  });

  it("ملفٌّ فيه خطأٌ واحد لا يُنشئ شيئاً", async () => {
    const ok = valid();
    await upload("", await xlsx([ok, valid({ "عدد الطلبة": 0 })])).expect(400);
    expect(await prisma.graduationTopic.count({ where: { title: ok["عنوان الموضوع"] as string } })).toBe(0);
  });

  /** الإشعار تابعٌ للاستيراد لا شرطٌ له: يسقط فتبقى المواضيع مُنشأة. */
  it("وإشعارٌ يسقط لا يُسقط الاستيراد", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const bell = jest.spyOn(notifications, "createNotifications").mockRejectedValueOnce(new Error("bell down"));
    try {
      const row = valid();
      const res = await upload("", await xlsx([row])).expect(201);
      expect(res.body.created).toBe(1);
      expect(await prisma.graduationTopic.count({ where: { title: row["عنوان الموضوع"] as string } })).toBe(1);
      expect(logged).toHaveBeenCalledWith("[topic-import] notifications failed:", expect.any(Error));
    } finally {
      bell.mockRestore();
      logged.mockRestore();
    }
  });

  /** الاسم في المنصّة اختياريّ: أستاذٌ بلا اسمٍ يُسمّى ببريده الجامعي — في النتيجة وفي «موجودٌ مسبقاً». */
  it("أستاذٌ بلا اسم ⇒ يُسمّى ببريده الجامعي", async () => {
    const id = f.professor2.userId;
    const names = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true },
    });
    await prisma.user.update({
      where: { id },
      data: { firstName: null, lastName: null, firstNameLatin: null, lastNameLatin: null },
    });
    try {
      const t = title();
      const res = await upload("", await xlsx([valid({ "الأستاذ": f.professor2.universityEmail, "عنوان الموضوع": t })])).expect(201);
      expect(res.body.topics[0].professor).toBe(f.professor2.universityEmail);

      // العنوان نفسه لأستاذٍ آخر الآن: يُسمّى صاحبه ببريده.
      const other = await upload("/preview", await xlsx([valid({ "عنوان الموضوع": t })])).expect(200);
      expect(said(rowOf(other, 2).cells.title!, "warning")).toContain(`«${f.professor2.universityEmail}»`);
    } finally {
      await prisma.user.update({ where: { id }, data: names });
    }
  });

  it("للإدارة وحدها", async () => {
    const buf = await xlsx([valid()]);
    await request(app).post("/api/admin/topics/import/preview").attach("file", buf, "t.xlsx").expect(401);
    await auth(request(app).post("/api/admin/topics/import/preview"), student).attach("file", buf, "t.xlsx").expect(403);
  });
});
