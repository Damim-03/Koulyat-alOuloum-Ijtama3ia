/**
 * جدول المناقشات — مباشرةً على قاعدة الاختبار.
 *
 * اختبار الـAPI يبرمج المناقشات ويتحقّق من التعارض. وهنا الجدول نفسه بكلّ
 * مرشّحاته: اليوم والأسبوع وما مضى وما «مبرمجٌ» فات موعده، والمدى والقاعة
 * والأستاذ، وما يحتاج إصلاحاً (بلا رئيس، بلا درجة). ثمّ الجدول المطبوع، وصفحة
 * مناقشةٍ واحدة بتقدّم مشروعها.
 */
import ExcelJS from "exceljs";

import { prisma } from "../../src/core/prisma/client";
import { defenseDetailService, exportDefensesService, listDefensesService } from "../../src/modules/admin/defenses.service";
import { listDefensesSchema } from "../../src/modules/admin/admin.validation";
import { seed, makeTopic, teardown, residue, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
const DAY = 24 * 60 * 60 * 1000;
const at: Record<"today" | "week" | "past" | "stale", { id: string; title: string }> = {} as never;

/** مناقشةٌ لمشروعٍ بموضوعٍ مأخوذ وطالبٍ واحد. */
async function defense(
  key: keyof typeof at,
  date: Date,
  status: "scheduled" | "completed",
  committee: { professorId: string; role: "president" | "supervisor" | "examiner" }[],
) {
  const topic = await makeTopic(f, `مناقشة ${key}`, "full");
  const [s] = f.nextStudents(1);
  const group = await prisma.projectGroup.create({
    data: { topicId: topic.id, members: { create: [{ studentId: s!.id, isLeader: true }] } },
  });
  const d = await prisma.defense.create({
    data: { groupId: group.id, date, room: `${TAG}-${key}`, status, committee: { create: committee } },
  });
  at[key] = { id: d.id, title: topic.title };
  return { group, student: s! };
}

beforeAll(async () => {
  await teardown();
  f = await seed(6);
  // عضو لجنةٍ بلا اسمٍ عربيّ: يُسمّى في الجدول باللاتينية.
  await prisma.user.update({
    where: { id: f.prof2User.id },
    data: { firstName: null, lastName: null, firstNameLatin: "Karim", lastNameLatin: "BENALI" },
  });

  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  await defense("today", noon, "scheduled", [{ professorId: f.professor.id, role: "supervisor" }]);
  const { group, student } = await defense("week", new Date(Date.now() + 3 * DAY), "scheduled", [
    { professorId: f.professor.id, role: "president" },
    { professorId: f.professor2.id, role: "examiner" },
  ]);
  await defense("past", new Date("2020-06-01T09:00:00Z"), "completed", [{ professorId: f.professor.id, role: "president" }]);
  await defense("stale", new Date("2021-03-01T09:00:00Z"), "scheduled", []);

  // مراحل مشروع «الأسبوع»: منجزة، ومتأخّرة بحالها، وبموعدها، ولم يحن موعدها وعليها تسليم.
  const m = (title: string, status: string, deadline: Date, order: number) =>
    prisma.milestone.create({ data: { title: `${TAG} ${title}`, status: status as never, deadline, order, groupId: group.id } });
  await m("منجزة", "completed", new Date("2020-01-01"), 1);
  await m("متأخّرة", "overdue", new Date("2999-01-01"), 2);
  await m("فات موعدها", "pending", new Date("2021-01-01"), 3);
  const ahead = await m("لم يحن موعدها", "pending", new Date("2999-01-01"), 4);
  await prisma.submission.create({
    data: { fileUrl: "/uploads/x.pdf", fileName: "x.pdf", version: 1, milestoneId: ahead.id, uploadedById: student.userId },
  });
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

const ids = async (q: Record<string, string>) =>
  (await listDefensesService(listDefensesSchema.parse({ limit: 100, room: TAG, ...q }))).items.map((d) => d.id);

describe("listDefensesService — المرشّحات", () => {
  it("المبرمجة القادمة بأستاذٍ في لجنتها، وتخصّصٍ وسنة، والأحدث أوّلاً", async () => {
    expect(
      await ids({
        status: "scheduled",
        when: "upcoming",
        professorId: f.professor2.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
        sort: "dateDesc",
      }),
    ).toEqual([at.week.id]);
  });

  it("اليوم، والأيام السبعة القادمة، وما مضى بلا درجة", async () => {
    expect(await ids({ when: "today" })).toEqual([at.today.id]);
    expect(await ids({ when: "week" })).toContain(at.week.id);
    expect(await ids({ when: "past", issue: "noGrade" })).toEqual([at.past.id]);
  });

  /** «بلا رئيس»: لجنةٌ قائمة ليس فيها رئيس — لا لجنةٌ غائبة (تلك «بلا لجنة»). */
  it("بلا رئيسٍ في لجنةٍ قائمة، وبمدى تاريخٍ من طرفيه", async () => {
    expect(await ids({ issue: "noPresident" })).toEqual([at.today.id]);
    expect(await ids({ from: "2020-01-01T00:00:00Z", to: "2020-12-31T23:59:59Z" })).toEqual([at.past.id]);
  });

  it("وصفحةٌ فارغة ⇒ لا مناقشات ولا تعارضات", async () => {
    expect(await ids({ room: `${TAG}-لا-قاعة` })).toEqual([]);
  });
});

describe("exportDefensesService — الجدول المطبوع", () => {
  it("اللجنة بصفاتها وبأسماء أعضائها — واللاتينيّ لمن لا اسم عربيّ له — والحالة بالعربية", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exportDefensesService(listDefensesSchema.parse({ room: TAG }))) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    let row: ExcelJS.Row | undefined;
    ws.eachRow((r) => {
      if ((r.values as unknown[]).includes(at.week.title)) row = r;
    });
    const cells = (row!.values as unknown[]).map(String);
    expect(cells.some((c) => c.startsWith("رئيس: ") && c.includes("مناقش: Karim BENALI"))).toBe(true);
    expect(cells).toContain("مبرمجة");
  });
});

describe("defenseDetailService", () => {
  it("تقدّم المشروع: المنجز، والمتأخّر بحاله أو بموعده، والتسليمات", async () => {
    const { defense } = await defenseDetailService(at.week.id);
    expect(defense.progress).toEqual({ total: 4, completed: 1, late: 2, submissions: 1 });
  });

  it("ومناقشةٌ انتهت ⇒ لا تعارض يُحسب لها", async () => {
    const { defense } = await defenseDetailService(at.past.id);
    expect(defense.clashes).toEqual({ room: [], professors: [] });
  });
});
