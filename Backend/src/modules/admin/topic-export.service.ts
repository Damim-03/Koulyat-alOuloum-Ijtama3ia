import ExcelJS from "exceljs";

import { prisma } from "../../core/prisma/client";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { tr } from "../../core/i18n";
import type { TopicStatus } from "../../generated/prisma";
import {
  arabicCount,
  byPlace,
  displayName,
  finishWorkbook,
  levelOf,
  placeColumns,
  previewSheet,
  sheetName,
  writeSheet,
  yearColumn,
  type Column,
  type PlaceKey,
  type SheetLang,
  type SheetOptions,
} from "./export-sheet";
import { topicListWhere, type TopicListFilter } from "./topic-filters";
import { TOPIC_EXPORT_COLUMNS, type TopicExportColumn } from "./topic-export.columns";

/**
 * المواضيع في ملفّ Excel — بفلاتر صفحة المواضيع نفسها.
 *
 * ورقةٌ واحدة، صفٌّ لكلّ موضوع، بترتيب الهرم ثمّ المشرف ثمّ العنوان: مواضيع
 * التخصص الواحد متجاورة، ومواضيع الأستاذ الواحد فيه متتالية — والمشرف أوّلاً
 * ومشرفه المساعد بجانبه، اسمُ المشرف في خانةٍ واحدة كبيرة بجانب مواضيعه،
 * ولونٌ واحد لصفوفها، كقائمة القسم. ورمزُ نوع الموضوع (AI01…) في «#» بلونه،
 * ونوعُه في خانةٍ بلونه.
 *
 * و`students: "with"` يضيف طلبة كلّ موضوع: كلّ طالبٍ في خانته ورقم تسجيله
 * في الخانة التي بجانبه — «الطالب الأول (المرسِل)»، «رقم تسجيل الأول»،
 * «الطالب الثاني»… قيمةٌ واحدة في كلّ خانة: يُرشَّح بها ويُبحث فيها، وتُنسخ
 * إلى ملفٍّ آخر أو تُطابق بقائمة الطلبة. والأزواج بعدد أكبر سعةٍ بين مواضيع
 * الملف (لا بالعشرة التي تجيزها المنصّة)، وكلّ مكانٍ بلا طالب يقول لماذا.
 *
 * ولكلّ مستوى ورقته — الليسانس، ثمّ الماستر، ثمّ الدكتوراه — بعنوانها وعددها
 * ورموزها: مذكرات مستوى لا تُخلط بمذكرات آخر. وفلتر المستوى يحصر الملف في واحد.
 *
 * والملف بلغةٍ يختارها المسؤول (`lang`): العربية، أو الإنجليزية، أو الفرنسية
 * — رؤوسه وحالاته ومستوياته وعلاماته واتّجاه ورقته، والأسماء باللاتينية حيث
 * عُرفت. وبأعمدةٍ يختارها (`columns`): «#» والعنوان دائماً، وما سواهما كما شاء.
 */

export { TOPIC_EXPORT_COLUMNS, type TopicExportColumn };

export interface ExportTopicsQuery extends TopicListFilter {
  students: "with" | "without";
  lang?: SheetLang;
  /** Those shown; all of them when not said. */
  columns?: TopicExportColumn[];
}

/** فوق هذا تصير قائمةً لا يقرؤها أحد — والفلاتر أولى. */
const MAX_ROWS = 10_000;

// بمفتاح الحالة نفسها: حالةٌ جديدة في المخطّط لا تمرّ بلا اسم.
// وهي أسماء الصفحة كما تظهر في جدولها.
const STATUS: Record<SheetLang, Record<TopicStatus, string>> = {
  ar: { pending: "قيد الانتظار", approved: "تمت الموافقة", rejected: "مرفوض", open: "منشور", full: "مسند", archived: "مؤرشف" },
  en: { pending: "Pending", approved: "Approved", rejected: "Rejected", open: "Published", full: "Assigned", archived: "Archived" },
  fr: { pending: "En attente", approved: "Validé", rejected: "Rejeté", open: "Publié", full: "Attribué", archived: "Archivé" },
};

