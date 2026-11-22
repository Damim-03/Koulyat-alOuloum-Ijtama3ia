import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import i18n from "../../i18n/i18n";
import { ListInput } from "./list-input";

/**
 * قائمةٌ من عناصر قصيرة (متطلّبات، أهداف): كلّ عنصرٍ صفٌّ مستقلّ لحظة يُعتمد.
 *
 * يُحرس: أنّ القائمة الملصوقة تُقسَّم أسطراً ولا تُحفظ كتلةً واحدة؛ وأنّ
 * المكرَّر يُهمل؛ وأنّ ما كُتب ولم يُعتمد يُحفظ عند مغادرة الحقل؛ وأنّ السقف
 * يُحترم؛ وأنّ الترتيب والحذف يقعان على العنصر المقصود.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

function Host({ initial = [] as string[], max }: { initial?: string[]; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ListInput value={value} onChange={setValue} placeholder="عنصر" max={max} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}
const value = () => JSON.parse(screen.getByTestId("value").textContent!) as string[];
const setup = (props: Parameters<typeof Host>[0] = {}) => {
  const user = userEvent.setup({ delay: null });
  render(<Host {...props} />);
  return { user, input: () => screen.getByRole("textbox") as HTMLInputElement };
};

describe("قائمة العناصر", () => {
  it("Enter وزرّ الإضافة يعتمدان؛ والمكرَّر والفارغ يُهملان؛ والتركيز يعود إلى الحقل", async () => {
    const { user, input } = setup();
    await user.type(input(), "SPSS{Enter}");
    await user.type(input(), "  SPSS  {Enter}");
    await user.type(input(), "   {Enter}");
    expect(value()).toEqual(["SPSS"]);
    await user.type(input(), "مقابلات");
    await user.click(screen.getByRole("button", { name: t("admin.addItem") }));
    expect(value()).toEqual(["SPSS", "مقابلات"]);
    expect(input()).toHaveFocus();
    expect(screen.getByText(t("admin.itemsAdded", { n: 2 }))).toBeInTheDocument();
  });

  it("ما كُتب ولم يُعتمد يُحفظ عند مغادرة الحقل", async () => {
    const { user, input } = setup();
    await user.type(input(), "استبيان");
    await user.tab();
    expect(value()).toEqual(["استبيان"]);
  });

  it("قائمةٌ ملصوقة تُقسَّم أسطراً — مع ما سبق كتابته؛ وسطرٌ واحد يُلصق كما هو", async () => {
    const { user, input } = setup();
    await user.click(input());
    await user.type(input(), "أوّل");
    fireEvent.paste(input(), { clipboardData: { getData: () => "ثانٍ\n\nثالث" } });
    expect(value()).toEqual(["أوّل", "ثانٍ", "ثالث"]);
    expect(input()).toHaveValue("");

    fireEvent.paste(input(), { clipboardData: { getData: () => "رابع\nخامس" } });
    expect(value()).toEqual(["أوّل", "ثانٍ", "ثالث", "رابع", "خامس"]);
    // سطرٌ بلا فاصل: لا يُعترض، فيصل الحقل كعادته.
    fireEvent.paste(input(), { clipboardData: { getData: () => "سادس" } });
    expect(value()).toHaveLength(5);
  });

  it("Backspace في حقلٍ فارغ يحذف الأخير؛ و«إزالة» تحذف المقصود؛ و«أعلى» يرفعه", async () => {
    const { user, input } = setup({ initial: ["أ", "ب", "ج"] });
    const [up0] = screen.getAllByRole("button", { name: t("admin.moveUp") });
    expect(up0).toBeDisabled();
    await user.click(screen.getAllByRole("button", { name: t("admin.moveUp") })[2]!);
    expect(value()).toEqual(["أ", "ج", "ب"]);
    await user.click(screen.getAllByRole("button", { name: t("admin.removeCover") })[0]!);
    expect(value()).toEqual(["ج", "ب"]);
    await user.click(input());
    await user.keyboard("{Backspace}");
    expect(value()).toEqual(["ج"]);
    // عنصرٌ واحد: لا ترتيب.
    expect(screen.queryByRole("button", { name: t("admin.moveUp") })).toBeNull();
    await user.type(input(), "د{Backspace}");
    expect(value()).toEqual(["ج"]);
  });

  it("السقف: لا يُضاف بعده، والحقل يقول إنّ القائمة امتلأت؛ والملصوق يُقصّ عنده", async () => {
    const { input } = setup({ initial: ["أ"], max: 3 });
    fireEvent.paste(input(), { clipboardData: { getData: () => "ب\nج\nد\nه" } });
    expect(value()).toEqual(["أ", "ب", "ج"]);
    expect(input()).toBeDisabled();
    expect(input()).toHaveAttribute("placeholder", t("admin.listFull", { max: 3 }));
    expect(screen.getByRole("button", { name: t("admin.addItem") })).toBeDisabled();
  });
});
