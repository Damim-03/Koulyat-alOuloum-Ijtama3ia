/**
 * مطابقة ما كتبه المسؤول بما في المنصّة.
 *
 * «كلية العلوم الإنسانية» و«كلية العلوم الانسانية» و«كليّة  العلوم الإنسانيّة»
 * اسمٌ واحد كتبه ثلاثة. فالمقارنة على صورةٍ مجرّدة: بلا تشكيلٍ ولا تطويل، والهمزات
 * ألفاً، والتاء المربوطة هاءً، والألف المقصورة ياءً، وبلا مسافاتٍ ولا ترقيم.
 * وما طابق على هذه الصورة وحدها يُقبل ويُنبَّه عليه، ليعرف المسؤول ما سيُحفظ.
 */

/** أرقامٌ عربية وفارسية ← لاتينية. */
export const latinDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** بلا تشكيلٍ ولا تطويل، ومسافاتٌ مفردة، وحروفٌ صغيرة — الفرق الذي لا يُرى. */
export const plain = (s: string) =>
  s.replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** الصورة المجرّدة للمقارنة وحدها — لا تُعرض ولا تُحفظ. */
export const loose = (s: string) =>
  latinDigits(s)
    .normalize("NFKD") // «أ» ← ا + همزة، «é» ← e + نبرة
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/ٱ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/** عدد التعديلات بين نصّين — لاقتراح «هل تقصد…؟». */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

/**
 * أقرب ما في القائمة إلى ما كُتب — أو لا شيء إن بعُد كلّها.
 *
 * قريبٌ: فرقُ حرفٍ أو حرفين (ولا يتجاوز ثلث الطول)، أو أحدهما جزءٌ من الآخر
 * («النفس العيادي» من «علم النفس العيادي»).
 */
export function closest(input: string, options: string[]): string | undefined {
  const q = loose(input);
  if (!q) return undefined;
  let best: { s: string; d: number } | undefined;
  for (const s of options) {
    const o = loose(s);
    if (!o) continue;
    const d = o.includes(q) || q.includes(o) ? Math.abs(o.length - q.length) / 4 : distance(q, o);
    if (!best || d < best.d) best = { s, d };
  }
  if (!best) return undefined;
  const limit = Math.max(2, Math.floor(q.length / 3));
  return best.d <= limit ? best.s : undefined;
}

/** «هل تقصد «X»؟» جاهزةً للإلحاق برسالة، أو فارغة. */
export const didYouMean = (input: string, options: string[]) => {
  const c = closest(input, options);
  return c ? ` هل تقصد «${c}»؟` : "";
};

/** قائمةٌ مختصرة للرسائل: أوّل n، ثم «و3 غيرها». */
export function listOf(items: string[], n = 6): string {
  const shown = items.slice(0, n).map((s) => `«${s}»`);
  return items.length > n ? `${shown.join("، ")} و${items.length - n} غيرها` : shown.join("، ");
}
