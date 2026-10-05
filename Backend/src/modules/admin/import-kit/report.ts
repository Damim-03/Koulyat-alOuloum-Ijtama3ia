import type { ColumnGroup, ColumnKind, ImportColumn } from "./columns";
import type { FileInfo, RawRow } from "./parser";

/**
 * تقرير المعاينة — خانةً خانة، لكلّ استيراد.
 *
 * لكلّ خانةٍ في التقرير: ما كُتب فيها، وما سيُحفظ منها إن خالفه، وحالها،
 * وكلّ ما قيل فيها. فالمسؤول يرى في المعاينة الملفّ كلّه كما فهمته المنصّة،
 * لا قائمة أخطاءٍ وحدها:
 *
 *   خطأ     — يمنع الاستيراد. لا يُستورد أحدٌ حتى يُصحَّح.
 *   تنبيه   — لا يمنع، لكنّه ما قد لا يقصده المسؤول.
 *   معلومة  — ما فعلته المنصّة بالقيمة: أرقامٌ عربية حُوِّلت، صفرٌ أُعيد…
 */

export type IssueLevel = "error" | "warning" | "info";
export interface CellIssue {
  level: IssueLevel;
  message: string;
}
/** ok: سليمة · error/warning: فيها ما يُقال · empty: اختيارية فارغة · auto: تملؤها المنصّة. */
export type CellState = "ok" | "error" | "warning" | "empty" | "auto";
export interface ReportCell {
  /** كما في الملف. كلمة المرور نجومٌ بطولها. */
  value: string;
  /** ما سيُحفظ أو يُشتقّ — إن خالف المكتوب، أو ملأته المنصّة. */
  saved?: string;
  state: CellState;
  issues?: CellIssue[];
}
export interface ReportRow<K extends string = string> {
  row: number;
  hidden?: boolean;
  cells: Record<K, ReportCell>;
  /** ما يخصّ الصفّ كلّه لا خانةً منه. */
  issues?: CellIssue[];
  errors: number;
  warnings: number;
}

export interface ReportColumn {
  key: string;
  header: string;
  kind: ColumnKind;
  group: ColumnGroup;
  /** حرفه في الملف المرفوع، أو null إن غاب عنه. */
  letter: string | null;
}

export interface ImportReport<K extends string = string> {
  /** ما يمنع قراءة الملف أصلاً. */
  fileErrors: string[];
  /** ما قُرئ الملف رغمه، ويحسن أن يعرفه المسؤول. */
  fileWarnings: string[];
  file?: Omit<FileInfo, "columns">;
  columns: ReportColumn[];
  rows: ReportRow<K>[];
  summary: { total: number; valid: number; invalid: number; warned: number };
}

export const columnsOf = (columns: ImportColumn[], info?: FileInfo): ReportColumn[] =>
  columns.map((c) => ({
    key: c.key,
    header: c.header,
    kind: c.kind,
    group: c.group,
    letter: info?.columns[c.key] ?? null,
  }));

export const REQUIRED = "إلزامي — الخانة فارغة.";

/**
 * خانات صفٍّ واحدٍ وما يُقال فيها، والحكم عليها يجري بها.
 *
 * تبدأ كلّ خانةٍ بما في الملف، وحالها «سليمة» أو «فارغة»؛ ثم يُسجَّل عليها ما
 * يُقال — والخطأ يغلب التنبيه، ولا يغلبه شيء. وما يخفيه Excel وراء الخانة
 * يُقال أوّلاً، قبل أيّ حكمٍ على قيمتها.
 */
export class RowCheck<K extends string> {
  readonly cells: Record<K, ReportCell>;
  readonly rowIssues: CellIssue[] = [];

  constructor(
    readonly raw: RawRow<K>,
    readonly columns: ImportColumn<K>[],
  ) {
    this.cells = Object.fromEntries(
      columns.map((c) => {
        const v = raw.cells[c.key]?.text ?? "";
        return [c.key, { value: v, state: v ? "ok" : "empty" } satisfies ReportCell];
      }),
    ) as Record<K, ReportCell>;

    for (const c of columns) {
      const rc = raw.cells[c.key];
      if (!rc || c.kind === "auto") continue;
      if (rc.excelError) {
        this.cells[c.key].value = rc.excelError;
        this.error(c.key, `في الخانة خطأ Excel (${rc.excelError}) — اكتب القيمة نفسها.`);
      } else if (rc.pending)
        this.error(c.key, "صيغةٌ لم تُحسب، فلا قيمة لها في الملف — افتحه في Excel واحفظه، أو اكتب القيمة نفسها.");
      else if (rc.lossy)
        this.error(
          c.key,
          "رقمٌ أطول من 15 خانة، وExcel لا يحفظ ما بعدها (صارت أصفاراً). اجعل العمود «نصّاً» وأعد كتابته.",
        );
      else if (rc.date) this.error(c.key, "Excel حفظ الخانة تاريخاً — اجعل العمود «نصّاً» وأعد كتابتها.");
      else if (rc.formula && rc.text) this.info(c.key, "القيمة ناتج صيغةٍ في الملف.");
    }
  }

  value(k: K): string {
    return this.cells[k].value;
  }
  say(k: K, level: IssueLevel, message: string): void {
    const cell = this.cells[k];
    (cell.issues ??= []).push({ level, message });
    if (level === "error") cell.state = "error";
    else if (level === "warning" && cell.state !== "error") cell.state = "warning";
  }
  error(k: K, m: string): void {
    this.say(k, "error", m);
  }
  warn(k: K, m: string): void {
    this.say(k, "warning", m);
  }
  info(k: K, m: string): void {
    this.say(k, "info", m);
  }
  /** ما سيُحفظ — يُذكر إن خالف المكتوب. */
  save(k: K, v: string): void {
    if (v !== this.cells[k].value) this.cells[k].saved = v;
  }
  /** تملؤها المنصّة — ولا يُخفي ذلك خطأً أو تنبيهاً قيل فيها. */
  auto(k: K, v: string): void {
    const cell = this.cells[k];
    if (cell.state !== "error" && cell.state !== "warning") cell.state = "auto";
    cell.saved = v;
  }
  blocked(k: K): boolean {
    return this.cells[k].state === "error";
  }

  finish(): ReportRow<K> {
    if (this.raw.hidden)
      this.rowIssues.push({
        level: "warning",
        message: "هذا الصفّ مخفيٌّ في Excel (مُصفّى أو مطويّ) — لا تراه هناك، وسيُستورد مع غيره.",
      });
    const all = [...Object.values<ReportCell>(this.cells).flatMap((c) => c.issues ?? []), ...this.rowIssues];
    return {
      row: this.raw.row,
      ...(this.raw.hidden ? { hidden: true } : {}),
      cells: this.cells,
      ...(this.rowIssues.length ? { issues: this.rowIssues } : {}),
      errors: all.filter((i) => i.level === "error").length,
      warnings: all.filter((i) => i.level === "warning").length,
    };
  }
}

/** ملخّص الصفوف، كما تعرضه البطاقات الأربع. */
export function summarize(rows: ReportRow[]): ImportReport["summary"] {
  const invalid = rows.filter((r) => r.errors > 0).length;
  return {
    total: rows.length,
    valid: rows.length - invalid,
    invalid,
    warned: rows.filter((r) => r.warnings > 0).length,
  };
}
