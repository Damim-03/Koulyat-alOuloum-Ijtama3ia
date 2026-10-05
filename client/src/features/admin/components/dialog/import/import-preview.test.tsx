/**
 * معاينة الاستيراد — الملف كلّه كما فهمته المنصّة.
 *
 * ما يُختبر هنا ما لو غاب لاستورد المسؤول ما لم يرَه: خانةٌ لم تُعرض، أو
 * قيمةٌ تُحفظ غير ما كُتب ولا يُقال له، أو عمودٌ غاب عن الملف ولا يُذكر.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("../../../../../lib/download", () => ({
  downloadBase64: vi.fn(),
  datedName: (b: string) => `${b}.xlsx`,
}));

const { ImportPreview } = await import("./import-preview");
const { report, row, cell, err, warn, columns } = await import("./import-report.fixture");
const { distribution, facts, filterRows, initialFilter } = await import("./import-preview.utils");
const { STUDENT_IMPORT_CONFIG } = await import("../student/student-import.config");
const profile = STUDENT_IMPORT_CONFIG.preview;
const opts = { column: null, query: "", searchKeys: profile.searchKeys };

const mixed = () =>
  report([
    row(3, {
      firstNameLatin: cell("youcef", { saved: "Youcef" }),
      gender: cell("أنثى"),
      password: cell("••••••••••", { issues: [{ level: "info", message: "طولها 10." }] }),
    }),
    row(4, {
      lastName: err("", "إلزامي — الخانة فارغة."),
      faculty: err("كلية أخرى", "لا يوافق التخصص — كليته «كلية العلوم الاجتماعية»."),
    }),
    row(5, { email: warn("a@gmial.com", "هل تقصد @gmail.com؟") }, [
      { level: "warning", message: "هذا الصفّ مخفيٌّ في Excel." },
    ]),
  ]);

describe("المعاينة", () => {
  it("تعرض كلّ الأعمدة بنوعها وحرفها، وكلّ خانةٍ بحالها", async () => {
    const user = userEvent.setup();
    render(<ImportPreview report={mixed()} profile={profile} />);
    await user.click(screen.getByTestId("import-filter-all"));
    const table = screen.getByTestId("import-table");

    for (const c of columns) expect(within(table).getByText(c.header)).toBeInTheDocument();
    expect(within(table).getAllByText("admin.import.kind_req").length).toBe(5);
    expect(within(table).getAllByText("admin.import.kind_auto").length).toBe(4);

    // إلزاميٌّ فارغ: «فارغ» في خانةٍ حمراء، ورسالتها تحتها.
    const r4 = within(screen.getByTestId("import-row-4"));
    expect(r4.getByText("admin.import.cellEmpty")).toBeInTheDocument();
    expect(r4.getByText(/لا يوافق التخصص/)).toBeInTheDocument();
    // ما تملؤه المنصّة يُعرض، وما سيُحفظ مخالفاً لما كُتب يُعرض تحته.
    const r3 = within(screen.getByTestId("import-row-3"));
    expect(r3.getAllByText("ماستر").length).toBeGreaterThan(0);
    expect(r3.getByText("← Youcef")).toBeInTheDocument();
    expect(r3.getByText("طولها 10.")).toBeInTheDocument();
  });

  it("والتصفية الأولى على الأخطاء، ورقاقة العمود تحصر صفوفه", async () => {
    const user = userEvent.setup();
    render(<ImportPreview report={mixed()} profile={profile} />);
    expect(screen.getByTestId("import-filter-errors")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("import-row-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-row-4")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-filter-all"));
    await user.click(screen.getByTestId("import-col-email"));
    expect(screen.getByTestId("import-row-5")).toBeInTheDocument();
    expect(screen.queryByTestId("import-row-4")).not.toBeInTheDocument();
  });

  it("والبحث بالاسم أو الرقم", async () => {
    const user = userEvent.setup();
    render(<ImportPreview report={mixed()} profile={profile} />);
    await user.click(screen.getByTestId("import-filter-all"));
    await user.type(screen.getByTestId("import-search"), "رقم5");
    expect(screen.getByTestId("import-row-5")).toBeInTheDocument();
    expect(screen.queryByTestId("import-row-3")).not.toBeInTheDocument();
  });

  it("ونقر الصفّ يفتح كلّ خاناته: ما في الملف، وما يُحفظ، ويتنقّل بين الصفوف", async () => {
    const user = userEvent.setup();
    render(<ImportPreview report={mixed()} profile={profile} />);
    await user.click(screen.getByTestId("import-filter-all"));
    await user.click(screen.getByTestId("import-row-3"));

    const panel = within(screen.getByTestId("import-row-panel"));
    for (const c of columns) expect(panel.getByTestId(`import-field-${c.key}`)).toBeInTheDocument();
    const latin = within(panel.getByTestId("import-field-firstNameLatin"));
    expect(latin.getByText("youcef")).toBeInTheDocument();
    expect(latin.getByText("Youcef")).toBeInTheDocument();
    expect(within(panel.getByTestId("import-field-faculty")).getByText("كلية العلوم الاجتماعية")).toBeInTheDocument();

    await user.click(panel.getByLabelText("admin.import.next"));
    expect(screen.getByText('admin.import.rowTitle:{"n":4}')).toBeInTheDocument();
    await user.click(screen.getByTestId("import-row-close"));
    expect(screen.queryByTestId("import-row-panel")).not.toBeInTheDocument();
  });

  it("وكيف قُرئ الملف: عمودٌ غائب، وعمودٌ أُهمل، وتنبيهات الملف", () => {
    const cols = columns.map((c) => (c.key === "gender" ? { ...c, letter: null } : c));
    render(
      <ImportPreview
        report={report([row(3)], {
          columns: cols,
          fileWarnings: ["أعمدةٌ اختيارية غير موجودة: «الجنس»."],
          file: { sheetName: "الطلبة", headerRow: 2, otherSheets: ["مسودّة"], ignored: [{ header: "ملاحظات", letter: "Q" }] },
        })}
        profile={profile}
      />,
    );
    const info = within(screen.getByTestId("import-file-info"));
    expect(info.getByText("ملاحظات")).toBeInTheDocument();
    expect(info.getByText(/«مسودّة»/)).toBeInTheDocument();
    expect(info.getAllByText("admin.import.missing").length).toBe(1);
    expect(screen.getByTestId("import-file-warnings")).toHaveTextContent("«الجنس»");
    expect(screen.getByTestId("import-verdict-ok")).toBeInTheDocument();
  });

  it("وما ستضيفه الدفعة: توزيعها على التخصصات، وأرقامها", () => {
    render(<ImportPreview report={mixed()} profile={profile} />);
    const dist = within(screen.getByTestId("import-distribution"));
    expect(dist.getByText("علم النفس العيادي")).toBeInTheDocument();
    // الصفّ الرابع كليته تعارض تخصّصه: لا يُعرف أين سيكون، فلا يُعدّ.
    expect(dist.getByText("2")).toBeInTheDocument();
    expect(within(screen.getByTestId("import-facts")).getByText("admin.import.factFemale").nextSibling).toHaveTextContent("1");
  });
});

describe("حسابات المعاينة", () => {
  it("التصفية الأولى: الأخطاء، ثم التنبيهات، ثم الكلّ", () => {
    expect(initialFilter(mixed())).toBe("errors");
    expect(initialFilter(report([row(3), row(4, { email: warn("x", "y") })]))).toBe("warnings");
    expect(initialFilter(report([row(3)]))).toBe("all");
  });

  it("الجاهزة: كلّ صفٍّ بلا خطأ — ولو فيه تنبيه", () => {
    const rows = mixed().rows;
    expect(filterRows(rows, { ...opts, filter: "ready" }).map((r) => r.row)).toEqual([3, 5]);
    expect(filterRows(rows, { ...opts, filter: "warnings" }).map((r) => r.row)).toEqual([5]);
  });

  it("التوزيع بما سيُحفظ دون ما تعارضت جامعيّته، والأرقام من الجاهزة وحدها", () => {
    const rows = mixed().rows;
    const [d] = distribution(rows, profile.distribution);
    expect(d).toMatchObject({ main: "علم النفس العيادي", badge: "ماستر", mono: "2025/2026", count: 2 });
    expect(d!.path).toBe("كلية العلوم الاجتماعية › قسم علم النفس › علم النفس");
    const f = Object.fromEntries(facts(rows).map((x) => [x.labelKey, x.value]));
    expect(f).toMatchObject({ factFemale: 1, factNoGender: 1, factGenerated: 1, factGiven: 1, factEmail: 1, factLatin: 1 });
  });
});
