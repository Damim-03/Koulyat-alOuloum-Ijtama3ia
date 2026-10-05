/**
 * نافذة استيراد الأساتذة — النافذة المشتركة بملمح الأساتذة.
 *
 * ما يُختبر هنا ما يختلف عن الطلبة: دليل الأعمدة المهنية، ونصوص الأساتذة
 * (admin.importProf)، ونموذجهم، وجدول حساباتهم بالرقم الوظيفي والبريد الجامعي
 * الذي يدخلون به.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", async () => {
  // ما في ملفّ الترجمة فعلاً من نصوص الأساتذة — وما سواه يُؤخذ من المشترك.
  const ar = (await import("../../../../../i18n/locales/ar.json")).default as {
    admin: { importProf: Record<string, string> };
  };
  return {
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
      i18n: {
        exists: (key: string) =>
          key.startsWith("admin.importProf.") && key.slice("admin.importProf.".length) in ar.admin.importProf,
      },
    }),
  };
});

const download = vi.hoisted(() => ({
  downloadBase64: vi.fn(),
  downloadBlob: vi.fn(),
  datedName: (b: string) => `${b}.xlsx`,
}));
vi.mock("../../../../../lib/download", () => download);
const api = vi.hoisted(() => ({ professorImportTemplate: vi.fn(async () => new Blob(["x"])) }));
vi.mock("../../../api/admin.api", () => ({ adminApi: api }));

type Opts = { onSuccess?: (v: unknown) => void; onError?: (e: unknown) => void };
let previewAnswer: unknown;
let importAnswer: unknown;
const previewM = { isPending: false, mutate: vi.fn((_f: File, o: Opts) => o.onSuccess?.(previewAnswer)) };
const importM = { isPending: false, mutate: vi.fn((_f: File, o: Opts) => o.onSuccess?.(importAnswer)) };
vi.mock("../../../hooks/admin-hook", () => ({
  useProfessorImportPreview: () => previewM,
  useImportProfessors: () => importM,
}));

const { ProfessorImportDialog } = await import("./professor-import-dialog");
const { PROFESSOR_GUIDE } = await import("./professor-import-columns");
const { cell } = await import("../import/import-report.fixture");

const columns = PROFESSOR_GUIDE.map((c, i) => ({ ...c, letter: String.fromCharCode(65 + i) }));
const profRow = (n: number) => {
  const cells = Object.fromEntries(columns.map((c) => [c.key, cell()]));
  Object.assign(cells, {
    firstName: cell("كريم"),
    lastName: cell(`بلقاسم${n}`),
    universityEmail: cell(`k${n}@univ.dz`),
    employeeNumber: cell("", { state: "auto", saved: "يُولَّد تلقائياً" }),
    faculty: cell("", { state: "auto", saved: "كلية العلوم" }),
    department: cell("قسم الإعلام الآلي"),
    grade: cell("أستاذ محاضر أ"),
    password: cell("", { state: "auto", saved: "تُولَّد تلقائياً" }),
  });
  return { row: n, cells, errors: 0, warnings: 0 };
};
const report = {
  fileErrors: [],
  fileWarnings: [],
  file: { sheetName: "الأساتذة", headerRow: 2, otherSheets: [], ignored: [] },
  columns,
  rows: [profRow(3), profRow(4)],
  summary: { total: 2, valid: 2, invalid: 0, warned: 0 },
};
const xlsx = new File(["pk"], "professors.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

describe("نافذة استيراد الأساتذة", () => {
  beforeEach(() => {
    download.downloadBase64.mockClear();
    download.downloadBlob.mockClear();
  });

  it("دليل الأعمدة المهنية، ونصوص الأساتذة، ونموذجهم", async () => {
    const user = userEvent.setup();
    render(<ProfessorImportDialog open onClose={() => {}} />);
    expect(screen.getByText("admin.importProf.title")).toBeInTheDocument();

    const guide = within(screen.getByTestId("import-column-guide"));
    expect(guide.getByText("البريد الجامعي")).toBeInTheDocument();
    expect(guide.getByText("الرقم الوظيفي")).toBeInTheDocument();
    expect(guide.getByText("admin.import.groupProfessional")).toBeInTheDocument();
    expect(guide.getByText("admin.importProf.colNote_universityEmail")).toBeInTheDocument();
    // والحقول الشخصية المشتركة بنصوص الطلبة نفسها
    expect(guide.getByText("admin.import.colNote_firstNameLatin")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-template"));
    expect(api.professorImportTemplate).toHaveBeenCalled();
    expect(download.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "professors-import.xlsx");
  });

  it("والمعاينة توزّع على الأقسام، والحسابات بالرقم الوظيفي والبريد الجامعي", async () => {
    previewAnswer = { report };
    importAnswer = {
      created: 2,
      accounts: [
        { employeeNumber: "6130112345678", universityEmail: "k3@univ.dz", firstName: "كريم", lastName: "بلقاسم3", password: "Abc123def456" },
        { employeeNumber: "6130187654321", universityEmail: "k4@univ.dz", firstName: "كريم", lastName: "بلقاسم4", password: null },
      ],
      accountsFile: "RklMRQ==",
    };
    const user = userEvent.setup({ applyAccept: false });
    render(<ProfessorImportDialog open onClose={() => {}} />);
    await user.upload(screen.getByTestId("import-file-input"), xlsx);
    await user.click(screen.getByTestId("import-preview"));

    const dist = within(screen.getByTestId("import-distribution"));
    expect(dist.getByText("قسم الإعلام الآلي")).toBeInTheDocument();
    expect(dist.getByText("أستاذ محاضر أ")).toBeInTheDocument();
    expect(dist.getByText("2")).toBeInTheDocument();
    expect(within(screen.getByTestId("import-facts")).getByText("admin.import.factEmployeeAuto")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-submit"));
    const accounts = within(screen.getByTestId("import-accounts"));
    expect(accounts.getByText("admin.import.accEmployee")).toBeInTheDocument();
    expect(accounts.getByText("6130112345678")).toBeInTheDocument();
    expect(accounts.getByText("k4@univ.dz")).toBeInTheDocument();
    expect(screen.getByTestId("import-done")).toHaveTextContent("admin.importProf.doneCount");

    await user.click(screen.getByTestId("import-download-accounts"));
    expect(download.downloadBase64).toHaveBeenCalledWith("RklMRQ==", "professors-accounts.xlsx");
  });
});
