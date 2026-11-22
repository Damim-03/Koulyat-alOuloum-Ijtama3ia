import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../i18n/i18n";
import { SocketContext } from "../app/socket-context";
import * as connection from "../lib/connection/connection";
import { useRealtimeSync } from "./use-realtime-sync";
import { useConnectionWatch } from "./use-network-status";
import { isPhoneNow, useMediaQuery, PHONE_QUERY } from "./use-media-query";
import { useDebouncedValue } from "./use-debounced-value";
import { useDates } from "./use-dates";
import { useReveal } from "./use-reveal";

/** الخطّافات العامّة — ما تشترك فيه الصفحات كلّها. */
vi.mock("../lib/connection/connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/connection/connection")>()),
  checkConnection: vi.fn(),
  reportOffline: vi.fn(),
  reportServerUp: vi.fn(),
  reportSlow: vi.fn(),
  reportUnreachable: vi.fn(),
}));

/** مقبسٌ مزيّف: يسجّل المستمعين ويُطلق الأحداث. */
function fakeSocket(connected = false) {
  const handlers = new Map<string, Set<(p?: unknown) => void>>();
  return {
    connected,
    on: (e: string, cb: (p?: unknown) => void) => void (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(cb),
    off: (e: string, cb: (p?: unknown) => void) => void handlers.get(e)?.delete(cb),
    emit: (e: string, p?: unknown) => handlers.get(e)?.forEach((cb) => cb(p)),
    count: (e: string) => handlers.get(e)?.size ?? 0,
  };
}
type FakeSocket = ReturnType<typeof fakeSocket>;
const withSocket = (socket: FakeSocket | null, qc = new QueryClient()) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <SocketContext.Provider value={socket as never}>{children}</SocketContext.Provider>
      </QueryClientProvider>
    );
  };

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useRealtimeSync", () => {
  /**
   * الخادم يسمّي المورد بجزء الرابط (جمعاً: users)، وصفحات التفاصيل تسمّي
   * استعلامها بالمفرد (admin,user,id). يُحدَّث الاثنان معاً.
   */
  it("تغييرٌ في مورد ⇒ تُحدَّث قوائمه وصفحات تفاصيله، جمعاً ومفرداً", () => {
    const qc = new QueryClient();
    const keys = [["admin", "users"], ["admin", "user", "u1"], ["admin", "faculty", "f1"], ["topics"], ["notifications"]];
    for (const k of keys) qc.setQueryData(k, {});
    const socket = fakeSocket();
    renderHook(() => useRealtimeSync(), { wrapper: withSocket(socket, qc) });
    const stale = () => keys.filter((k) => qc.getQueryState(k)?.isInvalidated).map((k) => k.join("/"));

    act(() => socket.emit("data:changed", { resource: "users" }));
    expect(stale()).toEqual(["admin/users", "admin/user/u1"]);

    act(() => socket.emit("data:changed", { resource: "faculties" }));
    expect(stale()).toContain("admin/faculty/f1");

    act(() => socket.emit("notification"));
    expect(stale()).toContain("notifications");
    expect(stale()).not.toContain("topics");
  });

  it("وحدثٌ بلا مورد لا يُحدِّث شيئاً؛ وبلا مقبس لا يُستمع لشيء؛ وعند الخروج تُزال المستمعات", () => {
    const qc = new QueryClient();
    qc.setQueryData(["topics"], {});
    const socket = fakeSocket();
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper: withSocket(socket, qc) });
    act(() => socket.emit("data:changed", {}));
    expect(qc.getQueryState(["topics"])?.isInvalidated).toBe(false);

    unmount();
    expect(socket.count("data:changed")).toBe(0);
    renderHook(() => useRealtimeSync(), { wrapper: withSocket(null) });
  });
});

describe("useConnectionWatch", () => {
  it("المتصفّح يتّصل ⇒ يُسأل الخادم؛ وينقطع ⇒ «بلا شبكة»", () => {
    renderHook(() => useConnectionWatch(), { wrapper: withSocket(null) });
    act(() => void window.dispatchEvent(new Event("online")));
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(connection.checkConnection).toHaveBeenCalledTimes(1);
    expect(connection.reportOffline).toHaveBeenCalledTimes(1);
  });

  it("شبكةٌ بطيئةٌ جداً (2g) ⇒ يُقال، ويتبع تغيّرها", () => {
    const listeners: (() => void)[] = [];
    const conn = { effectiveType: "2g", addEventListener: (_: string, cb: () => void) => listeners.push(cb), removeEventListener: vi.fn() };
    Object.defineProperty(navigator, "connection", { value: conn, configurable: true });
    try {
      const { unmount } = renderHook(() => useConnectionWatch(), { wrapper: withSocket(null) });
      conn.effectiveType = "4g";
      act(() => listeners.forEach((cb) => cb()));
      expect(vi.mocked(connection.reportSlow).mock.calls).toEqual([[true], [false]]);
      unmount();
      expect(conn.removeEventListener).toHaveBeenCalled();
    } finally {
      delete (navigator as { connection?: unknown }).connection;
    }
  });

  /**
   * انقطاع المقبس لحظةً (إعادة اتصالٍ عابرة) لا يُعلَن: يُنتظر قليلاً، والاتصال
   * إن عاد ألغى الإعلان. وانقطاعٌ قبل أوّل اتصالٍ ليس انقطاعاً.
   */
  it("المقبس: متّصلٌ ⇒ الخادم حاضر؛ وينقطع ⇒ يُعلَن بعد مهلة، ما لم يعد قبلها", () => {
    vi.useFakeTimers();
    const socket = fakeSocket(true);
    const { unmount } = renderHook(() => useConnectionWatch(), { wrapper: withSocket(socket) });
    expect(connection.reportServerUp).toHaveBeenCalledTimes(1);

    act(() => socket.emit("disconnect"));
    act(() => socket.emit("connect"));
    act(() => void vi.advanceTimersByTime(1000));
    expect(connection.reportUnreachable).not.toHaveBeenCalled();

    act(() => socket.emit("connect_error"));
    act(() => socket.emit("disconnect"));
    act(() => void vi.advanceTimersByTime(300));
    expect(connection.reportUnreachable).toHaveBeenCalledTimes(1);

    act(() => socket.emit("disconnect"));
    unmount();
    act(() => void vi.advanceTimersByTime(1000));
    expect(connection.reportUnreachable).toHaveBeenCalledTimes(1);
    expect(socket.count("connect")).toBe(0);
  });

  it("وانقطاعٌ قبل أوّل اتصال ⇒ لا شيء", () => {
    vi.useFakeTimers();
    const socket = fakeSocket(false);
    renderHook(() => useConnectionWatch(), { wrapper: withSocket(socket) });
    act(() => socket.emit("connect_error"));
    act(() => void vi.advanceTimersByTime(1000));
    expect(connection.reportUnreachable).not.toHaveBeenCalled();
  });
});

