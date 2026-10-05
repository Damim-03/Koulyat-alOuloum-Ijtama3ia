/**
 * حالةُ تعذّر الجلب.
 *
 * وسببُ وجودها أنّ الشاشات كانت تعرض «لا يوجد طلاب» حين ينقطع الاتّصال:
 * الجلبُ يفشل، و`isLoading` يصير `false`، فيصدق شرطُ `length === 0` — لأنّ
 * القائمة لم تصل لا لأنّها فارغة. فيقرأ المسؤول أنّ القاعدة خالية وهي عامرة.
 *
 * وما يستحقّ حارساً هنا: أن يبقى الزرّ موجوداً، وأن يستدعي `refetch` لهذا
 * الاستعلام وحده — لا `location.reload()` الذي يُفقد المرشِّحات والصفحة —
 * وأن يقول أين تعطّل الأمر، من حال الاتّصال المشتركة.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ping = vi.fn<() => Promise<boolean>>();
vi.mock("../../lib/api/health", () => ({ pingServer: () => ping() }));

const { ErrorRetry } = await import("./error-retry");
const { resetConnection } = await import("../../lib/connection/connection");
const { queryClient } = await import("../../app/query-client");

/** Let the server check settle. */
const settle = () => act(async () => {});

beforeEach(() => {
  resetConnection();
  ping.mockReset();
  ping.mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetConnection();
});

describe("تعذّر الجلب", () => {
  it("يعرض زرّ الإعادة ويستدعيه عند الضغط", async () => {
    const onRetry = vi.fn();
    render(<ErrorRetry onRetry={onRetry} />);
    await settle();

    fireEvent.click(screen.getByText("admin.retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("ويقول ما جرى، وأنّ البيانات سليمة", async () => {
    render(<ErrorRetry onRetry={() => {}} />);
    expect(screen.getByText("admin.loadError")).toBeTruthy();
    expect(screen.getByText("admin.errorPanel.dataSafe")).toBeTruthy();
    await settle();
  });

  it("والخادمُ يعمل ⇒ العيب في هذا الطلب، ولا عدّ تنازليّ", async () => {
    render(<ErrorRetry onRetry={() => {}} />);
    expect(screen.getByText("admin.errorPanel.eyebrow_checking")).toBeTruthy();
    await settle();

    expect(screen.getByText("admin.errorPanel.eyebrow_up")).toBeTruthy();
    expect(screen.getByText("admin.errorPanel.hint_up")).toBeTruthy();
    expect(screen.getByText("admin.errorPanel.up")).toBeTruthy();
    expect(screen.queryByTestId("auto-retry")).toBeNull();
  });

  it("والخادمُ لا يجيب ⇒ يقول ذلك ويعدّ، وحين يجيب يُعاد جلبُ ما فشل", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
    ping.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ErrorRetry onRetry={() => {}} />);
    await settle();

    expect(screen.getByText("admin.errorPanel.eyebrow_down")).toBeTruthy();
    expect(screen.getByText("admin.errorPanel.down")).toBeTruthy();
    expect(screen.getByTestId("auto-retry")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(ping).toHaveBeenCalledTimes(2);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("admin.errorPanel.up")).toBeTruthy();
  });

  /** `refetch` يعيد وعداً: يدور الزرّ حتى يُحسم، ولا تُرسَل المحاولة مرّتين. */
  it("وينتظر المحاولةَ الجارية ولا يكرّرها", async () => {
    let done!: () => void;
    const onRetry = vi.fn(() => new Promise<void>((r) => (done = r)));
    render(<ErrorRetry onRetry={onRetry} />);
    await settle();

    fireEvent.click(screen.getByText("admin.retry"));
    const button = screen.getByText("admin.retrying").closest("button")!;
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => done());
    expect(screen.getByText("admin.retry").closest("button")).toBeEnabled();
  });

  it("ويقول إنّ الاتّصال منقطع", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<ErrorRetry onRetry={() => {}} />);
    await settle();

    expect(screen.getByText("admin.errorPanel.eyebrow_offline")).toBeTruthy();
    expect(screen.getByText("admin.errorPanel.hint_offline")).toBeTruthy();
    expect(ping).not.toHaveBeenCalled();
  });

  /** الصيغةُ المختصرة تسكن صفَّ جدول: عنوانٌ وسطرُ تشخيصٍ وزرّ. */
  it("والمختصرةُ تُبقي الزرّ والعنوان وتُخبر أين تعطّل", async () => {
    ping.mockResolvedValue(false);
    render(<ErrorRetry compact onRetry={() => {}} />);
    await settle();

    expect(screen.getByText("admin.retry")).toBeTruthy();
    expect(screen.getByText("admin.loadError")).toBeTruthy();
    expect(screen.getByText(/admin\.errorPanel\.eyebrow_down/)).toBeTruthy();
    expect(screen.queryByText("admin.errorPanel.dataSafe")).toBeNull();
  });

  it("ويقبل عنواناً وتلميحاً يخصّان الشاشة", async () => {
    render(<ErrorRetry onRetry={() => {}} title="تعذّر تحميل الطلبة" hint="تلميحٌ خاص" />);
    await settle();

    expect(screen.getByText("تعذّر تحميل الطلبة")).toBeTruthy();
    expect(screen.getByText("تلميحٌ خاص")).toBeTruthy();
    expect(screen.queryByText("admin.loadError")).toBeNull();
  });
});
