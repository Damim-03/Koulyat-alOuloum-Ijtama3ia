import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import { DEFAULT_SUPERVISION_TEMPLATE } from "../../../supervision/lib/sheet-template";

/**
 * «ورقة الإشراف» في «واجهة الموقع»: نصّ ورقة «طلب الموافقة على الإشراف».
 *
 * يُحرس: أنّ المعاينة هي الورقة نفسها وتتبع الكتابة؛ وأنّ الحفظ يرسل الورقة
 * كاملةً مقلَّمة، وكلّ حقلٍ فيها اختياريّ — الفارغ يُحفظ فارغاً ولا يُطبع،
 * وسطر الترويسة الفارغ يسقط؛ وأنّ «استعادة الأصل» لا تكون
 * إلّا لورقةٍ عُدّلت، وبعد سؤال، فتعود الاستمارة إلى النصّ الأصليّ.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const D = DEFAULT_SUPERVISION_TEMPLATE;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function open() {
  const app = renderApp("/ar/admin/homepage?tab=supervision", { as: "admin" });
  const panel = await screen.findByTestId("sup-sheet-panel");
  const sheet = within(panel).getByTestId("supervision-sheet");
  const input = (name: string) => within(panel).getByRole("textbox", { name });
  const save = () => within(panel).getAllByRole("button", { name: esc(t("admin.supSheet.save")) })[0]!;
  return { app, panel, sheet, input, save };
}

describe("ورقة الإشراف", () => {
  it("تبويبها في «واجهة الموقع»، وتبدأ بالنصّ الأصليّ: لا استعادة لما لم يُعدَّل", async () => {
    const app = renderApp("/ar/admin/homepage", { as: "admin" });
    await app.user.click(await screen.findByRole("tab", { name: esc(t("admin.site.tabSupervision")) }));
    expect(app.location()).toBe("/ar/admin/homepage?tab=supervision");
    const panel = await screen.findByTestId("sup-sheet-panel");
    expect(within(panel).getByTestId("sup-sheet-status")).toHaveTextContent(t("admin.supSheet.statusOriginal"));
    expect(within(panel).getByTestId("sup-sheet-restore")).toBeDisabled();
    expect(within(panel).getByTestId("sup-sheet-original")).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { level: 1 })).toHaveTextContent(D.title);
  });

  it("المعاينة تتبع الكتابة، والحفظ يرسل الورقة كاملةً مقلَّمة ثمّ تصير «معدّلة»", async () => {
    const { app, panel, sheet, input, save } = await open();
    expect(save()).toBeDisabled();

    const title = input(t("admin.supSheet.f.title"));
    await app.user.clear(title);
    await app.user.type(title, "  طلب موافقة على الإشراف  ");
    expect(within(sheet).getByRole("heading", { level: 1 })).toHaveTextContent("طلب موافقة على الإشراف");
    expect(within(panel).queryByTestId("sup-sheet-original")).toBeNull();

    // A header line more, printed under the others.
    await app.user.click(within(panel).getByRole("button", { name: t("admin.supSheet.addLine") }));
    await app.user.type(input(t("admin.supSheet.headerLine", { n: D.header.length + 1 })), "كلية العلوم الاجتماعية");
    expect(within(sheet).getByTestId("sup-header")).toHaveTextContent("كلية العلوم الاجتماعية");

    await app.user.click(save());
    await waitFor(() => expect(fake.find("put", "/admin/supervision-sheet")).toHaveLength(1));
    expect(fake.find("put", "/admin/supervision-sheet")[0]!.body).toEqual({
      ...D,
      title: "طلب موافقة على الإشراف",
      header: [...D.header, "كلية العلوم الاجتماعية"],
    });
    expect(await screen.findByText(t("admin.supSheet.toastSaved"))).toBeInTheDocument();
    await waitFor(() => expect(within(panel).getByTestId("sup-sheet-status")).toHaveTextContent(t("admin.supSheet.statusCustom")));
    expect(within(panel).getByTestId("sup-sheet-restore")).toBeEnabled();
    expect(save()).toBeDisabled();
  });

  it("كلّ حقلٍ اختياريّ: الفارغ لا يُطبع ويُحفظ فارغاً، وسطر الترويسة الفارغ يسقط", async () => {
    const { app, panel, sheet, input, save } = await open();
    await app.user.clear(input(t("admin.supSheet.f.title")));
    await app.user.clear(input(t("admin.supSheet.f.signLabel")));
    await app.user.clear(input(t("admin.supSheet.f.yearLabel")));
    expect(input(t("admin.supSheet.f.title"))).toHaveAttribute("placeholder", t("admin.supSheet.notPrinted"));
    // A blank line in the header: nothing more is printed.
    await app.user.click(within(panel).getByRole("button", { name: t("admin.supSheet.addLine") }));

    expect(within(sheet).queryByRole("heading", { level: 1 })).toBeNull();
    expect(sheet).not.toHaveTextContent(D.signLabel);
    expect(sheet).not.toHaveTextContent(D.yearLabel);
    expect(within(sheet).getByTestId("sup-header").querySelectorAll("p")).toHaveLength(D.header.length + 1);

    await app.user.click(save());
    await waitFor(() => expect(fake.find("put", "/admin/supervision-sheet")).toHaveLength(1));
    expect(fake.find("put", "/admin/supervision-sheet")[0]!.body).toEqual({ ...D, title: "", signLabel: "", yearLabel: "" });
    expect(screen.queryByText(t("admin.site.required"))).toBeNull();
  });

  it("سطر القسم يُطفأ، والشهادة الثالثة تُطبع إن سُمّيت، وتُعلَّم خانة المستوى المختار في المعاينة", async () => {
    const { app, panel, sheet, input } = await open();
    expect(within(sheet).getByTestId("sup-header")).toHaveTextContent("قسم علم الاجتماع");
    await app.user.click(within(panel).getByRole("switch", { name: esc(t("admin.supSheet.deptOn")) }));
    expect(within(sheet).getByTestId("sup-header")).not.toHaveTextContent("علم الاجتماع");

    // The doctorate has no name by default: no box for it.
    expect(sheet.querySelectorAll("[data-degree]")).toHaveLength(2);
    await app.user.type(input(t("admin.levelDoctorate")), "الدكتوراه");
    expect(sheet.querySelectorAll("[data-degree]")).toHaveLength(3);

    const level = within(panel).getByRole("radiogroup", { name: t("admin.supSheet.previewLevel") });
    expect(sheet.querySelector("[data-degree='master']")).toHaveTextContent("✕");
    await app.user.click(within(level).getByRole("radio", { name: t("admin.levelDoctorate") }));
    expect(sheet.querySelector("[data-degree='doctorate']")).toHaveTextContent("✕");
    expect(sheet.querySelector("[data-degree='master']")).not.toHaveTextContent("✕");
  });

  it("سطر التخصّص تحت خانات الشهادة: عبارته تُعدَّل في المعاينة، ويُطفأ، ويُحفظ كما هو", async () => {
    const { app, panel, sheet, input, save } = await open();
    const line = () => within(sheet).queryByTestId("sup-specialization");
    expect(line()).toHaveTextContent(`${D.specialization!.label} علم الاجتماع`);

    const label = input(t("admin.supSheet.specLabel"));
    await app.user.clear(label);
    await app.user.type(label, "الاختصاص:");
    expect(line()).toHaveTextContent("الاختصاص: علم الاجتماع");

    await app.user.click(within(panel).getByRole("switch", { name: esc(t("admin.supSheet.specOn")) }));
    expect(line()).toBeNull();
    expect(within(panel).queryByRole("textbox", { name: t("admin.supSheet.specLabel") })).toBeNull();

    await app.user.click(save());
    await waitFor(() => expect(fake.find("put", "/admin/supervision-sheet")).toHaveLength(1));
    expect(fake.find("put", "/admin/supervision-sheet")[0]!.body).toMatchObject({ specialization: { show: false, label: "الاختصاص:" } });
  });

  it("«استعادة الأصل» بعد سؤال: تمحو المحفوظ وتعود الاستمارة والمعاينة إلى النصّ الأصليّ", async () => {
    fake.on("get", "/admin/supervision-sheet", { content: { ...D, title: "عنوانٌ مخصّص" }, defaults: D });
    const { app, panel, sheet, input } = await open();
    expect(input(t("admin.supSheet.f.title"))).toHaveValue("عنوانٌ مخصّص");
    expect(within(panel).getByTestId("sup-sheet-status")).toHaveTextContent(t("admin.supSheet.statusCustom"));

    await app.user.click(within(panel).getByTestId("sup-sheet-restore"));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(t("admin.supSheet.restoreTitle"));
    expect(fake.find("delete", "/admin/supervision-sheet")).toEqual([]);
    await app.user.click(within(dialog).getByTestId("confirm-dialog-confirm"));

    await waitFor(() => expect(fake.find("delete", "/admin/supervision-sheet")).toHaveLength(1));
    await waitFor(() => expect(input(t("admin.supSheet.f.title"))).toHaveValue(D.title));
    expect(within(sheet).getByRole("heading", { level: 1 })).toHaveTextContent(D.title);
    expect(within(panel).getByTestId("sup-sheet-status")).toHaveTextContent(t("admin.supSheet.statusOriginal"));
    expect(within(panel).getByTestId("sup-sheet-restore")).toBeDisabled();
  });
});
