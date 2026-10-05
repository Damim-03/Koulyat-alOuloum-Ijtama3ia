/**
 * تقارير استيرادٍ للاختبارات — بشكل ما يُرسله الخادم، خانةً خانة.
 */
import type {
  ImportCell,
  ImportColumn,
  ImportColumnKey,
  ImportIssue,
  StudentImportReport,
  StudentImportRow,
} from "../../../../../types/admin";
import { IMPORT_GUIDE } from "../student/import-columns";

export const columns: ImportColumn[] = IMPORT_GUIDE.map((c, i) => ({
  ...c,
  letter: String.fromCharCode(65 + i),
}));

export const cell = (value = "", extra: Partial<ImportCell> = {}): ImportCell => ({
  value,
  state: value ? "ok" : "empty",
  ...extra,
});
export const err = (value: string, message: string): ImportCell => ({
  value,
  state: "error",
  issues: [{ level: "error", message }],
});
export const warn = (value: string, message: string, extra: Partial<ImportCell> = {}): ImportCell => ({
  value,
  state: "warning",
  issues: [{ level: "warning", message }],
  ...extra,
});

/** صفٌّ سليمٌ افتراضاً، وما يُمرَّر يحلّ محلّ خاناته. */
export function row(
  n: number,
  over: Partial<Record<ImportColumnKey, ImportCell>> = {},
  issues?: ImportIssue[],
): StudentImportRow {
  const cells = Object.fromEntries(columns.map((c) => [c.key, cell()])) as Record<
    ImportColumnKey,
    ImportCell
  >;
  Object.assign(cells, {
    registrationNumber: cell(`20203901${n}`),
    firstName: cell("طالب"),
    lastName: cell(`رقم${n}`),
    verified: cell("", { saved: "غير موثّق" }),
    password: cell("", { state: "auto", saved: "تُولَّد تلقائياً" }),
    academicYear: cell("2025/2026"),
    faculty: cell("", { state: "auto", saved: "كلية العلوم الاجتماعية" }),
    department: cell("", { state: "auto", saved: "قسم علم النفس" }),
    filiere: cell("", { state: "auto", saved: "علم النفس" }),
    level: cell("", { state: "auto", saved: "ماستر" }),
    specialization: cell("علم النفس العيادي"),
    ...over,
  });
  const all = [...Object.values(cells).flatMap((c) => c.issues ?? []), ...(issues ?? [])];
  return {
    row: n,
    cells,
    ...(issues ? { issues } : {}),
    errors: all.filter((i) => i.level === "error").length,
    warnings: all.filter((i) => i.level === "warning").length,
  };
}

export function report(
  rows: StudentImportRow[],
  extra: Partial<StudentImportReport> = {},
): StudentImportReport {
  const invalid = rows.filter((r) => r.errors > 0).length;
  return {
    fileErrors: [],
    fileWarnings: [],
    file: { sheetName: "الطلبة", headerRow: 2, otherSheets: [], ignored: [] },
    columns,
    rows,
    summary: {
      total: rows.length,
      valid: rows.length - invalid,
      invalid,
      warned: rows.filter((r) => r.warnings > 0).length,
    },
    ...extra,
  };
}
