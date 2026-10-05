/**
 * شارةُ الاتّصال: تظهر ما دام الخادم لا يُبلَغ أو الجهازُ بلا شبكة، وتصير
 * خضراء لحظةَ يعود الاتّصال، ثمّ تغيب. ولا تظهر حين يكون كلّ شيءٍ على ما يُرام.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../lib/sound", () => ({ playCue: vi.fn(), preloadCues: vi.fn() }));

const ping = vi.fn<() => Promise<boolean>>();
vi.mock("../lib/api/health", () => ({ pingServer: () => ping() }));

const { ConnectionPill } = await import("./connection-pill");
const { reportServerUp, reportUnreachable, resetConnection } = await import("../lib/connection/connection");
const { queryClient } = await import("../app/query-client");

const pill = () => screen.getByTestId("connection-pill");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
  resetConnection();
  ping.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetConnection();
});

describe("شارة الاتّصال", () => {
  it("مخفيّةٌ ما دام كلّ شيءٍ على ما يُرام", () => {
    render(<ConnectionPill />);
    expect(pill().dataset.state).toBe("hidden");
  });

  it("تظهر حين لا يجيب الخادم، بعدٍّ تنازليّ وزرٍّ للإعادة", async () => {
    ping.mockResolvedValue(false);
    render(<ConnectionPill />);
    await act(async () => {
      reportUnreachable();
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(pill().dataset.state).toBe("down");
    expect(screen.getByText("connection.title_down")).toBeTruthy();
    expect(screen.getByText("connection.sub_down")).toBeTruthy();
    expect(screen.getByText("connection.retryNow")).toBeTruthy();
  });

  it("وتصير «عاد الاتّصال» حين يعود، ثمّ تغيب", async () => {
    ping.mockResolvedValue(false);
    render(<ConnectionPill />);
    await act(async () => {
      reportUnreachable();
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => reportServerUp());
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(pill().dataset.state).toBe("restored");
    expect(screen.getByText("connection.title_restored")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(pill().dataset.state).toBe("hidden");
  });
});
