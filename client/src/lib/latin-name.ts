/**
 * الاسم باللاتينية — القاعدة نفسها التي يفرضها الخادم (admin.validation).
 *
 * حروفٌ لاتينية، بما فيها المشكولة الفرنسية (é، ç…)، ومسافةٌ أو شرطةٌ أو
 * فاصلةٌ علوية بين الكلمات. ويُكتب على عادة الوثائق الفرنسية: اللقب بأحرفٍ
 * كبيرة (HAMADI)، والاسم بحرفٍ أوّلَ كبيرٍ لكلّ كلمة (Nour El Houda).
 *
 * والتوحيد هنا عند مغادرة الحقل ليرى المسؤول ما سيُحفظ قبل الحفظ؛ والخادم
 * يوحّد كذلك، فلا يمرّ غيرُ الموحَّد من طريقٍ آخر.
 */
export const LATIN_NAME = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

const squash = (s: string) => s.trim().replace(/\s+/g, " ");

export const toLatinLast = (s: string) => squash(s).toLocaleUpperCase("fr");

export const toLatinFirst = (s: string) =>
  squash(s)
    .toLocaleLowerCase("fr")
    .replace(/(^|[ '-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase("fr"));
