/**
 * حالُ الاتّصال المشتركة.
 *
 * ما يستحقّ حارساً:
 *   ١. أنّ طلباً واحداً فشل لا يُعلن انقطاعاً ما دام الخادم يجيب؛
 *   ٢. أنّ خادماً لا يجيب يُسأل من جديد على مهلٍ متزايد (5، 10، 20، 30)؛
 *   ٣. أنّه حين يعود تُعاد جلبُ الاستعلامات الفاشلة كلّها، مرّةً واحدة؛
 *   ٤. أنّ الأسئلة لا تتراكب: سؤالٌ واحد في كلّ مرّة.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ping = vi.fn<() => Promise<boolean>>();
vi.mock("../api/health", () => ({ pingServer: () => ping() }));

const { queryClient } = await import("../../app/query-client");
const { checkConnection, reportServerUp, reportUnreachable, resetConnection, useConnection } = await import("./connection");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  resetConnection();
  ping.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Let a look's answer land. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("حال الاتّصال", () => {
  it("طلبٌ فشل والخادمُ يجيب ⇒ لا انقطاع", async () => {
    ping.mockResolvedValue(true);
    reportUnreachable();
    await settle();

    expect(useConnection.getState().link).toBe("ok");
    expect(useConnection.getState().restoredAt).toBeNull();
  });

  it("خادمٌ لا يجيب ⇒ يُسأل من جديد على مهلٍ متزايد", async () => {
    ping.mockResolvedValue(false);
    reportUnreachable();
    await settle();
    expect(useConnection.getState().link).toBe("down");
    expect(useConnection.getState().waitMs).toBe(5000);

    await vi.advanceTimersByTimeAsync(5000);
    expect(ping).toHaveBeenCalledTimes(2);
    expect(useConnection.getState().waitMs).toBe(10_000);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(useConnection.getState().waitMs).toBe(20_000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(useConnection.getState().waitMs).toBe(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(useConnection.getState().waitMs).toBe(30_000);
  });

  it("وحين يعود ⇒ تُعاد جلبُ الاستعلامات الفاشلة، وتُعلَن العودة", async () => {
    const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
    ping.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    reportUnreachable();
    await settle();
    expect(refetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    const s = useConnection.getState();
    expect(s.link).toBe("ok");
    expect(s.restoredAt).not.toBeNull();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("وجوابُ أيّ طلبٍ ينهي الانقطاع أيضاً", async () => {
    const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
    ping.mockResolvedValue(false);
    reportUnreachable();
    await settle();

    reportServerUp();
    expect(useConnection.getState().link).toBe("ok");
    expect(refetch).toHaveBeenCalledTimes(1);
    // and the pending look is cancelled
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("والأسئلةُ لا تتراكب", async () => {
    let answer!: (v: boolean) => void;
    ping.mockImplementation(() => new Promise((r) => (answer = r)));
    void checkConnection();
    void checkConnection();
    reportUnreachable();
    expect(ping).toHaveBeenCalledTimes(1);
    answer(true);
    await settle();
  });

  it("وبلا شبكة ⇒ «غير متّصل» دون سؤال الخادم", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await checkConnection();
    expect(useConnection.getState().link).toBe("offline");
    expect(ping).not.toHaveBeenCalled();
  });
});
