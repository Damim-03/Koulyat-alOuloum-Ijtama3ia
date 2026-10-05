/**
 * نافذة استيراد الطلبة.
 *
 * ما يستحقّ اختباراً هنا ما لو انكسر لكلّف المسؤول دفعةً: أن يُستورد ملفٌّ
 * فيه خطأ، أو تُغلق النافذة وكلمات المرور المولَّدة لم تُنزَّل بعد، أو يبقى
 * التقرير القديم ظاهراً وقد تغيّرت المنصّة بين المعاينة والاستيراد.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

const download = vi.hoisted(() => ({
  downloadBase64: vi.fn(),
  downloadBlob: vi.fn(),
  datedName: (b: string) => `${b}.xlsx`,
}));
vi.mock("../../../../../lib/download", () => download);
vi.mock("../../../api/admin.api", () => ({
  adminApi: { studentImportTemplate: vi.fn(async () => new Blob(["x"])) },
}));

type Opts = { onSuccess?: (v: unknown) => void; onError?: (e: unknown) => void };
let previewAnswer: unknown;
let importAnswer: { ok: boolean; value: unknown };
const previewM = {
  isPending: false,
  mutate: vi.fn((_f: File, o: Opts) => o.onSuccess?.(previewAnswer)),
};
const importM = {
  isPending: false,
  mutate: vi.fn((_f: File, o: Opts) =>
    importAnswer.ok ? o.onSuccess?.(importAnswer.value) : o.onError?.(importAnswer.value),
  ),
};
vi.mock("../../../hooks/admin-hook", () => ({
  useStudentImportPreview: () => previewM,
  useImportStudents: () => importM,
}));

const { StudentImportDialog } = await import("./student-import-dialog");

const { report, row, err, warn } = await import("../import/import-report.fixture");

const xlsx = new File(["pk"], "students.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

async function toPreview(onClose = vi.fn()) {
  const user = userEvent.setup({ applyAccept: false });
  render(<StudentImportDialog open onClose={onClose} />);
  await user.upload(screen.getByTestId("import-file-input"), xlsx);
  await user.click(screen.getByTestId("import-preview"));
  return { user, onClose };
}

describe("نافذة الاستيراد", () => {
  beforeEach(() => {
    previewM.mutate.mockClear();
    importM.mutate.mockClear();
    download.downloadBase64.mockClear();
  });

  it("«معاينة» معطّلة بلا ملف، وغيرُ xlsx يُردّ قبل أن يُرفع", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<StudentImportDialog open onClose={() => {}} />);
    expect(screen.getByTestId("import-preview")).toBeDisabled();

    await user.upload(
      screen.getByTestId("import-file-input"),
      new File(["a,b"], "students.csv", { type: "text/csv" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("admin.import.onlyXlsx");
    expect(screen.getByTestId("import-preview")).toBeDisabled();

    await user.upload(screen.getByTestId("import-file-input"), xlsx);
    expect(screen.getByTestId("import-file-name")).toHaveTextContent("students.xlsx");
    expect(screen.getByTestId("import-preview")).toBeEnabled();
  });

  it("والخطأ في صفّه وعموده، والاستيراد معطّل، والملف المُعلَّم يُنزَّل", async () => {
    previewAnswer = {
      report: report([
        row(3),
        row(4, { specialization: err("تخصص غير موجود", "ليس تخصّصاً في المنصّة.") }),
      ]),
      annotatedFile: "QUJD",
    };
    const { user } = await toPreview();

    expect(screen.getByTestId("import-invalid")).toHaveTextContent("1");
    expect(screen.getByTestId("import-submit")).toBeDisabled();
    // الأخطاء فقط افتراضياً: الصفّ الرابع وحده.
    const table = within(screen.getByTestId("import-table"));
    expect(table.getByText(/ليس تخصّصاً/)).toBeInTheDocument();
    expect(screen.queryByTestId("import-row-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-row-4")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-download-annotated"));
    expect(download.downloadBase64).toHaveBeenCalledWith("QUJD", "students-import-errors.xlsx");
  });

  /** التنبيه يُعرض ولا يمنع: الاستيراد متاح. */
  it("والتنبيهات تُعرض أوّلاً ولا تمنع الاستيراد", async () => {
    previewAnswer = {
      report: report([row(3), row(4, { academicYear: warn("2024/2025", "ليست السنة الجامعية الجارية.") })]),
      annotatedFile: "V0FSTg==",
    };
    await toPreview();

    expect(screen.getByTestId("import-verdict-warning")).toBeInTheDocument();
    expect(screen.getByTestId("import-warned")).toHaveTextContent("1");
    expect(screen.getByTestId("import-submit")).toBeEnabled();
    expect(screen.getByTestId("import-filter-warnings")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("import-row-3")).not.toBeInTheDocument();
    expect(screen.getByText(/ليست السنة الجامعية الجارية/)).toBeInTheDocument();
  });

  it("وملفٌّ سليم يُستورد، ثم تُنزَّل الحسابات", async () => {
    previewAnswer = { report: report([row(3), row(4)]) };
    importAnswer = {
      ok: true,
      value: {
        created: 2,
        accounts: [
          { registrationNumber: "1", firstName: "أ", lastName: "ب", password: "Abc123def456" },
          { registrationNumber: "2", firstName: "ج", lastName: "د", password: null },
        ],
        accountsFile: "RklMRQ==",
      },
    };
    const { user } = await toPreview();

    await user.click(screen.getByTestId("import-submit"));
    expect(importM.mutate).toHaveBeenCalledWith(xlsx, expect.anything());

    const done = screen.getByTestId("import-done");
    expect(done).toHaveTextContent("2");
    expect(done).toHaveTextContent('admin.import.passwordsTitle:{"count":1}');

    await user.click(screen.getByTestId("import-download-accounts"));
    expect(download.downloadBase64).toHaveBeenCalledWith("RklMRQ==", "students-accounts.xlsx");
  });

  /** كلمات المرور لا تُرى بعد النافذة: الإغلاق قبل التنزيل يُنبَّه عليه. */
  it("والإغلاق قبل تنزيل الحسابات يُنبَّه عليه، والثاني يُغلق", async () => {
    previewAnswer = { report: report([row(3)]) };
    importAnswer = {
      ok: true,
      value: {
        created: 1,
        accounts: [{ registrationNumber: "1", firstName: "أ", lastName: "ب", password: "Abc123def456" }],
        accountsFile: "RklMRQ==",
      },
    };
    const onClose = vi.fn();
    const { user } = await toPreview(onClose);
    await user.click(screen.getByTestId("import-submit"));

    await user.click(screen.getByTestId("import-finish"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("admin.import.closeWarning");

    await user.click(screen.getByTestId("import-close-anyway"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /** تغيّرت المنصّة بين المعاينة والاستيراد: التقرير الجديد يحلّ محلّ القديم. */
  it("واستيرادٌ رُدّ بتقرير ⇒ يُعرض التقرير الجديد، ولم يُنشأ أحد", async () => {
    previewAnswer = { report: report([row(3)]) };
    importAnswer = {
      ok: false,
      value: {
        response: {
          data: {
            message: "الملف فيه أخطاء — لم يُستورد أحد.",
            report: report([
              row(3, { registrationNumber: err("2020390103", "مسجَّلٌ في المنصّة مسبقاً.") }),
            ]),
          },
        },
      },
    };
    const { user } = await toPreview();
    await user.click(screen.getByTestId("import-submit"));

    expect(screen.getByRole("alert")).toHaveTextContent("لم يُستورد أحد");
    expect(screen.getByText(/مسجَّلٌ في المنصّة مسبقاً/)).toBeInTheDocument();
    expect(screen.getByTestId("import-submit")).toBeDisabled();
    expect(screen.queryByTestId("import-done")).not.toBeInTheDocument();
  });
});
