import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { FakeSocket } from "../test/fake-socket";
import { SocketProvider } from "./socket-provider";
import { Providers } from "./providers";
import App from "../App";
import { useAuthStore } from "../store/auth.store";
import { SESSION_EXPIRED_EVENT } from "../lib/api/client";
import { fake, installFakeApi } from "../test/fake-api";
import * as F from "../test/fixtures";

/**
 * غلاف التطبيق: المقبس الحيّ وما يحيط بالصفحات (`Providers` و`App`).
 *
 * المقبس يتّصل لمن دخل وبيده رمز، ويطلب الرمز لمن دخل بلا رمز (بعد إعادة
 * التحميل)؛ وحين يقول الخادم إنّ الجلسة أُنهيت من مكانٍ آخر تنتهي هنا فوراً؛
 * وحين يقطع الخادم الخطّ بلا كلمة يُسأل: أتُجدَّد الجلسة؟ فيعود الخطّ.
 */
const socket = vi.hoisted(() => ({ current: null as unknown }));
const api = vi.hoisted(() => ({
  ensureAccessToken: vi.fn(async () => "tok"),
  refreshAccessToken: vi.fn(async () => "tok"),
}));

vi.mock("../lib/socket/socket", () => ({ createSocket: () => socket.current }));
vi.mock("../lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api/client")>()),
  ensureAccessToken: api.ensureAccessToken,
  refreshAccessToken: api.refreshAccessToken,
}));


let s: FakeSocket;
beforeEach(() => {
  s = new FakeSocket();
  socket.current = s;
  api.ensureAccessToken.mockClear();
  api.refreshAccessToken.mockReset().mockResolvedValue("tok");
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
});
afterEach(() => vi.restoreAllMocks());

const signIn = (token: string | null = "tok") =>
  act(() => useAuthStore.setState({ user: F.authUsers.student, accessToken: token, isAuthenticated: true }));

describe("SocketProvider", () => {
  it("لا اتّصال للزائر؛ ومن دخل بيده رمز ⇒ يتّصل، ويخرج ⇒ ينقطع", () => {
    render(<SocketProvider>page</SocketProvider>);
    expect(s.connects).toBe(0);
    signIn();
    expect(s.connected).toBe(true);
    act(() => useAuthStore.getState().logout());
    expect(s.connected).toBe(false);
  });

  it("من دخل ولا رمز بيده (بعد إعادة التحميل) ⇒ يُطلب الرمز أوّلاً، ولا اتّصال قبله", () => {
    render(<SocketProvider>page</SocketProvider>);
    signIn(null);
    expect(api.ensureAccessToken).toHaveBeenCalledTimes(1);
    expect(s.connects).toBe(0);
  });

  it("الخادم: «أُنهيت جلستك» ⇒ تنتهي هنا الآن، بسببها", () => {
    const ended = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, ended);
    render(<SocketProvider>page</SocketProvider>);
    signIn();
    act(() => s.server("session:revoked", {}));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect((ended.mock.calls[0]![0] as CustomEvent).detail).toBe("revoked");

    // وخروجُنا نحن لا يُعدّ إنهاءً من الخارج.
    act(() => s.server("session:revoked", {}));
    expect(ended).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, ended);
  });

  it("الخادم قطع الخطّ ⇒ تُجدَّد الجلسة فيعود؛ وانقطاعٌ من جهتنا لا يُسأل عنه", async () => {
    render(<SocketProvider>page</SocketProvider>);
    signIn();
    const before = s.connects;
    act(() => s.disconnect("io server disconnect"));
    await waitFor(() => expect(s.connects).toBe(before + 1));
    expect(api.refreshAccessToken).toHaveBeenCalledTimes(1);

    act(() => s.disconnect("transport close"));
    expect(api.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it("وتجديدٌ مرفوض ⇒ لا اتّصال (الجلسة تنتهي من طريقها المعتاد)", async () => {
    api.refreshAccessToken.mockRejectedValue(new Error("expired"));
    render(<SocketProvider>page</SocketProvider>);
    signIn();
    const before = s.connects;
    act(() => s.disconnect("io server disconnect"));
    await waitFor(() => expect(api.refreshAccessToken).toHaveBeenCalled());
    expect(s.connects).toBe(before);
  });
});

describe("التطبيق كاملاً", () => {
  it("Providers + App: رابطٌ بلا لغة ⇒ الرئيسية بالعربية، والمقبس للزائر مغلق", { timeout: 20_000 }, async () => {
    installFakeApi();
    fake.reset();
    window.history.pushState({}, "", "/nowhere");
    render(
      <Providers>
        <App />
      </Providers>,
    );
    await waitFor(() => expect(window.location.pathname).toBe("/ar"));
    expect((await screen.findAllByText(/مذكّرتي|مذكرتي/)).length).toBeGreaterThan(0);
    expect(s.connects).toBe(0);
  });
});
