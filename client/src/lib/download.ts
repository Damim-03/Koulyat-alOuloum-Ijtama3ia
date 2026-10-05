/**
 * ينزّل ملفّاً في المتصفّح — من Blob، أو من base64 جاء في جواب JSON.
 *
 * الرابط يُنشأ ويُنقر ويُزال في لحظته، والعنوان المؤقّت يُحرَّر بعده: ملفٌّ
 * فيه كلمات مرور لا يبقى معلّقاً في ذاكرة الصفحة بعد تنزيله.
 */
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadBase64(base64: string, fileName: string, mime = XLSX_MIME) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  downloadBlob(new Blob([bytes], { type: mime }), fileName);
}

/** «students-accounts-2026-09-29.xlsx» — تاريخ اليوم، فلا يكتب ملفٌّ فوق سابقه. */
export const datedName = (base: string, ext = "xlsx") =>
  `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
