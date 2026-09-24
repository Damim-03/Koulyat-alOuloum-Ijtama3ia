/**
 * الرمز يُولَّد من تلقائه.
 *
 * كان لا يُملأ إلّا بالضغط على «توليد»، فيُترك فارغاً سهواً ويُردّ الحفظ.
 * وصار يُصكّ عند فتح النافذة. والقاعدة سطرٌ في كلّ حوار، وهي واحدة في
 * الأقسام والميادين والشعب والكلّيات والمعالج — فتُختبَر هنا مرّةً على
 * أبسطها، وأربعة أشياء فيها لو انقلبت لبدا كلّ شيءٍ يعمل:
 *
 *   ١. أن يُفتح الحوار ورمزُه فارغ — وهو الحال قبل الإصلاح؛
 *   ٢. أن يُبدَّل الرمز مع كتابة الاسم، فيتغيّر تحت عين من يقرؤه؛
 *   ٣. أن يمحو الرمزَ المحفوظ عند التعديل — وغيرُه قد يشير إليه؛
 *   ٤. أن يُفتح الحقل للكتابة، والرمز شكلٌ موحَّدٌ لا رأيَ لأحدٍ فيه.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

const idle = { mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false };

vi.mock("../../../hooks/admin-hook", () => ({
  useCreateDepartment: () => idle,
  useUpdateDepartment: () => idle,
  useDepartments: () => ({ data: [] }),
  useUploadImage: () => idle,
}));

const { DepartmentFormDialog } = await import("./department-dialog.form");

const codeInput = () =>
  screen.getByPlaceholderText("admin.codeAuto") as HTMLInputElement;

const nameInput = () =>
  screen.getAllByPlaceholderText("admin.departmentName")[0] as HTMLInputElement;

const open = (department: Record<string, unknown> | null = null) =>
  render(
    <DepartmentFormDialog
      open
      onClose={() => {}}
      department={department as never}
      facultyId="f1"
    />,
  );

beforeEach(() => vi.clearAllMocks());

describe("رمز القسم", () => {
  it("يظهر فور فتح الحوار، قبل كتابة أي شيء", () => {
    open();

    expect(codeInput().value).toMatch(/^D-\d{13}$/);
  });

  it("ولا يتبدّل مع كتابة الاسم", async () => {
    const user = userEvent.setup();
    open();

    const first = codeInput().value;
    await user.type(nameInput(), "قسم العلوم");

    expect(codeInput().value).toBe(first);
  });

  it("والحقل مقفلٌ لا يُكتب فيه", async () => {
    const user = userEvent.setup();
    open();

    expect(codeInput()).toHaveAttribute("readonly");

    const generated = codeInput().value;
    await user.type(codeInput(), "MINE");

    expect(codeInput().value).toBe(generated);
  });

  /** ولا يتكرّر رمزان بين فتحتين متتاليتين. */
  it("ولا يتكرّر بين فتحتين", () => {
    open();
    const first = codeInput().value;
    cleanup();
    open();

    expect(codeInput().value).not.toBe(first);
  });

  /** ورمزٌ مصكوكٌ على الشكل الجديد لا يُمسّ عند التعديل. */
  it("ولا يمحو رمزاً مصكوكاً عند التعديل", async () => {
    const user = userEvent.setup();
    const saved = "D-1789412345678";
    open({ id: "d1", name: "قسم", code: saved, facultyId: "f1" });

    expect(codeInput().value).toBe(saved);
    await user.type(nameInput(), " الاجتماعية");

    expect(codeInput().value).toBe(saved);
  });

  /**
   * أمّا رمزُ ما قبل هذا التغيير فيُستبدل عند أوّل تعديل — وهو ما طُلب:
   * ألّا يبقى `DSOC` في شاشةٍ صار رمزها ختمَ وقت.
   */
  it("ويستبدل الرمز القديم عند فتح التعديل", () => {
    open({ id: "d1", name: "قسم", code: "DSOC", facultyId: "f1" });

    expect(codeInput().value).not.toBe("DSOC");
    expect(codeInput().value).toMatch(/^D-\d{13}$/);
  });
});
