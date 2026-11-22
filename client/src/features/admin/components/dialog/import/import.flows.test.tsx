import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fake } from "../../../../../test/fake-api";
import { renderApp } from "../../../../../test/render-app";

/**
 * الاستيراد من Excel — نافذةٌ واحدة لأربعة استيرادات: الطلبة، والأساتذة،
 * والمواضيع، والمواضيع المُسنَدة.
 *
 * المسار: نموذجٌ يُنزَّل، ثمّ ملفٌّ يُرفع فيُعايَن صفّاً صفّاً، ولا استيراد
 * وفيه صفٌّ خاطئ (يُصحَّح الملفّ ويُرفع من جديد)، ثمّ الاستيراد وملفّ
 * الحسابات. وإن تغيّرت المنصّة بين المعاينة والاستيراد ردّ الخادم بتقريرٍ
 * جديد يحلّ محلّ القديم.
 */
const xlsx = () => new File(["PK"], "list.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
const validOnly = {
  report: {
    fileErrors: [],
    fileWarnings: [],
    columns: [{ key: "lastName", header: "اللقب", kind: "req", group: "personal", letter: "A" }],
    rows: [{ row: 2, cells: { lastName: { value: "بلقاسم", state: "ok" } }, errors: 0, warnings: 0 }],
    summary: { total: 1, valid: 1, invalid: 0, warned: 0 },
  },
};

let downloads: string[] = [];
beforeEach(() => {
  fake.reset();
  localStorage.clear();
  downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => vi.restoreAllMocks());

const KINDS = [
  { kind: "الطلبة", page: "/ar/admin/students", open: "open-student-import", base: "/admin/students/import", accounts: true },
  { kind: "الأساتذة", page: "/ar/admin/professors", open: "open-professor-import", base: "/admin/professors/import", accounts: true },
  { kind: "المواضيع", page: "/ar/admin/topics", open: "open-topic-import", base: "/admin/topics/import", accounts: false },
  { kind: "المواضيع المُسنَدة", page: "/ar/admin/topics", open: "open-assigned-topic-import", base: "/admin/topics/assigned/import", accounts: false },
];

describe.each(KINDS)("استيراد $kind", ({ page, open, base, accounts }) => {
  async function dialog() {
    const app = renderApp(page, { as: "admin" });
    // في صفحة المواضيع يجتمع الاستيرادان تحت زرٍّ واحد: يُفتح ثمّ يُختار.
    if (page.endsWith("/topics")) await app.user.click(await screen.findByTestId("open-import-menu"));
    await app.user.click(await screen.findByTestId(open));
    return { app, d: (await screen.findAllByRole("dialog")).at(-1)! };
  }

  it("النموذج يُنزَّل باسمه", async () => {
    const { app, d } = await dialog();
    await app.user.click(within(d).getByTestId("import-template"));
    await waitFor(() => expect(fake.find("get", `${base}/template`)).toHaveLength(1));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toMatch(/\.xlsx$/);
  });

  it("معاينةٌ فيها صفٌّ خاطئ ⇒ لا استيراد؛ و«رفع الملف المصحّح» يعيد إلى الرفع", async () => {
    const { app, d } = await dialog();
    await app.user.upload(within(d).getByTestId("import-file-input"), xlsx());
    expect(within(d).getByTestId("import-file-name")).toHaveTextContent("list.xlsx");
    await app.user.click(within(d).getByTestId("import-preview"));
    await waitFor(() => expect(fake.find("post", `${base}/preview`)).toHaveLength(1));
    expect(await within(d).findByTestId("import-submit")).toBeDisabled();
    await app.user.click(within(d).getByTestId("import-upload-fixed"));
    expect(await within(d).findByTestId("import-dropzone")).toBeInTheDocument();
  });

  it("معاينةٌ سليمة ⇒ استيراد، ثمّ النتيجة وإغلاق", async () => {
    fake.on("post", `${base}/preview`, validOnly);
    const { app, d } = await dialog();
    await app.user.upload(within(d).getByTestId("import-file-input"), xlsx());
    await app.user.click(within(d).getByTestId("import-preview"));
    const submit = await within(d).findByTestId("import-submit");
    await waitFor(() => expect(submit).toBeEnabled());
    await app.user.click(submit);
    await waitFor(() => expect(fake.find("post", base)).toHaveLength(1));
    expect(await within(d).findByTestId("import-done")).toBeInTheDocument();
    if (accounts) {
      expect(within(d).getByTestId("import-accounts")).toBeInTheDocument();
      await app.user.click(within(d).getByTestId("import-download-accounts"));
      await waitFor(() => expect(downloads.length).toBeGreaterThan(0));
    }
    const finish = within(d).queryByTestId("import-finish") ?? within(d).getByTestId("import-close-anyway");
    await app.user.click(finish);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });
});

describe("حين يتعذّر", () => {
  async function dialog() {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-student-import"));
    return { app, d: (await screen.findAllByRole("dialog")).at(-1)! };
  }

  it("النموذج لا يُنزَّل ⇒ يقال ذلك", async () => {
    fake.fail("get", "/admin/students/import/template", 500, "x");
    const { app, d } = await dialog();
    await app.user.click(within(d).getByTestId("import-template"));
    expect(await within(d).findByRole("alert")).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it("المعاينة يرفضها الخادم ⇒ سببه، ويبقى في الرفع", async () => {
    fake.fail("post", "/admin/students/import/preview", 400, "الورقة الأولى فارغة");
    const { app, d } = await dialog();
    await app.user.upload(within(d).getByTestId("import-file-input"), xlsx());
    await app.user.click(within(d).getByTestId("import-preview"));
    expect(await within(d).findByText("الورقة الأولى فارغة")).toBeInTheDocument();
    expect(within(d).getByTestId("import-dropzone")).toBeInTheDocument();
  });

  it("تغيّرت المنصّة قبل الاستيراد ⇒ التقرير الجديد مكان القديم، ولم يُنشأ أحد", async () => {
    fake.on("post", "/admin/students/import/preview", validOnly);
    fake.on("post", "/admin/students/import", () => {
      throw {
        status: 409,
        data: {
          message: "سبق أحدٌ إلى رقم التسجيل",
          report: { ...validOnly.report, rows: [{ ...validOnly.report.rows[0], errors: 1 }], summary: { total: 1, valid: 0, invalid: 1, warned: 0 } },
        },
      };
    });
    const { app, d } = await dialog();
    await app.user.upload(within(d).getByTestId("import-file-input"), xlsx());
    await app.user.click(within(d).getByTestId("import-preview"));
    const submit = await within(d).findByTestId("import-submit");
    await waitFor(() => expect(submit).toBeEnabled());
    await app.user.click(submit);
    expect(await within(d).findByText("سبق أحدٌ إلى رقم التسجيل")).toBeInTheDocument();
    await waitFor(() => expect(within(d).getByTestId("import-submit")).toBeDisabled());
  });
});

describe("منطقة الرفع وشريط الخطوات", () => {
  async function dialog() {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-student-import"));
    return { app, d: (await screen.findAllByRole("dialog")).at(-1)! };
  }

  it("المنطقة تفتح اختيار الملف بالنقر وبـEnter وبالمسافة", async () => {
    const { app, d } = await dialog();
    const input = within(d).getByTestId("import-file-input") as HTMLInputElement;
    const picked = vi.spyOn(input, "click").mockImplementation(() => {});
    const zone = within(d).getByTestId("import-dropzone");
    await app.user.click(zone);
    zone.focus();
    await app.user.keyboard("{Enter}");
    await app.user.keyboard(" ");
    expect(picked).toHaveBeenCalledTimes(3);
  });

  it("ملفٌّ يُسحب ويُفلت فيُختار، و«إزالة» تُفرغه", async () => {
    const { app, d } = await dialog();
    const zone = within(d).getByTestId("import-dropzone");
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [xlsx()] } });
    expect(await within(d).findByTestId("import-file-name")).toHaveTextContent("list.xlsx");
    const remove = within(within(d).getByTestId("import-dropzone")).getAllByRole("button").at(-1)!;
    await app.user.click(remove);
    expect(within(d).queryByTestId("import-file-name")).toBeNull();
    expect(within(d).getByTestId("import-preview")).toBeDisabled();
  });

  it("من المعاينة يُعاد إلى الرفع من شريط الخطوات", async () => {
    const { app, d } = await dialog();
    await app.user.upload(within(d).getByTestId("import-file-input"), xlsx());
    await app.user.click(within(d).getByTestId("import-preview"));
    await within(d).findByTestId("import-submit");
    const first = within(d).getByTestId("stepper").querySelector("li button") as HTMLButtonElement;
    await app.user.click(first);
    expect(await within(d).findByTestId("import-dropzone")).toBeInTheDocument();
  });
});