/** ولكلّ حالةٍ لونها، كشاراتها في الصفحة: المسنَد أخضر، والمنشور أزرق، والمنتظِر كهرمانيّ… */
const STATUS_TONE: Record<TopicStatus, string> = {
  pending: "FFB7791F",
  approved: "FF2E7D6B",
  rejected: "FFB0413E",
  open: "FF2B6CB0",
  full: "FF2F7D4F",
  archived: "FF8A857A",
};

/** The file's words, in each of its languages. */
const TEXT = {
  ar: {
    sheet: "المواضيع",
    title: "قائمة المواضيع",
    titleWith: "قائمة المواضيع وطلبتها",
    supervisor: "الأستاذ المشرف",
    coSupervisor: "المشرف المساعد",
    topic: "عنوان الموضوع",
    summary: "وصف مختصر",
    type: "نوع الموضوع",
    capacity: "السعة",
    status: "الحالة",
    assigned: "المسنَدون",
    student: (k: number) => (k === 0 ? "الطالب الأول (المرسِل)" : `الطالب ${nth(k)}`),
    reg: (k: number) => `رقم تسجيل ${nth(k)}`,
    vacant: "مكان شاغر",
    note: (vacant: string, none: string) => `«${vacant}»: يتّسع الموضوع لطالبٍ آخر  ·  «${none}»: خارج سعة الموضوع`,
    year: (y: string) => `السنة الجامعية ${y}`,
    allYears: "كلّ السنوات الجامعية",
    scopeStatus: (s: string) => `الحالة: ${s}`,
    scopeSupervisor: (s: string) => `المشرف: ${s}`,
    scopeSearch: (s: string) => `البحث: «${s}»`,
    count: (n: number) => topicsCount(n),
  },
  en: {
    sheet: "Topics",
    title: "List of topics",
    titleWith: "List of topics and their students",
    supervisor: "Supervisor",
    coSupervisor: "Co-supervisor",
    topic: "Topic title",
    summary: "Short description",
    type: "Type of topic",
    capacity: "Capacity",
    status: "Status",
    assigned: "Assigned",
    student: (k: number) => (k === 0 ? "Student 1 (sender)" : `Student ${k + 1}`),
    reg: (k: number) => `Reg. no. ${k + 1}`,
    vacant: "Vacant seat",
    note: (vacant: string, none: string) => `"${vacant}": the topic has room for another student  ·  "${none}": beyond the topic's capacity`,
    year: (y: string) => `Academic year ${y}`,
    allYears: "All academic years",
    scopeStatus: (s: string) => `Status: ${s}`,
    scopeSupervisor: (s: string) => `Supervisor: ${s}`,
    scopeSearch: (s: string) => `Search: "${s}"`,
    count: (n: number) => (n === 0 ? "No topics" : n === 1 ? "1 topic" : `${n} topics`),
  },
  fr: {
    sheet: "Sujets",
    title: "Liste des sujets",
    titleWith: "Liste des sujets et de leurs étudiants",
    supervisor: "Encadrant",
    coSupervisor: "Co-encadrant",
    topic: "Intitulé du sujet",
    summary: "Description succincte",
    type: "Type de sujet",
    capacity: "Capacité",
    status: "Statut",
    assigned: "Affectés",
    student: (k: number) => (k === 0 ? "Étudiant 1 (expéditeur)" : `Étudiant ${k + 1}`),
    reg: (k: number) => `Matricule ${k + 1}`,
    vacant: "Place vacante",
    note: (vacant: string, none: string) => `« ${vacant} » : le sujet peut accueillir un autre étudiant  ·  « ${none} » : au-delà de la capacité du sujet`,
    year: (y: string) => `Année universitaire ${y}`,
    allYears: "Toutes les années universitaires",
    scopeStatus: (s: string) => `Statut : ${s}`,
    scopeSupervisor: (s: string) => `Encadrant : ${s}`,
    scopeSearch: (s: string) => `Recherche : « ${s} »`,
    count: (n: number) => (n === 0 ? "Aucun sujet" : n === 1 ? "1 sujet" : `${n} sujets`),
  },
};

const person = { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } as const;

type Row = Awaited<ReturnType<typeof loadTopics>>[number];

