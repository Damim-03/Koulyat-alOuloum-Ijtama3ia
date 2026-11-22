import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { authApi } from "../features/auth/api/auth.api";
import { useAuth } from "./use-auth";

/**
 * الخروج — فوريّ، ويتمّ ولو سقط طلبه (بلا شبكة، أو توكنٌ منتهٍ، أو خادمٌ
 * غائب). والتوكن يُقرأ قبل أن يُمحى المخزن: المعترضات تجري بعد ذلك، والمخزن
 * عندها فارغ، فيُرسل الطلب بلا توكن ولا يُنهي الخادم شيئاً.
 */
vi.mock("../features/auth/api/auth.api", () => ({
  authApi: { logout: vi.fn(), logoutAll: vi.fn() },
}));

const seen = { path: "" };
function Spy() {
  const here = useLocation().pathname;
  useEffect(() => {
    seen.path = here;
  });
  return null;
}
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={["/ar/student"]}>
    <Routes>
      <Route path="*" element={<><Spy />{children}</>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.mocked(authApi.logout).mockReset();
  vi.mocked(authApi.logoutAll).mockReset();
  useAuthStore.setState({ user: { id: "u1", role: "student" } as never, accessToken: "tok-1", isAuthenticated: true });
});

describe("useAuth", () => {
  it("يعرض المستخدم ودوره", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toMatchObject({ role: "student", isAuthenticated: true });
  });

  it("الخروج: الطلب بالتوكن الحاليّ، والمخزن يُمحى، وإلى صفحة الدخول — ولو سقط الطلب", async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.logout());

    expect(authApi.logout).toHaveBeenCalledWith("tok-1");
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, accessToken: null });
    expect(seen.path).toBe("/login");
  });

  it("والخروج من كلّ الأجهزة كذلك", () => {
    vi.mocked(authApi.logoutAll).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.logoutEverywhere());
    expect(authApi.logoutAll).toHaveBeenCalledWith("tok-1");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("وبلا مستخدم ⇒ لا دور", () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.role).toBeNull();
  });
});
