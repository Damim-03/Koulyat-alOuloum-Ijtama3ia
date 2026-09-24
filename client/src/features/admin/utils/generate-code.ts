/** Anything in the hierarchy that carries a unique code. */
interface Coded {
  id: string;
  code?: string | null;
}

/**
 * آخرُ ختمٍ صُرف في هذه الجلسة.
 *
 * `Date.now()` يعيد الرقم نفسه لنداءين في الميلّي ثانية الواحدة — وذلك
 * يقع فعلاً حين يُنشئ المعالج صفوفاً متتابعة. فيُحفظ آخر ما صُرف ويُزاد
 * واحداً عند التساوي: يبقى الختم مُطّرداً وفريداً داخل الجلسة، وتكفله
 * الساعةُ بين الجلسات.
 */
let lastStamp = 0;

function stamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

/**
 * رمزٌ على شكل «حروفٌ ثمّ ثلاثةَ عشرَ رقماً»: `FAC-1789412345678`.
 *
 * والأرقام ختمُ الوقت بالميلّي ثانية — ثلاثةَ عشرَ رقماً إلى سنة ٢٢٨٦ —
 * فلا يتكرّر رمزٌ مرّتين: لا في هذه الجلسة (انظر `lastStamp`)، ولا بين
 * جهازين، ولا بعد إفراغ القاعدة وإعادة ملئها. وقيد `@unique` في الخادم
 * يبقى الحَكَم الأخير، لكنّه لن يُستدعى.
 *
 * وكان الذيل أربعةَ أرقامٍ عشوائية: عشرةُ آلافِ احتمالٍ لكل بادئة، تصطدم
 * أوّلَ مرّةٍ بعد نحو مئةٍ وعشرين رمزاً (مفارقة أعياد الميلاد).
 */
export function stampCode(prefix: string): string {
  return `${prefix.toUpperCase()}-${stamp()}`;
}

/** الشكل الجديد: حروفٌ ثمّ شرطةٌ ثمّ ثلاثةَ عشرَ رقماً. */
const STAMPED = /^[A-Z]+-\d{13}$/;

/**
 * هل الرمز مصكوكٌ على الشكل الجديد؟
 *
 * رموزُ ما قبل هذا التغيير على أشكالٍ شتّى (`FSSH`، `DEP-1234`، ما كتبته
 * الإدارة بيدها)، وتُستبدل عند أوّل تعديلٍ للصفّ. وما كان مصكوكاً يبقى: لا
 * يتغيّر رمزٌ تحت قدم ما يشير إليه إلّا مرّةً واحدة.
 */
export const isStampedCode = (code?: string | null): boolean =>
  STAMPED.test((code ?? "").trim());

/**
 * مثلُ `stampCode`، ويتجنّب ما هو مأخوذٌ في القائمة المُعطاة.
 *
 * @param prefix   letter that marks the level (F faculty, D department, …)
 * @param existing rows to avoid colliding with
 * @param selfId   the row being edited, so its own code is not "taken"
 */
export function generateCode(
  prefix: string,
  existing: Coded[],
  selfId?: string,
): string {
  const taken = new Set(
    existing
      .filter((e) => e.id !== selfId)
      .map((e) => (e.code ?? "").toUpperCase()),
  );

  // كلُّ نداءٍ يتقدّم بالختم، فالحلقة تنتهي حتماً.
  let code = stampCode(prefix);
  while (taken.has(code)) code = stampCode(prefix);
  return code;
}
