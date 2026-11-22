/**
 * نافذة استيراد المواضيع المُسنَدة — النافذة المشتركة بملمحٍ مستقلّ عن
 * استيراد المواضيع: نموذجه ونصوصه (admin.importAssigned)، ومقاعد الطلبة في
 * دليل الأعمدة بلا عمود الحالة، وبعد الاستيراد المواضيع بطلبتها.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", async () => {
  const ar = (await import("../../../../../i18n/locales/ar.json")).default as {
    admin: { importAssigned: Record<string, string> };
  };
  const own = (k: string, count?: unknown) =>
    k in ar.admin.importAssigned ||
    (count !== undefined && Object.keys(ar.admin.importAssigned).some((x) => x.startsWith(`${k}_`)));
  return {
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
      i18n: {
        exists: (key: string, opts?: { count?: number }) =>
          key.startsWith("admin.importAssigned.") && own(key.slice("admin.importAssigned.".length), opts?.count),
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
const api = vi.hoisted(() => ({ assignedTopicImportTemplate: vi.fn(async () => new Blob(["x"])) }));
vi.mock("../../../api/admin.api", () => ({ adminApi: api }));

type Opts = { onSuccess?: (v: unknown) => void; onError?: (e: unknown) => void };
let previewAnswer: unknown;
let importAnswer: unknown;
const previewM = { isPending: false, mutate: vi.fn((_f: File, o: Opts) => o.onSuccess?.(previewAnswer)) };
const importM = { isPending: false, mutate: vi.fn((_f: File, o: Opts) => o.onSuccess?.(importAnswer)) };
vi.mock("../../../hooks/admin-hook", () => ({
  useAssignedTopicImportPreview: () => previewM,
  useImportAssignedTopics: () => importM,
}));

const { AssignedTopicImportDialog } = await import("./assigned-topic-import-dialog");
const { ASSIGNED_TOPIC_GUIDE } = await import("./assigned-topic-import-columns");
const { cell } = await import("../import/import-report.fixture");

const columns = ASSIGNED_TOPIC_GUIDE.map((c, i) => ({ ...c, letter: String.fromCharCode(65 + i) }));
const assignedRow = (n: number, students: string[]) => {
  const cells = Object.fromEntries(columns.map((c) => [c.key, cell()]));
  Object.assign(cells, {
    professor: cell("HAMADI Youcef"),
    title: cell(`موضوع ${n}`),
    description: cell("وصفٌ كافٍ للموضوع"),
    maxStudents: cell("3"),
    academicYear: cell("", { state: "auto", saved: "2025/2026" }),
    level: cell("", { state: "auto", saved: "ماستر" }),
    specialization: cell("علم النفس العيادي"),
  });
  students.forEach((reg, i) => (cells[`student${i + 1}`] = cell(reg, { saved: `${reg} — Student` })));
  return { row: n, cells, errors: 0, warnings: 0 };
};
const report = {
  fileErrors: [],
  fileWarnings: [],
  file: { sheetName: "المواضيع المسندة", headerRow: 2, otherSheets: [], ignored: [] },
  columns,
  rows: [assignedRow(3, ["202039000001"]), assignedRow(4, ["202039000002", "202039000003"])],
  summary: { total: 2, valid: 2, invalid: 0, warned: 0 },
};
const xlsx = new File(["pk"], "assigned.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

describe("نافذة استيراد المواضيع المُسنَدة", () => {
  it("نموذجٌ ونصوصٌ مستقلّة، ومقاعد الطلبة في الدليل بلا عمود الحالة", async () => {
    const user = userEvent.setup();
    render(<AssignedTopicImportDialog open onClose={() => {}} />);
    expect(screen.getByText("admin.importAssigned.title")).toBeInTheDocument();

    const guide = within(screen.getByTestId("import-column-guide"));
    expect(guide.getByText("الطالب 1 (المرسِل)")).toBeInTheDocument();
    expect(guide.getByText("admin.import.groupStudents")).toBeInTheDocument();
    expect(guide.getByText("admin.importAssigned.colNote_student1")).toBeInTheDocument();
    expect(guide.queryByText("الحالة")).not.toBeInTheDocument();
    expect(screen.getByText("admin.importAssigned.ruleStudents")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-template"));
    expect(api.assignedTopicImportTemplate).toHaveBeenCalled();
    expect(download.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "assigned-topics-import.xlsx");
  });

  it("المعاينة تعدّ الفرق بأحجامها، وبعد الاستيراد المواضيع بطلبتها", async () => {
    previewAnswer = { report };
    importAnswer = {
      created: 2,
      assigned: 3,
      topics: [
        { title: "موضوع 3", professor: "HAMADI Youcef", students: "AMRANI Sara", specialization: "علم النفس العيادي" },
        { title: "موضوع 4", professor: "HAMADI Youcef", students: "BELAID Ali، KADI Nour", specialization: "علم النفس العيادي" },
      ],
    };
    const user = userEvent.setup({ applyAccept: false });
    render(<AssignedTopicImportDialog open onClose={() => {}} />);
    await user.upload(screen.getByTestId("import-file-input"), xlsx);
    await user.click(screen.getByTestId("import-preview"));

    const facts = within(screen.getByTestId("import-facts"));
    expect(facts.getByText("admin.import.factGroupOne").nextSibling).toHaveTextContent("1");
    expect(facts.getByText("admin.import.factGroupTwo").nextSibling).toHaveTextContent("1");

    await user.click(screen.getByTestId("import-submit"));
    const created = within(screen.getByTestId("import-created"));
    expect(created.getByText("BELAID Ali، KADI Nour")).toBeInTheDocument();
    expect(created.getByText("admin.importAssigned.colStudents")).toBeInTheDocument();
    const stats = within(screen.getByTestId("import-done-stats"));
    expect(stats.getByText("admin.importAssigned.statStudents").nextSibling).toHaveTextContent("3");
    expect(stats.getByText("admin.importAssigned.statProfessors").nextSibling).toHaveTextContent("1");
    expect(screen.getByTestId("import-done")).toHaveTextContent('admin.importAssigned.doneCount:{"count":2}');
  });
});
