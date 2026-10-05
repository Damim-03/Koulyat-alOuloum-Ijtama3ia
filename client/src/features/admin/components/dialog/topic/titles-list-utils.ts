import type { TitlesListMode, TitlesListRow } from "../../../../../types/admin";

/** What the sheet writes, decided apart from how it is drawn. */

export type Orientation = "portrait" | "landscape";

const LEVEL: Record<string, string> = { licence: "الليسانس", master: "الماستر", doctorate: "الدكتوراه" };

/** A doctor's rank, as Algerian universities name it — and so the «د.» before the name. */
const DOCTOR = /محاضر|التعليم العالي|بروفيسور|professeur|\bMC[AB]\b/i;

const join = (...parts: (string | null | undefined)[]) =>
  parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");

type Person = { firstName: string | null; lastName: string | null; firstNameLatin: string | null; lastNameLatin: string | null };

/** The name in Arabic, as the document is — or in Latin script when that is all there is. */
export const arabicName = (u: Person) => join(u.firstName, u.lastName) || join(u.firstNameLatin, u.lastNameLatin);

export function supervisorName(s: TitlesListRow["supervisor"]) {
  const grades = Array.isArray(s.grade) ? s.grade : typeof s.grade === "string" ? [s.grade] : [];
  const doctor = grades.some((g) => typeof g === "string" && DOCTOR.test(g));
  const name = arabicName(s);
  return doctor && name ? `د. ${name}` : name;
}

/** «قسم العلوم الاجتماعية» stays as it is; «العلوم الاجتماعية» gets its «قسم». */
export const prefixed = (name: string | undefined | null, prefix: string) => {
  const n = name?.trim();
  if (!n) return "";
  return n.startsWith(prefix) ? n : `${prefix} ${n}`;
};

export function sheetHeading(mode: TitlesListMode, level: string) {
  const l = LEVEL[level] ?? "";
  return (mode === "after" ? `قائمة عناوين مذكرات ${l}` : `قائمة المواضيع المقترحة لمذكرات ${l}`).trim();
}

/** dd/mm/yyyy, in the digits an official document is dated with. */
export const sheetDate = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** The width of the paper, for the preview to scale it to its column. */
export const paperWidthPx = (o: Orientation) => (o === "portrait" ? 210 : 297) * (96 / 25.4);
