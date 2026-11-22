/**
 * القائمة المنسدلة المشتركة.
 *
 * تحمل اللائحةُ الطويلة خانة بحث، ويحمل الخيارُ سطراً ثانياً وعدّاداً. وما
 * يجب ألّا يتغيّر: خيارٌ بلا إضافات يبقى اسمُه ونصُّه عنوانَه وحده — فعلى ذلك
 * تقوم اختبارات النماذج كلّها.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Select, type SelectOption } from "./select";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Harness({ options, onChange }: { options: SelectOption[]; onChange?: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <Select
      value={v}
      options={options}
      filter
      aria-label="faculty"
      onChange={(x) => {
        setV(x);
        onChange?.(x);
      }}
    />
  );
}

const many: SelectOption[] = [
  { value: "", label: "الكلّ", count: 12 },
  ...["الطب", "الحقوق", "الآداب", "العلوم", "الهندسة", "الاقتصاد", "الفنون", "علم النفس", "الرياضيات"].map((n, i) => ({
    value: `f${i}`,
    label: `كلّية ${n}`,
    hint: `قسم ${i + 1}`,
    count: i,
  })),
];

describe("Select", () => {
  it("خيارٌ بلا إضافات: نصّه واسمه عنوانه وحده", async () => {
    render(<Harness options={[{ value: "", label: "الكلّ" }, { value: "a", label: "أ" }]} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["الكلّ", "أ"]);
    expect(screen.queryByRole("searchbox")).toBeNull(); // لائحةٌ قصيرة بلا بحث
  });

  it("يعرض السطر الثاني والعدّاد مع العنوان", async () => {
    render(<Harness options={many} />);
    await userEvent.click(screen.getByRole("combobox"));
    const opt = screen.getByRole("option", { name: /كلّية الطب/ });
    expect(opt.textContent).toContain("قسم 1");
    expect(opt.textContent).toContain("0");
  });

  it("اللائحة الطويلة تبحث في العنوان والسطر الثاني، متسامحةً مع الهمزات", async () => {
    render(<Harness options={many} />);
    await userEvent.click(screen.getByRole("combobox"));
    const search = screen.getByRole("searchbox");
    await userEvent.type(search, "الاداب");
    expect(screen.getAllByRole("option").map((o) => o.querySelector("span span")?.textContent)).toEqual(["كلّية الآداب"]);

    await userEvent.clear(search);
    await userEvent.type(search, "قسم 9");
    expect(screen.getAllByRole("option")).toHaveLength(1);

    await userEvent.clear(search);
    await userEvent.type(search, "لا شيء هنا");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("common.noOptions")).toBeTruthy();
  });

  it("Enter يختار أوّل نتيجة، ثمّ يتلوّن الزرّ لأنّ الفلتر مطبَّق", async () => {
    const onChange = vi.fn();
    render(<Harness options={many} onChange={onChange} />);
    const box = screen.getByRole("combobox");
    await userEvent.click(box);
    await userEvent.type(screen.getByRole("searchbox"), "الحقوق{Enter}");
    expect(onChange).toHaveBeenCalledWith("f1");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box.textContent).toContain("كلّية الحقوق");
    expect(box.className).toContain("bg-gold/10");
  });

  it("الأسهم تتنقّل بين النتائج الظاهرة وحدها، و Escape يغلق", async () => {
    const onChange = vi.fn();
    render(<Harness options={many} onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    // «كلّية ال…» تُظهر الكلّيات كلّها إلّا «علم النفس» (f7).
    await userEvent.type(screen.getByRole("searchbox"), "كلّية ال");
    // من f0 سبعُ خطوات: f1…f6 ثمّ f8 — تقفز فوق المخفيّة.
    await userEvent.keyboard("{ArrowDown>7/}{Enter}");
    expect(onChange).toHaveBeenCalledWith("f8");

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  describe("لائحةٌ قصيرة بلا بحث — كلّها بلوحة المفاتيح", () => {
    const short: SelectOption[] = [
      { value: "", label: "الكلّ" },
      { value: "a", label: "أ" },
      { value: "b", label: "ب" },
      { value: "c", label: "ج" },
    ];

    it("السهم يفتح، وEnd ثمّ Home ثمّ المسافة تختار الأوّل", async () => {
      const onChange = vi.fn();
      render(<Harness options={short} onChange={onChange} />);
      screen.getByRole("combobox").focus();
      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("listbox")).toBeTruthy();
      await userEvent.keyboard("{End}{Enter}");
      expect(onChange).toHaveBeenLastCalledWith("c");
      await userEvent.keyboard("{ArrowUp}{Home} ");
      expect(onChange).toHaveBeenLastCalledWith("");
    });

    it("Enter والمسافة يفتحان؛ وTab يغلق بلا اختيار؛ وEscape يعيد التركيز إلى الزرّ", async () => {
      const onChange = vi.fn();
      render(<Harness options={short} onChange={onChange} />);
      const box = screen.getByRole("combobox");
      box.focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard("{ArrowDown}{ArrowDown}{Tab}");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();

      box.focus();
      await userEvent.keyboard(" ");
      expect(screen.getByRole("listbox")).toBeTruthy();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(document.activeElement).toBe(box);
    });

    it("النقر خارجها يغلقها، والمطفأة لا تُفتح", async () => {
      const { rerender } = render(<Harness options={short} />);
      await userEvent.click(screen.getByRole("combobox"));
      await userEvent.click(document.body);
      expect(screen.queryByRole("listbox")).toBeNull();

      rerender(<Select value="" options={short} onChange={() => {}} disabled aria-label="off" />);
      await userEvent.click(screen.getByRole("combobox", { name: "off" }));
      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });
});