const loadTopics = (q: TopicListFilter) =>
  prisma.graduationTopic.findMany({
    where: topicListWhere(q),
    take: MAX_ROWS + 1,
    select: {
      title: true,
      status: true,
      maxStudents: true,
      summary: true,
      academicYear: { select: { title: true } },
      professorId: true,
      professor: { select: { user: { select: person } } },
      coSupervisor: { select: { user: { select: person } } },
      type: { select: { id: true, name: true, code: true, color: true } },
      specialization: {
        select: {
          name: true,
          level: true,
          filiere: {
            select: { name: true, department: { select: { name: true, faculty: { select: { name: true } } } } },
          },
        },
      },
      projectGroup: {
        select: {
          members: {
            orderBy: [{ isLeader: "desc" }, { createdAt: "asc" }],
            select: { isLeader: true, student: { select: { registrationNumber: true, user: { select: person } } } },
          },
        },
      },
    },
  });

/** العدد والمعدود: موضوعٌ واحد، موضوعان، ٥ مواضيع، ٢٠ موضوعاً. */
export const topicsCount = (n: number): string =>
  arabicCount(n, { none: "لا مواضيع", one: "موضوعٌ واحد", two: "موضوعان", few: "مواضيع", many: "موضوعاً", hundred: "موضوع" });

const membersOf = (r: Row) => r.projectGroup?.members ?? [];

/** «#cfe2f3» ⇒ «FFCFE2F3»: لونٌ كما يكتبه Excel. */
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

/**
 * حبرُ رمز النوع: لونُه داكناً — صفٌّ أخضر فاتح برمزٍ أخضر داكن، وأزرق فاتح
 * بكحليّ (كقائمة المواضيع المطبوعة).
 */
export function inkOf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "FF1F3864";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const l = 0.3;
  const c = (1 - Math.abs(2 * l - 1)) * (d < 0.02 ? 0 : 0.55);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + l - c / 2) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `FF${to(r1)}${to(g1)}${to(b1)}`;
}

/** The place of a topic in the hierarchy, as one key: a supervisor's run never crosses into another specialization. */
const placeKey = (r: Row) => {
  const s = r.specialization;
  return [s.filiere.department.faculty.name, s.filiere.department.name, s.filiere.name, s.level, s.name].join("|");
};
const supervisorKey = (r: Row) => `${placeKey(r)}|${r.professorId}`;

/**
 * Each row's code: its type's letters and its count so far in its
 * specialization — AI01, AI02, IoT01… — or none for a topic without a type.
 */
