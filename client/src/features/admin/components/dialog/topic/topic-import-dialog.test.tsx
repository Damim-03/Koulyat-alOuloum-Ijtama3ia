/**
 * نافذة استيراد المواضيع — النافذة المشتركة بملمح المواضيع.
 *
 * ما يُختبر هنا ما يختلف عن استيراد الحسابات: دليل الأعمدة (الأستاذ والموضوع
 * والقرار)، ونصوص المواضيع (admin.importTopic)، وقواعدها بلا كلمات مرور،
 * والمعاينة بلا أرقام الحقول الشخصية، وبعد الاستيراد قائمةُ ما أُنشئ — لا
 * حسابات تُنزَّل ولا تنبيه قبل الإغلاق.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", async () => {
  // ما في ملفّ الترجمة فعلاً من نصوص المواضيع — وما سواه يُؤخذ من المشترك.
  const ar = (await import("../../../../../i18n/locales/ar.json")).default as {
    admin: { importTopic: Record<string, string> };
  };
  const own = (k: string, count?: unknown) =>
    k in ar.admin.importTopic ||
    (count !== undefined && Object.keys(ar.admin.importTopic).some((x) => x.startsWith(`${k}_`)));
  return {
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
      i18n: {
        exists: (key: string, opts?: { count?: number }) =>
          key.startsWith("admin.importTopic.") && own(key.slice("admin.importTopic.".length), opts?.count),
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
const api = vi.hoisted(() => ({ topicImportTemplate: vi.fn(async () => new Blob(["x"])) }));
vi.mock("../../../api/admin.api", () => ({ adminApi: api }));

type Opts = { onSuccess?: (v: unknown) => void; onError?: (e: unknown) => void };
let previewAnswer: unknown;
let importAnswer: unknown;
const previewM = { isPending: false, mutate: vi.fn((_f: File, o: Opts) => o.onSuccess?.(previewAnswer)) };
const importM = { isPending: false, mutate: vi.fn((_f: File, o: Opts) => o.onSuccess?.(importAnswer)) };
vi.mock("../../../hooks/admin-hook", () => ({
  useTopicImportPreview: () => previewM,
  useImportTopics: () => importM,
}));

const { TopicImportDialog } = await import("./topic-import-dialog");
const { TOPIC_GUIDE } = await import("./topic-import-columns");
const { cell } = await import("../import/import-report.fixture");

const columns = TOPIC_GUIDE.map((c, i) => ({ ...c, letter: String.fromCharCode(65 + i) }));
const topicRow = (n: number, status: string) => {
  const cells = Object.fromEntries(columns.map((c) => [c.key, cell()]));
  Object.assign(cells, {
    professor: cell("HAMADI Youcef"),
    title: cell(`موضوع ${n}`),
    description: cell("وصفٌ كافٍ للموضوع"),
    objectives: cell("- الأوّل\n- الثاني", { saved: "1. الأوّل\n2. الثاني" }),
    maxStudents: cell("2"),
    maxRequests: cell("", { state: "auto", saved: "بلا سقف" }),
    academicYear: cell("", { state: "auto", saved: "2025/2026" }),
    faculty: cell("", { state: "auto", saved: "كلية العلوم" }),
    level: cell("", { state: "auto", saved: "ماستر" }),
    specialization: cell("علم النفس العيادي"),
    status: cell(status),
  });
  return { row: n, cells, errors: 0, warnings: 0 };
};
const report = {
  fileErrors: [],
  fileWarnings: [],
  file: { sheetName: "المواضيع", headerRow: 2, otherSheets: [], ignored: [] },
  columns,
  rows: [topicRow(3, "منشور"), topicRow(4, "تمت الموافقة")],
  summary: { total: 2, valid: 2, invalid: 0, warned: 0 },
};
const xlsx = new File(["pk"], "topics.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

describe("نافذة استيراد المواضيع", () => {
  beforeEach(() => {
    download.downloadBase64.mockClear();
    download.downloadBlob.mockClear();
  });

  it("دليل الأعمدة بالأستاذ والموضوع والقرار، ونصوص المواضيع، وقواعدها بلا كلمات مرور", async () => {
    const user = userEvent.setup();
    render(<TopicImportDialog open onClose={() => {}} />);
    expect(screen.getByText("admin.importTopic.title")).toBeInTheDocument();

    const guide = within(screen.getByTestId("import-column-guide"));
    expect(guide.getByText("عنوان الموضوع")).toBeInTheDocument();
    for (const g of ["groupSupervisor", "groupTopic", "groupAcademic", "groupDecision"])
      expect(guide.getByText(`admin.import.${g}`)).toBeInTheDocument();
    expect(guide.getByText("admin.importTopic.colNote_professor")).toBeInTheDocument();
    // والهرم الجامعيّ بنصوص الطلبة نفسها
    expect(guide.getByText("admin.import.colNote_specialization")).toBeInTheDocument();

    expect(screen.getByText("admin.importTopic.ruleStatus")).toBeInTheDocument();
    expect(screen.queryByText("admin.import.rulePasswords")).not.toBeInTheDocument();
    expect(screen.getByText("topics-import.xlsx")).toBeInTheDocument(); // الورقة المصغّرة باسم ملفّها

    await user.click(screen.getByTestId("import-template"));
    expect(api.topicImportTemplate).toHaveBeenCalled();
    expect(download.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "topics-import.xlsx");
  });

  it("المعاينة توزّع على التخصصات بلا أرقام الحسابات، وبعد الاستيراد قائمةُ ما أُنشئ", async () => {
    previewAnswer = { report };
    importAnswer = {
      created: 2,
      topics: [
        { title: "موضوع 3", professor: "HAMADI Youcef", specialization: "علم النفس العيادي", status: "منشور" },
        { title: "موضوع 4", professor: "HAMADI Youcef", specialization: "علم النفس العيادي", status: "تمت الموافقة" },
      ],
    };
    const onClose = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(<TopicImportDialog open onClose={onClose} />);
    await user.upload(screen.getByTestId("import-file-input"), xlsx);
    await user.click(screen.getByTestId("import-preview"));

    const dist = within(screen.getByTestId("import-distribution"));
    expect(dist.getByText("علم النفس العيادي")).toBeInTheDocument();
    expect(dist.getByText("ماستر")).toBeInTheDocument();
    const facts = within(screen.getByTestId("import-facts"));
    expect(facts.getByText("admin.import.factTopicPublished")).toBeInTheDocument();
    expect(facts.queryByText("admin.import.factMale")).not.toBeInTheDocument();
    expect(screen.getByText("admin.importTopic.firstRow")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-submit"));
    const created = within(screen.getByTestId("import-created"));
    expect(created.getByText("موضوع 3")).toBeInTheDocument();
    expect(created.getByText("admin.importTopic.colProfessor")).toBeInTheDocument();
    expect(created.getAllByText("HAMADI Youcef")).toHaveLength(2);
    expect(created.getByText("منشور")).toBeInTheDocument();
    expect(screen.getByTestId("import-done")).toHaveTextContent('admin.importTopic.doneCount:{"count":2}');
    const stats = within(screen.getByTestId("import-done-stats"));
    expect(stats.getByText("admin.importTopic.statPublished").nextSibling).toHaveTextContent("1");
    expect(stats.getByText("admin.importTopic.statApproved").nextSibling).toHaveTextContent("1");
    expect(screen.queryByTestId("import-download-accounts")).not.toBeInTheDocument();

    // لا كلمات مرور تضيع: الإغلاق من أوّل ضغطة.
    await user.click(screen.getByTestId("import-finish"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
