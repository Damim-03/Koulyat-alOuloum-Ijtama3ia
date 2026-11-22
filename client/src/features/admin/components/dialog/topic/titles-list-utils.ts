import type { TitlesListGroup, TitlesListMode, TitlesListRow } from "../../../../../types/admin";

/**
 * What the sheet writes, decided apart from how it is drawn — on the model of
 * the department's own list (the Computer Science department's «List of
 * Proposed Master's Thesis Topics»): a landscape page, a header in both
 * scripts, and a table numbered by topic type.
 */

/**
 * The language the sheet is printed in — chosen for the paper, whatever the
 * screen's. The header is in both scripts whichever it is, as the
 * department writes it; the title and the table are in this one.
 */
export type SheetLang = "ar" | "en" | "fr";

/** The columns beside «#», the supervisor and the title — each may be left out. */
export type SheetColumn = "coSupervisor" | "summary" | "type" | "email" | "count";
export const SHEET_COLUMNS: SheetColumn[] = ["coSupervisor", "summary", "type", "email", "count"];

/** A landscape A4 sheet, in CSS pixels: the preview scales it to its column. */
export const PAPER_WIDTH_PX = 297 * (96 / 25.4);

const LEVEL: Record<SheetLang, Record<string, string>> = {
  ar: { licence: "الليسانس", master: "الماستر", doctorate: "الدكتوراه" },
  en: { licence: "Bachelor's", master: "Master's", doctorate: "Doctoral" },
  fr: { licence: "Licence", master: "Master", doctorate: "Doctorat" },
};

/** The header's Arabic lines, the same on every sheet. */
export const HEADER_AR = {
  republic: "الجمهورية الجزائرية الديمقراطية الشعبية",
  ministry: "وزارة التعليم العالي والبحث العلمي",
  university: "جامعة الشهيد حمه لخضر – الوادي",
};

/** The header's Latin lines: French on a French sheet, English otherwise — as the department's list. */
export const headerLatin = (lang: SheetLang) =>
  lang === "fr"
    ? {
        republic: "République Algérienne Démocratique et Populaire",
        ministry: "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
        university: "Université Echahid Hamma Lakhdar – El Oued",
      }
    : {
        republic: "People's Democratic Republic of Algeria",
        ministry: "Ministry of Higher Education and Scientific Research",
        university: "University of Shahid Hama Lakhdar – El Oued",
      };

/** The words of the table and around it, in each of the sheet's languages. */
export const SHEET_TEXT = {
  ar: {
    num: "#",
    supervisor: "المشرف",
    coSupervisor: "المشرف المساعد",
    title: "عنوان الموضوع",
    students: "الطلبة",
    summary: "وصف مختصر",
    type: "التخصص",
    email: "البريد الجامعي للمشرف",
    count: "عدد الطلبة",
    filiere: "شعبة",
    specialization: "تخصص",
    page: "الصفحة",
  },
  en: {
    num: "#",
    supervisor: "Supervisor",
    coSupervisor: "Co-supervisor",
    title: "Topic title",
    students: "Students",
    summary: "Short description",
    type: "Specialty",
    email: "Supervisor's email",
    count: "No. of students",
    filiere: "Field",
    specialization: "Specialty",
    page: "Page",
  },
  fr: {
    num: "#",
    supervisor: "Encadrant",
    coSupervisor: "Co-encadrant",
    title: "Intitulé du sujet",
    students: "Étudiants",
    summary: "Description succincte",
    type: "Spécialité",
    email: "E-mail de l'encadrant",
    count: "Nb d'étudiants",
    filiere: "Filière",
    specialization: "Spécialité",
    page: "Page",
  },
} as const;

/** A doctor's rank, as Algerian universities name it — and so the «د.» before an Arabic name. */
const DOCTOR = /محاضر|التعليم العالي|بروفيسور|professeur|\bMC[AB]\b/i;

const join = (...parts: (string | null | undefined)[]) =>
  parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");

type Person = { firstName: string | null; lastName: string | null; firstNameLatin: string | null; lastNameLatin: string | null };

/** The name in Arabic — or in Latin script when that is all there is. */
export const arabicName = (u: Person) => join(u.firstName, u.lastName) || join(u.firstNameLatin, u.lastNameLatin);

/**
 * The name in the sheet's script: Arabic on an Arabic sheet; otherwise in
 * Latin letters when known — the family name in capitals for a supervisor
 * («Abdelkader LAOUID»), as the department writes it.
 */
export function nameIn(u: Person, lang: SheetLang = "ar", capsFamily = false) {
  if (lang === "ar") return arabicName(u);
  const family = capsFamily ? u.lastNameLatin?.trim().toLocaleUpperCase("fr") : u.lastNameLatin;
  return join(u.firstNameLatin, family) || arabicName(u);
}

/** The supervisor: «د.» before a doctor's Arabic name; a Latin name as it is. */
export function supervisorName(s: { grade: unknown; id?: string; email?: string | null } & Person, lang: SheetLang = "ar") {
  const name = nameIn(s, lang, true);
  if (lang !== "ar" || !name) return name;
  const grades = Array.isArray(s.grade) ? s.grade : typeof s.grade === "string" ? [s.grade] : [];
  return grades.some((g) => typeof g === "string" && DOCTOR.test(g)) ? `د. ${name}` : name;
}

/** «قسم العلوم الاجتماعية» stays as it is; «العلوم الاجتماعية» gets its «قسم». */
export const prefixed = (name: string | undefined | null, prefix: string) => {
  const n = name?.trim();
  if (!n) return "";
  return n.startsWith(prefix) ? n : `${prefix} ${n}`;
};

/** «2026/2027» as the department writes it: «2026–2027». */
const yearOf = (title: string) => title.replace(/\s*\/\s*/g, "–");

