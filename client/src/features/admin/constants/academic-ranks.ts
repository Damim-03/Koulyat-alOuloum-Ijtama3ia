/**
 * The teaching ranks of the Algerian university system, in the spelling the
 * database already holds. Deliberately not translated: like the faculty and
 * department names, this is stored data shown as-is in every language, and
 * translating it would put two spellings of one rank into the same column.
 *
 * It lives apart from the input that offers it so that file exports a
 * component and nothing else — a constant beside it breaks fast refresh.
 */
export const ACADEMIC_RANKS = [
  "أستاذ التعليم العالي",
  "أستاذ محاضر أ",
  "أستاذ محاضر ب",
  "أستاذ مساعد أ",
  "أستاذ مساعد ب",
] as const;
