/**
 * اختيار الجنس.
 *
 * ما يستحقّ اختباراً:
 *
 *   ١. أن يظهر الجنس المحفوظ محدَّداً بعلامة — فالحساب يُنشأ بجنسه، وصاحبه
 *      يجده محدَّداً حين يفتح ملفّه؛
 *   ٢. أن يُعرض للاطّلاع فقط لمن لا يغيّره (الطالب): الزرّان معطَّلان ولا
 *      يُبلَّغ الأب بشيء؛
 *   ٣. أن النقر على عنوان الحقل لا يختار «ذكر» من تلقاء نفسه — وهذا ما كان
 *      يحدث حين كان الحقل داخل `<label>`.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { GenderSelect } from "./gender-select";
import { FieldBox } from "../form/entity-form";
import { Users } from "lucide-react";

const male = () => screen.getByRole("button", { name: /admin\.genderMale/ });
const female = () => screen.getByRole("button", { name: /admin\.genderFemale/ });

describe("GenderSelect", () => {
  it("يُظهر الجنس المحفوظ محدَّداً", () => {
    render(<GenderSelect value="female" onChange={() => undefined} />);
    expect(female()).toHaveAttribute("aria-pressed", "true");
    expect(male()).toHaveAttribute("aria-pressed", "false");
  });

  it("للاطّلاع: المحفوظ محدَّد، ولا شيء يتغيّر بالنقر", async () => {
    const onChange = vi.fn();
    render(<GenderSelect value="male" onChange={onChange} readOnly />);
    expect(male()).toHaveAttribute("aria-pressed", "true");
    expect(male()).toBeDisabled();
    expect(female()).toBeDisabled();
    await userEvent.click(female());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "admin.genderClear" })).toBeNull();
  });

  it("النقر على عنوان الحقل لا يختار جنساً", async () => {
    const onChange = vi.fn();
    render(
      <FieldBox label="الجنس" icon={Users} group>
        <GenderSelect value={null} onChange={onChange} />
      </FieldBox>,
    );
    await userEvent.click(screen.getByText("الجنس"));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(female());
    expect(onChange).toHaveBeenCalledWith("female");
  });
});