describe("useMediaQuery", () => {
  it("يتبع الاستعلام حين يتغيّر، ويُقرأ لحظةً بلا خطّاف", () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q === PHONE_QUERY && matches,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    })) as never;
    try {
      const { result, unmount } = renderHook(() => useMediaQuery(PHONE_QUERY));
      expect(result.current).toBe(false);
      matches = true;
      act(() => listeners.forEach((cb) => cb()));
      expect([result.current, isPhoneNow()]).toEqual([true, true]);
      unmount();
      expect(listeners.size).toBe(0);
    } finally {
      window.matchMedia = original;
    }
  });

  it("ومتصفّحٌ بلا matchMedia ⇒ لا", () => {
    const original = window.matchMedia;
    window.matchMedia = undefined as never;
    try {
      expect(renderHook(() => useMediaQuery("(min-width: 1px)")).result.current).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("useDebouncedValue", () => {
  it("القيمة بعد أن تهدأ الكتابة، لا مع كلّ حرف", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), { initialProps: { v: "a" } });
    rerender({ v: "ab" });
    act(() => void vi.advanceTimersByTime(200));
    rerender({ v: "abc" });
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe("a");
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe("abc");
  });
});

describe("useDates", () => {
  beforeEach(async () => void (await i18n.changeLanguage("ar")));
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString();
  };

  it("التاريخ بلغة الواجهة، بوقته إن طُلب؛ وتاريخٌ لا يُقرأ يُعاد كما هو", () => {
    const { result } = renderHook(() => useDates());
    const iso = "2026-10-19T09:30:00Z";
    expect(result.current.fmtDate(iso)).toBe(new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(iso)));
    expect(result.current.fmtDate(iso, true)).not.toBe(result.current.fmtDate(iso));
    expect(result.current.fmtDate("ليس تاريخاً")).toBe("ليس تاريخاً");
  });

  it("اليوم، وغداً، وبعد أيام، ومتأخّرٌ بأيام", () => {
    const { result } = renderHook(() => useDates());
    expect(result.current.relative(day(0))).toBe(i18n.t("pro.today"));
    expect(result.current.relative(day(1))).toBe(i18n.t("pro.tomorrow"));
    expect(result.current.relative(day(5))).toBe(i18n.t("pro.inDays", { count: 5 }));
    expect(result.current.relative(day(-3))).toBe(i18n.t("pro.lateByDays", { count: 3 }));
  });

  it("وبلا لغةٍ معروفة ⇒ العربية", () => {
    const lang = i18n.language;
    i18n.language = "" as never;
    try {
      const { result } = renderHook(() => useDates());
      expect(result.current.fmtDate("2026-10-19")).toBe(new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date("2026-10-19")));
    } finally {
      i18n.language = lang;
    }
  });
});

describe("useReveal", () => {
  let observed: { cb: (e: { isIntersecting: boolean }[]) => void; disconnect: ReturnType<typeof vi.fn> } | null = null;
  beforeEach(() => {
    observed = null;
    window.IntersectionObserver = class {
      disconnect = vi.fn();
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        observed = { cb, disconnect: this.disconnect };
      }
      observe() {}
    } as never;
  });

  function Box({ once }: { once?: boolean }) {
    const { ref, visible } = useReveal({ once });
    return <div ref={ref}>{visible ? "shown" : "hidden"}</div>;
  }

  it("يظهر حين يدخل الشاشة، ثمّ لا يُراقَب", () => {
    render(<Box />);
    expect(screen.getByText("hidden")).toBeInTheDocument();
    act(() => observed!.cb([{ isIntersecting: true }]));
    expect(screen.getByText("shown")).toBeInTheDocument();
    expect(observed!.disconnect).toHaveBeenCalled();
  });

  it("ومع once=false يختفي حين يخرج", () => {
    render(<Box once={false} />);
    act(() => observed!.cb([{ isIntersecting: true }]));
    act(() => observed!.cb([{ isIntersecting: false }]));
    expect(screen.getByText("hidden")).toBeInTheDocument();
  });

  it("ومن طلب تقليل الحركة يراه فوراً", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    render(<Box />);
    expect(screen.getByText("shown")).toBeInTheDocument();
    expect(observed).toBeNull();
  });

  it("وبلا عنصرٍ يُراقَب ⇒ لا مراقب", () => {
    renderHook(() => useReveal());
    expect(observed).toBeNull();
  });
});
