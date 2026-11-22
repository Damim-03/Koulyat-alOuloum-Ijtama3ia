/**
 * البحث في نصٍّ عربيّ أو لاتينيّ كما يكتبه الناس: بلا تشكيل، والهمزات ألفاً،
 * والتاء المربوطة هاءً، والألف المقصورة ياءً، والكبير صغيراً، والتطويل لا
 * شيء. فـ«احمد» تجد «أحمد»، و«مذكره» تجد «مذكّرة»، و«ali» تجد «Ali».
 */

/** حرفٌ واحدٌ مطويّاً — وقد يصير لا شيء (حركةٌ أو تطويل). */
function foldChar(c: string): string {
  return c
    .toLowerCase()
    .normalize("NFKD")
    // العلامات كلّها بعد التفكيك: الحركات، والهمز فوق الألف وتحتها، والنبرات اللاتينية؛ ثمّ التطويل.
    .replace(/\p{M}/gu, "")
    .replace(/\u0640/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647");
}

/** النصّ مطويّاً للمقارنة. */
export function foldText(s: string): string {
  let out = "";
  for (const c of s) out += foldChar(c);
  return out;
}

/** كلمات البحث مطويّةً، بلا فراغ. */
export function searchWords(q: string): string[] {
  return foldText(q).split(/\s+/).filter(Boolean);
}

/**
 * مواضع الكلمات في النصّ الأصليّ، [بداية، نهاية) مرتّبةً ومدموجة.
 *
 * يُطوى النصّ حرفاً حرفاً ويُحفظ لكلّ حرفٍ مطويّ موضعه في الأصل؛ فتُعلَّم
 * «أحمد» كاملةً بهمزتها حين يُكتب «احمد»، والحركات بين حروفها داخلةٌ فيها.
 */
export function matchRanges(text: string, words: string[]): [number, number][] {
  if (!text || !words.length) return [];
  let folded = "";
  const from: number[] = [];
  let i = 0;
  for (const c of text) {
    const f = foldChar(c);
    for (let k = 0; k < f.length; k++) from.push(i);
    folded += f;
    i += c.length;
  }

  const found: [number, number][] = [];
  for (const w of words) {
    let at = folded.indexOf(w);
    while (at !== -1) {
      const end = at + w.length;
      // نهاية المطابقة في الأصل: حتى الحرف الأصليّ الذي يبدأ بعدها.
      found.push([from[at]!, end < from.length ? from[end]! : text.length]);
      at = folded.indexOf(w, at + 1);
    }
  }
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged: [number, number][] = [];
  for (const r of found) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