/**
 * The sheet's title — «List of Proposed Master's Thesis Topics for the
 * 2026–2027 Academic Year» — with the year when the list has one.
 */
export function sheetHeading(mode: TitlesListMode, level: string, lang: SheetLang = "ar", year?: string | null) {
  const l = LEVEL[lang][level] ?? LEVEL[lang].master!;
  const y = year ? yearOf(year) : "";
  if (lang === "en") {
    const what = mode === "after" ? `List of Assigned ${l} Thesis Topics` : `List of Proposed ${l} Thesis Topics`;
    return y ? `${what} for the ${y} Academic Year` : what;
  }
  if (lang === "fr") {
    const what = mode === "after" ? `Liste des sujets de mémoire de ${l} attribués` : `Liste des sujets de mémoire de ${l} proposés`;
    return y ? `${what} pour l'année universitaire ${y}` : what;
  }
  const what = mode === "after" ? `قائمة عناوين مذكرات ${l}` : `قائمة المواضيع المقترحة لمذكرات ${l}`;
  return y ? `${what} للسنة الجامعية ${y}` : what;
}

/**
 * How many rows each supervisor cell spans: the run of consecutive rows of the
 * same supervisor on its first row, 0 on the rows it covers — so a
 * professor's name is written once beside all their topics.
 */
export function supervisorSpans(rows: Pick<TitlesListRow, "supervisor">[]): number[] {
  const spans = rows.map(() => 0);
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j]!.supervisor.id === rows[i]!.supervisor.id) j++;
    spans[i] = j - i;
    i = j;
  }
  return spans;
}

/**
 * The columns shown unless the administrator says otherwise — the
 * department's: the co-supervisor (a dash when none), the short description
 * (or the full one's opening), and the type when some topic has one. The
 * email and the count are there to add.
 */
export function columnsWithData(groups: TitlesListGroup[]): Set<SheetColumn> {
  const on = new Set<SheetColumn>(["coSupervisor", "summary"]);
  if (groups.some((g) => g.rows.some((r) => r.type))) on.add("type");
  return on;
}

/** The places of the header the administration has not named in Latin letters. */
export function latinGaps(groups: TitlesListGroup[]): string[] {
  const gaps = new Set<string>();
  for (const g of groups) {
    if (g.faculty && !g.faculty.nameLatin?.trim()) gaps.add(g.faculty.name);
    if (g.department && !g.department.nameLatin?.trim()) gaps.add(g.department.name);
  }
  return [...gaps];
}

/** A column of the table, in the order the sheet draws them. */
export type TableColumn = "num" | "sup" | "co" | "topic" | "students" | "summary" | "type" | "mail" | "count";

/** The printable width of a landscape A4 sheet, in mm (297 less the page's side margins). */
const TABLE_MM = 271;
/** Below this a column's text no longer reads; a number or a count needs little more. */
const MIN_MM: Record<TableColumn, number> = { num: 13, sup: 30, co: 28, topic: 46, students: 34, summary: 50, type: 26, mail: 40, count: 15 };
/** How what is left is shared: the title and the description take the most; «#» and the count none. */
const WEIGHT: Record<TableColumn, number> = { num: 0, sup: 1.1, co: 1, topic: 2.3, students: 1.4, summary: 2.7, type: 1, mail: 1.3, count: 0 };

/** The width a header takes on one line, bold at 10pt — Arabic letters are narrower. */
const headerMm = (label: string) => label.length * (/[؀-ۿ]/.test(label) ? 1.7 : 2.05) + 6;

/**
 * Each column's width, in % of the table, always 100 in all: every column at
 * least as wide as its header on one line and as its text needs; what is
 * left shared by weight. A column squeezed to a letter's width — an email
 * written down the page — cannot happen. `tight` when even the minimums
 * overflow the page: the table then sets its type smaller.
 */
export function columnWidths(cols: TableColumn[], labels: Record<TableColumn, string>): { widths: Record<string, number>; tight: boolean } {
  const min = Object.fromEntries(cols.map((c) => [c, Math.max(MIN_MM[c], headerMm(labels[c]))])) as Record<TableColumn, number>;
  const width: Partial<Record<TableColumn, number>> = {};
  let flex = cols.filter((c) => WEIGHT[c] > 0);
  for (const c of cols) if (!WEIGHT[c]) width[c] = min[c];
  let rest = TABLE_MM - cols.filter((c) => !WEIGHT[c]).reduce((n, c) => n + min[c], 0);
  // Those whose share falls short of their minimum get it; the rest share what remains.
  for (;;) {
    const total = flex.reduce((n, c) => n + WEIGHT[c], 0);
    const short = flex.filter((c) => (rest * WEIGHT[c]) / total < min[c]);
    if (!short.length) {
      for (const c of flex) width[c] = (rest * WEIGHT[c]) / total;
      break;
    }
    for (const c of short) {
      width[c] = min[c];
      rest -= min[c];
    }
    flex = flex.filter((c) => !short.includes(c));
    if (!flex.length) break;
  }
  const sum = cols.reduce((n, c) => n + (width[c] ?? 0), 0);
  return {
    widths: Object.fromEntries(cols.map((c) => [c, ((width[c] ?? 0) / sum) * 100])),
    tight: cols.reduce((n, c) => n + min[c], 0) > TABLE_MM,
  };
}

/**
 * The ink of a type's code — its tint, deep: a light green row gets a dark
 * green «IoT01», a light blue one a navy «AI01».
 */
export function inkOf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#1f3864";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  // A grey tint keeps no hue: a dark grey ink.
  const s = d < 0.02 ? 0 : 0.55;
  const l = 0.3;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + l - c / 2) * 255).toString(16).padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}
