/**
 * ترميزُ EAN-13 — من ثلاثة عشر رقماً إلى خطوطٍ تُمسح.
 *
 * ولم يُختر المعيار زينةً: القارئُ الشريطيّ العاديّ — في مكتبة الكلّية أو
 * على حاسوب الأرشيف — يقرأ EAN-13 بلا إعداد، ويحسب رقم التحقّق ويرفض ما
 * لا يوافقه. فرمزٌ من ثلاثة عشر رقماً عشوائيةً كلِّها يبدو رمزاً ولا يُمسح.
 *
 * والبيانات هنا **جدولٌ واحد**: `L`. أمّا `R` فمتمّمُه بتاً بتاً، و`G`
 * مقلوبُ `R`. وهذه علاقاتُ المعيار نفسها، وكتابتُها اشتقاقاً بدل نسخ ثلاثين
 * سطراً بالأصابع يُغلق باباً كاملاً من أخطاء النسخ.
 */

/** أنماطُ المجموعة اليسرى ذات التكافؤ الفردي — عدد آحادها فردي. */
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];

const flip = (bits: string) =>
  bits.replace(/[01]/g, (b) => (b === "0" ? "1" : "0"));

/** المجموعة اليمنى: متمّمُ اليسرى. */
const R = L.map(flip);

/** التكافؤ الزوجي: مقلوبُ اليمنى. */
const G = R.map((bits) => [...bits].reverse().join(""));

/**
 * الرقمُ الأوّل لا يُرسم خطّاً، إنّما يُرمَّز في ترتيب تكافؤ الستّة بعده.
 * ولذلك كان EAN-13 ثلاثةَ عشر رقماً في عرض اثني عشر.
 */
const PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

const GUARD = "101";
const CENTER = "01010";

/**
 * رقمُ التحقّق: مجموعٌ موزونٌ ١ و٣ بالتناوب، ثمّ المتمّم للعشرة.
 *
 * وهو نسخةُ ما يحسبه الخادم عند الإصدار؛ وهنا ليُرفض ما تكتبه اليد خطأً
 * قبل أن يُرسَل، فلا ينتظر المستعمل جواب الشبكة ليعرف أنّه أخطأ رقماً.
 */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** ثلاثة عشر رقماً، آخرُها يوافق حسابَ المعيار. */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return Number(code[12]) === ean13CheckDigit(code.slice(0, 12));
}

/**
 * يردّ ٩٥ وحدةً من `0` و`1` — أبيضَ وأسود — أو `null` لرمزٍ غير صالح.
 *
 * ٩٥ = ٣ حارس + ٤٢ يسار + ٥ وسط + ٤٢ يمين + ٣ حارس.
 */
export function ean13Modules(code: string): string | null {
  if (!isValidEan13(code)) return null;

  const parity = PARITY[Number(code[0])];
  let left = "";
  for (let i = 0; i < 6; i++) {
    const digit = Number(code[1 + i]);
    left += parity[i] === "L" ? L[digit] : G[digit];
  }

  let right = "";
  for (let i = 0; i < 6; i++) right += R[Number(code[7 + i])];

  return GUARD + left + CENTER + right + GUARD;
}

/** مواضعُ الوحدات التي تمتدّ خطوطُها أسفل الباقي: الحارسان والوسط. */
export function isGuardModule(index: number): boolean {
  return index < 3 || (index >= 45 && index < 50) || index >= 92;
}
