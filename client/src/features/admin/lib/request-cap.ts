/** الحدّان اللذان تقبلهما الخلفية لسقف الطلبات. */
export const CAP_MIN = 1;
export const CAP_MAX = 50;

/** ما يحمله الحقل: عددٌ ضمن الحدّين، أو فراغٌ يعني «بلا سقف». */
export type CapValue = number | "";

/**
 * يقرأ ما كُتب في حقل سقف الطلبات.
 *
 * والفراغُ ليس صفراً: الصفرُ يعني «لا يُقبل طلبٌ قطّ» — وهو معنى لا يريده
 * أحد ولا تقبله الخلفية — والفراغُ يعني «لا حدّ». والخلط بينهما يُغلق
 * الموضوع في وجه الطلبة كلِّهم بخانةٍ نُسي مسحها.
 */
export function readCap(raw: string): CapValue {
  if (raw.trim() === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return Math.max(CAP_MIN, Math.min(CAP_MAX, Math.trunc(n)));
}

/**
 * ما يُرسَل إلى الخادم: `null` للفراغ لا حذفُ الحقل.
 *
 * لأنّ التعديل جزئيّ في الخلفية — الحقلُ المحذوف يُترك على حاله — فلو
 * أُرسِل الفراغُ حذفاً لَما استطاعت الإدارة رفعَ سقفٍ وضعته يوماً.
 */
export function capPayload(value: CapValue): number | null {
  return value === "" ? null : value;
}
