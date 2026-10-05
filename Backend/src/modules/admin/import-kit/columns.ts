/**
 * ما تشترك فيه ملفّات الاستيراد كلّها — الطلبة والأساتذة: شكل العمود،
 * ومطابقة العناوين، وحروف الأعمدة كما يراها المسؤول في Excel.
 *
 * ولكلّ استيرادٍ قائمة أعمدته في وحدته، مصدراً واحداً يقرؤه النموذج والمحلِّل
 * معاً: لو كتب كلٌّ منهما أسماء الأعمدة وحده لافترقا عند أوّل تعديل.
 */

/**
 * req: إلزامي · opt: اختياري · auto: يُملأ ممّا بعده إن تُرك (الكلية من
 * التخصص أو من القسم)، ويُختار من قائمةٍ تضيّق ما بعده؛ وما اختير فيه باليد
 * يُقارن عند الاستيراد بما يقتضيه.
 */
export type ColumnKind = "req" | "opt" | "auto";

/** شريط الخطوة فوق العناوين، كخطوات نافذة الإضافة. */
export type ColumnGroup = "personal" | "academic" | "professional";

export interface ImportColumn<K extends string = string> {
  key: K;
  header: string;
  kind: ColumnKind;
  width: number;
  note: string;
  group: ColumnGroup;
}

export const GROUP_LABEL: Record<ColumnGroup, string> = {
  personal: "البيانات الشخصية",
  academic: "البيانات الجامعية",
  professional: "البيانات المهنية",
};

/** ما يعرفه المحلِّل عن ملفٍّ بعينه: ورقته، وأعمدته، والعمود الذي يدلّ على صفّ العناوين. */
export interface ImportSpec<K extends string = string> {
  sheetName: string;
  columns: ImportColumn<K>[];
  /** عمودٌ إلزاميّ بعنوانٍ لا يلتبس — أوّل صفٍّ فيه عنوانه هو صفّ العناوين. */
  anchor: K;
  /** ما تكتبه صيغ الأعمدة التلقائية حين لا تجد ما تشتقّ منه — ليس قيمةً كتبها المسؤول. */
  autoUnknown: string;
  /** للرسائل: «لا يحتوي على أيّ طالب» · «فيه 1200 طالباً». */
  nounOne: string;
  nounCount: string;
}

export const MAX_IMPORT_ROWS = 1000;

/** رقم العمود ← حرفه كما يراه المسؤول في Excel: 1 ← A، 27 ← AA. */
export function columnLetter(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/**
 * عنوانٌ يُطابَق به العمود: بلا مسافاتٍ زائدة ولا «*» ولا تشكيلٍ ولا تطويل.
 * فـ«التخصّص» و«التخصص *» و«  التخصص» عمودٌ واحد.
 */
export const normalizeHeader = (s: string) =>
  s
    .replace(/[ً-ْـ]/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
