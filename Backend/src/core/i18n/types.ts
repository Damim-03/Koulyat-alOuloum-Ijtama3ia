export type Lang = "ar" | "en" | "fr";

export type Params = Record<string, string | number>;

/** نصٌّ بقيمٍ بين {{…}}، أو دالّةٌ حين يتبع اللفظُ العدد (العربية خاصّة). */
export type Text = string | ((p: Params) => string);

export type Entry = Record<Lang, Text>;

/**
 * المعدود العربيّ بعدده: [واحد، اثنان، ٣–١٠، ١١–٩٩، المئات وما يليها].
 * «arN(5, ["طالب", "طالبان", "طلاب", "طالباً", "طالب"])» ⇒ «5 طلاب».
 */
export function arN(n: number, [one, two, few, many, other]: [string, string, string, string, string]): string {
  if (n === 1) return one;
  if (n === 2) return two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} ${few}`;
  if (r >= 11) return `${n} ${many}`;
  return `${n} ${other}`;
}

/** الإنجليزية: «1 student» · «3 students». */
export const enN = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** الفرنسية: «1 étudiant» · «0 étudiant» · «3 étudiants». */
export const frN = (n: number, one: string, many: string) => `${n} ${n <= 1 ? one : many}`;
