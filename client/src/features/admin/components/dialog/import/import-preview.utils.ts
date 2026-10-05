import type {
  ImportCell,
  ImportColumn,
  ImportColumnKey,
  StudentImportReport,
  StudentImportRow,
} from "../../../../../types/admin";

/**
 * حسابات المعاينة — خالصةٌ من الواجهة لتُختبر وحدها، ومشتركةٌ بين الاستيرادات.
 * وما يختلف بين الطلبة والأساتذة (بمَ يُبحث، وعلامَ يُوزَّع) يأتي في «ملمح»
 * الاستيراد (PreviewProfile).
 */

export type RowFilter = "all" | "errors" | "warnings" | "ready";

/** ما يخصّ كلّ استيرادٍ في المعاينة. */
export interface PreviewProfile {
  /** الأعمدة التي يبحث فيها مربّع البحث (مع رقم الصفّ). */
  searchKeys: ImportColumnKey[];
  searchPlaceholderKey: string;
  /** التوزيع: عمودٌ رئيس، ومسارٌ تحته، وشارة، وعمودٌ ثالث اختياري. */
  distribution: {
    main: ImportColumnKey;
    path: ImportColumnKey[];
    badge: ImportColumnKey;
    mono?: ImportColumnKey;
    /** صفٌّ فيه خطأٌ في أحد هذه لا يُعدّ: لا يُعرف أين سيكون. */
    guard: ImportColumnKey[];
    /** مفاتيح العناوين (admin.import.*): الرئيس، الشارة، الثالث. */
    headers: [string, string, string | null];
  };
  /** أرقامٌ تُضاف إلى أرقام الحقول الشخصية المشتركة. */
  extraFacts?: { labelKey: string; count: (r: StudentImportRow) => boolean }[];
}

/** التصفية الأولى: ما يستحقّ النظر أوّلاً. */
export const initialFilter = (r: StudentImportReport): RowFilter =>
  r.summary.invalid > 0 ? "errors" : r.summary.warned > 0 ? "warnings" : "all";

const hasIssue = (c?: ImportCell) => c?.state === "error" || c?.state === "warning";

export function filterRows(
  rows: StudentImportRow[],
  opts: { filter: RowFilter; column: ImportColumnKey | null; query: string; searchKeys: ImportColumnKey[] },
): StudentImportRow[] {
  const q = opts.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.filter === "errors" && r.errors === 0) return false;
    if (opts.filter === "warnings" && r.warnings === 0) return false;
    if (opts.filter === "ready" && r.errors > 0) return false;
    if (opts.column && !hasIssue(r.cells[opts.column])) return false;
    if (q) {
      const hay = [
        String(r.row),
        ...opts.searchKeys.flatMap((k) => [r.cells[k]?.value ?? "", r.cells[k]?.saved ?? ""]),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface ColumnStat {
  column: ImportColumn;
  filled: number;
  errors: number;
  warnings: number;
}

/** لكلّ عمود: كم خانةً مملوءة، وكم فيها خطأ أو تنبيه. */
export function columnStats(report: StudentImportReport): ColumnStat[] {
  return report.columns.map((column) => {
    let filled = 0;
    let errors = 0;
    let warnings = 0;
    for (const r of report.rows) {
      const c = r.cells[column.key];
      if (!c) continue;
      if (c.value) filled++;
      if (c.state === "error") errors++;
      else if (c.state === "warning") warnings++;
    }
    return { column, filled, errors, warnings };
  });
}

/** ما سيُحفظ من الخانة: المشتقّ أو المصحَّح إن وُجد، وإلّا المكتوب. */
export const effective = (c?: ImportCell) => (c ? (c.saved ?? c.value) : "");

export interface DistributionRow {
  main: string;
  badge: string;
  mono: string;
  path: string;
  count: number;
}

/**
 * توزيع الدفعة — من الصفوف التي سلمت أعمدة التوزيع فيها، كما ستُحفظ. يرى
 * المسؤول فيه في لمحةٍ «40 في الماستر» حيث توقّع 45. وصفٌّ فيه تعارضٌ في
 * هذه الأعمدة لا يُعدّ: لا يُعرف أين سيكون.
 */
export function distribution(rows: StudentImportRow[], d: PreviewProfile["distribution"]): DistributionRow[] {
  const m = new Map<string, DistributionRow>();
  for (const r of rows) {
    const main = effective(r.cells[d.main]);
    if (d.guard.some((k) => r.cells[k]?.state === "error") || !main) continue;
    if (d.mono && !effective(r.cells[d.mono])) continue;
    const badge = effective(r.cells[d.badge]).split("، ")[0] ?? "";
    const mono = d.mono ? effective(r.cells[d.mono]) : "";
    const key = [main, badge, mono].join("\u0000");
    const hit = m.get(key);
    if (hit) hit.count++;
    else
      m.set(key, {
        main,
        badge,
        mono,
        path: d.path.map((k) => effective(r.cells[k])).filter(Boolean).join(" › "),
        count: 1,
      });
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export interface Fact {
  labelKey: string;
  value: number;
  muted?: boolean;
}

/** ما ستحمله الدفعة، مجمَّلاً — من الصفوف الجاهزة وحدها، فهي ما سيُستورد. */
export function facts(rows: StudentImportRow[], extra: PreviewProfile["extraFacts"] = []): Fact[] {
  const ready = rows.filter((r) => r.errors === 0);
  const count = (pred: (r: StudentImportRow) => boolean) => ready.filter(pred).length;
  const g = (r: StudentImportRow) => effective(r.cells.gender);
  return [
    { labelKey: "factMale", value: count((r) => g(r) === "ذكر") },
    { labelKey: "factFemale", value: count((r) => g(r) === "أنثى") },
    { labelKey: "factNoGender", value: count((r) => g(r) !== "ذكر" && g(r) !== "أنثى"), muted: true },
    { labelKey: "factVerified", value: count((r) => effective(r.cells.verified) === "موثّق") },
    { labelKey: "factGenerated", value: count((r) => r.cells.password?.state === "auto") },
    { labelKey: "factGiven", value: count((r) => r.cells.password?.state !== "auto") },
    { labelKey: "factEmail", value: count((r) => !!r.cells.email?.value) },
    { labelKey: "factPhone", value: count((r) => !!r.cells.phone?.value) },
    { labelKey: "factLatin", value: count((r) => !!(r.cells.firstNameLatin?.value || r.cells.lastNameLatin?.value)) },
    ...extra.map((x) => ({ labelKey: x.labelKey, value: count(x.count) })),
  ];
}
