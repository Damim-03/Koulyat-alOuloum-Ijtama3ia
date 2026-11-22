import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileSpreadsheet, FileUp } from "lucide-react";
import { ActionMenu } from "./action-menu";

/**
 * زرٌّ تنسدل منه أفعالٌ متقاربة: يُفتح ويُغلق بالنقر، وبالنقر خارجه، وبـEscape
 * (والتركيز يعود إلى زرّه)، وباختيار بند؛ والأسهم تنقل بين البنود.
 */
function setup() {
  const a = vi.fn();
  const b = vi.fn();
  const user = userEvent.setup({ delay: null });
  render(
    <>
      <ActionMenu
        label="استيراد"
        icon={FileSpreadsheet}
        testId="menu"
        items={[
          { key: "a", label: "مقترحات", hint: "من Excel", icon: FileSpreadsheet, onSelect: a },
          { key: "b", label: "مسندة", icon: FileUp, onSelect: b },
        ]}
      />
      <p>خارجه</p>
    </>,
  );
  const trigger = screen.getByTestId("menu");
  const items = () => screen.getAllByRole("menuitem", { hidden: true });
  return { user, a, b, trigger, items };
}

describe("قائمة الأفعال", () => {
  it("تُفتح بزرّها، واختيار بندٍ يُغلقها وينفّذه", async () => {
    const { user, a, trigger } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("من Excel")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /مقترحات/ }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("النقر خارجها يغلقها؛ وEscape يغلقها ويعيد التركيز إلى زرّها", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByText("خارجه"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    screen.getByRole("menuitem", { name: /مسندة/ }).focus();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("السهم لأسفل على الزرّ يفتحها على أوّل بند؛ والأسهم وHome وEnd تتنقّل وتلتفّ؛ وTab يغلقها", async () => {
    const { user, b, trigger, items } = setup();
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await vi.waitFor(() => expect(items()[0]).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(items()[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items()[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(items()[1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(items()[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(items()[1]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(b).toHaveBeenCalledTimes(1);

    await user.click(trigger);
    items()[0]!.focus();
    await user.keyboard("{Tab}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