function codesOf(rows: Row[]): (string | null)[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    if (!r.type) return null;
    const key = `${placeKey(r)}|${r.type.id}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return `${r.type.code}${String(n).padStart(2, "0")}`;
  });
}

// سعة الموضوع عشرة طلبة على الأكثر (LIMITS.maxStudents في الاستيراد).
const ORDINAL = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const nth = (k: number) => ORDINAL[k] ?? String(k + 1);

/**
 * خانة طالبٍ لا طالب فيها تقول لماذا، فلا تُقرأ فراغاً منسيّاً: مكانٌ في سعة
 * الموضوع ما زال يتّسع لطالب، أو مكانٌ خارج سعته أصلاً (موضوعٌ لطالبٍ واحد
 * في ملفٍّ فيه مواضيع لثلاثة). ورقم تسجيل مكانٍ بلا طالب «—»: لا رقم لأحد.
 */
const NO_SEAT = "—";

/** أماكن الموضوع كلّها، مشغولةً أو شاغرة — وفريقٌ جاوز السعة (بياناتٌ قديمة) يُعرض كاملاً. */
const seatsOf = (r: Row) => Math.max(r.maxStudents, membersOf(r).length);

/** Every column the file can carry, in its order — those not chosen are left out. */
function allColumns(lang: SheetLang, codes: (string | null)[], seats: number, withStudents: boolean, withYear: boolean) {
  const T = TEXT[lang];
  const name = (u: Parameters<typeof displayName>[0]) => displayName(u, lang);
  type Keyed = [TopicExportColumn | "code" | "title" | "students", Column<Row>];

  /**
   * زوجٌ لكلّ مكان: اسم الطالب، ثمّ رقم تسجيله — بعدد `seats`. والمرسِل أوّلاً
   * دائماً (الترتيب من الاستعلام)، فعنوان الأول يسمّيه.
   */
  const students: Column<Row>[] = Array.from({ length: seats }, (_, k): Column<Row>[] => [
    {
      header: T.student(k),
      width: 24,
      accent: true,
      value: (r) => {
        const m = membersOf(r)[k];
        if (m) return name(m.student.user);
        return k < r.maxStudents ? T.vacant : NO_SEAT;
      },
    },
    { header: T.reg(k), width: 18, center: true, text: true, accent: true, value: (r) => membersOf(r)[k]?.student.registrationNumber ?? NO_SEAT },
  ]).flat();

  const place = (key: PlaceKey) => placeColumns(lang, [key])[0]!;
  const cols: Keyed[] = [
    // The type's code in its ink — or, for a topic without a type, its place in the list.
    ["code", { header: "#", width: 8, center: true, value: (_r, i) => codes[i] ?? i + 1, tone: (r) => (r.type ? inkOf(r.type.color) : undefined) }],
    ["supervisor", { header: T.supervisor, width: 24, value: (r) => name(r.professor.user), wrap: true, merge: supervisorKey }],
    ["coSupervisor", { header: T.coSupervisor, width: 22, value: (r) => (r.coSupervisor ? name(r.coSupervisor.user) : ""), wrap: true }],
    ["title", { header: T.topic, width: 46, value: (r) => r.title, wrap: true }],
    ["summary", { header: T.summary, width: 46, value: (r) => r.summary ?? "", wrap: true }],
    [
      "type",
      {
        header: T.type,
        width: 22,
        value: (r) => r.type?.name ?? "",
        wrap: true,
        // In the type's colour, its name in bold ink — as on the printed list.
        fill: (r) => (r.type ? argb(r.type.color) : undefined),
        tone: (r) => (r.type ? "FF1F2D2A" : undefined),
      },
    ],
    ...(withStudents
      ? ([
          ...students.map((c): Keyed => ["students", c]),
          ["students", { header: T.assigned, width: 11, center: true, value: (r) => membersOf(r).length }],
        ] as Keyed[])
      : []),
    ["capacity", { header: T.capacity, width: 9, center: true, value: (r) => r.maxStudents }],
    ["status", { header: T.status, width: 14, center: true, value: (r) => STATUS[lang][r.status], tone: (r) => STATUS_TONE[r.status] }],
    ["faculty", place("faculty") as Column<Row>],
    ["department", place("department") as Column<Row>],
    ["filiere", place("filiere") as Column<Row>],
    ["level", place("level") as Column<Row>],
    ["specialization", place("specialization") as Column<Row>],
    // ما لم تُحصر السنة، فلكلّ موضوعٍ سنته في عمود.
    ...(withYear ? ([["year", yearColumn(lang) as Column<Row>]] as Keyed[]) : []),
  ];
  return cols;
}

/** أدقّ ما اختير من الهرم — وهو ما يقرؤه الشرط — باسمه. */
async function placeName(q: TopicListFilter, lang: SheetLang): Promise<string | undefined> {
  if (q.specializationId) {
    const s = await prisma.specialization.findUnique({
      where: { id: q.specializationId },
      select: { name: true, level: true },
    });
    return s ? `${s.name} — ${levelOf(s.level, lang)}` : undefined;
  }
  const named = { select: { name: true } } as const;
  const found = q.filiereId
    ? await prisma.filiere.findUnique({ where: { id: q.filiereId }, ...named })
    : q.departmentId
      ? await prisma.department.findUnique({ where: { id: q.departmentId }, ...named })
      : q.facultyId
        ? await prisma.faculty.findUnique({ where: { id: q.facultyId }, ...named })
        : null;
  return found?.name;
}

const LEVELS = ["licence", "master", "doctorate"] as const;

/**
 * The sheets the file holds — one for each level among its topics, licence
 * first — each with its name, title lines, columns, rows and options; built
 * once, then written (`exportTopicsService`) or shown before it is
 * downloaded (`previewTopicsService`): the preview cannot differ from the file.
 */
async function buildTopicSheets(q: ExportTopicsQuery) {
  const lang = q.lang ?? "ar";
  const T = TEXT[lang];
  const [topics, year, place, professor] = await Promise.all([
    loadTopics(q),
    q.academicYearId
      ? prisma.academicYear.findUnique({ where: { id: q.academicYearId }, select: { title: true } })
      : Promise.resolve(null),
    placeName(q, lang),
    q.professorId
      ? prisma.professor.findUnique({ where: { id: q.professorId }, select: { user: { select: person } } })
      : Promise.resolve(null),
  ]);
  if (topics.length > MAX_ROWS)
    throw new BadRequestException(tr("export.tooManyTopics", { max: MAX_ROWS }), ErrorCodeEnum.VALIDATION_ERROR);

  const withStudents = q.students === "with";
  const supervisorOf = (r: Row) => displayName(r.professor.user, lang);
  const sorted = [...topics].sort(
    (a, b) =>
      byPlace(a, b) ||
      supervisorOf(a).localeCompare(supervisorOf(b), lang) ||
      // Two namesakes stay apart: each one's topics together.
      a.professorId.localeCompare(b.professorId) ||
      a.title.localeCompare(b.title, lang),
  );

  // ما ضيّق القائمة، ليُعرف من الورقة وحدها ما فيها.
  const scope = [
    place,
    q.status && T.scopeStatus(STATUS[lang][q.status]),
    professor && T.scopeSupervisor(displayName(professor.user, lang)),
    q.search && T.scopeSearch(q.search),
  ].filter(Boolean) as string[];
  const yearText = year ? T.year(year.title) : T.allYears;
  const chosen = new Set<string>(q.columns ?? TOPIC_EXPORT_COLUMNS);

  // A sheet for each level the topics are of — and one, empty, when there are none.
  const levels = LEVELS.filter((l) => sorted.some((r) => r.specialization.level === l));
  const parts: { level: (typeof LEVELS)[number] | null; rows: Row[] }[] = levels.length
    ? levels.map((level) => ({ level, rows: sorted.filter((r) => r.specialization.level === level) }))
    : [{ level: null, rows: [] }];

  const taken = new Set<string>();
  return parts.map(({ level, rows }) => {
    const levelName = level ? levelOf(level, lang) : null;
    // The columns chosen — «#», the title, and the students when asked for, always.
    const keyed = allColumns(lang, codesOf(rows), Math.max(1, ...rows.map(seatsOf)), withStudents, !year).filter(
      ([key]) => key === "code" || key === "title" || key === "students" || chosen.has(key),
    );
    const columns = keyed.map(([, c]) => c);
    // What the topic is known by stays in view when scrolling to its students: «#» up to its title.
    const freeze = keyed.findIndex(([key]) => key === "title") + 1;
    const heading = withStudents ? T.titleWith : T.title;
    const title = [
      levelName ? `${heading} — ${levelName}` : heading,
      ...(scope.length ? [scope.join(" · ")] : []),
      `${yearText} — ${T.count(rows.length)}`,
    ];
    const options: SheetOptions<Row> = {
      sayNone: true,
      freeze,
      // One band per supervisor's run, beside their single cell.
      ...(chosen.has("supervisor") ? { group: supervisorKey } : {}),
      lang,
      ...(withStudents ? { marks: [T.vacant, NO_SEAT], note: T.note(T.vacant, NO_SEAT) } : {}),
    };
    return { name: sheetName(levelName ? `${T.sheet} - ${levelName}` : T.sheet, taken), title, columns, rows, options };
  });
}

export async function exportTopicsService(q: ExportTopicsQuery): Promise<Buffer> {
  const sheets = await buildTopicSheets(q);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mudhakkirati";
  wb.created = new Date();
  for (const sheet of sheets) writeSheet(wb, sheet.name, sheet.title, sheet.columns, sheet.rows, sheet.options);
  return finishWorkbook(wb);
}

/** How many rows the preview shows: enough to see the file's look, light to send. */
export const PREVIEW_ROWS = 40;

/** Each sheet's first rows as the file will draw them — to be seen before it is downloaded. */
export async function previewTopicsService(q: ExportTopicsQuery) {
  const sheets = await buildTopicSheets(q);
  return { sheets: sheets.map((sheet) => previewSheet(sheet.name, sheet.title, sheet.columns, sheet.rows, sheet.options, PREVIEW_ROWS)) };
}
