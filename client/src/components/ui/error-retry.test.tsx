/**
 * حالةُ تعذّر الجلب.
 *
 * وسببُ وجودها أنّ الشاشات كانت تعرض «لا يوجد طلاب» حين ينقطع الاتّصال:
 * الجلبُ يفشل، و`isLoading` يصير `false`، فيصدق شرطُ `length === 0` — لأنّ
 * القائمة لم تصل لا لأنّها فارغة. فيقرأ المسؤول أنّ القاعدة خالية وهي عامرة.
 *
 * وما يستحقّ حارساً هنا شيئان: أن يبقى الزرّ موجوداً، وأن يستدعي `refetch`
 * لهذا الاستعلام وحده — لا `location.reload()` الذي يُفقد المرشِّحات والصفحة.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { ErrorRetry } = await import("./error-retry");

describe("تعذّر الجلب", () => {
  it("يعرض زرّ الإعادة ويستدعيه عند الضغط", async () => {
    const onRetry = vi.fn();
    render(<ErrorRetry onRetry={onRetry} />);

    await userEvent.click(screen.getByText("admin.retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("ويقول ما جرى — لا يكتفي بزرّ بلا خبر", () => {
    render(<ErrorRetry onRetry={() => {}} />);

    expect(screen.getByText("admin.loadError")).toBeTruthy();
    expect(screen.getByText("admin.loadFailedHint")).toBeTruthy();
  });

  /** الصيغةُ المختصرة تسكن صفَّ جدول، فلا أيقونةَ كبيرة ولا تلميح. */
  it("والمختصرةُ تُبقي الزرّ والعنوان وتُسقط التلميح", () => {
    render(<ErrorRetry compact onRetry={() => {}} />);

    expect(screen.getByText("admin.retry")).toBeTruthy();
    expect(screen.getByText("admin.loadError")).toBeTruthy();
    expect(screen.queryByText("admin.loadFailedHint")).toBeNull();
  });

  it("ويقبل عنواناً يخصّ الشاشة", () => {
    render(<ErrorRetry onRetry={() => {}} title="تعذّر تحميل الطلبة" />);

    expect(screen.getByText("تعذّر تحميل الطلبة")).toBeTruthy();
    expect(screen.queryByText("admin.loadError")).toBeNull();
  });
});
