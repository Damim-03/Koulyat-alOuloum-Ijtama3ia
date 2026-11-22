import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AxiosAdapter } from "axios";
import { client } from "../../../lib/api/client";
import { useAuthStore } from "../../../store/auth.store";
import { useLogin, useTwoFactorLogin } from "./use-login";
import { useMe } from "./use-me";

/**
 * الدخول — بكلّ دور، وبخطوةٍ ثانيةٍ للمسؤول.
 *
 * كلمة المرور وحدها لمسؤولٍ فعّل التحقّق بخطوتين تُعطي تذكرةً لا جلسة: لا
 * يُسجَّل دخولٌ حتى يُكتب رمز التطبيق.
 */
let calls: { url: string; body: unknown }[] = [];
let reply: unknown = {};
const adapter: AxiosAdapter = async (config) => {
  calls.push({ url: config.url ?? "", body: config.data ? JSON.parse(config.data as string) : undefined });
  return { data: reply, status: 200, statusText: "OK", headers: {}, config };
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);
const user = (role: string) => ({ id: "u1", role, mustChangePassword: false });

beforeEach(() => {
  calls = [];
  client.defaults.adapter = adapter;
  useAuthStore.getState().logout();
});

describe("useLogin", () => {
  it.each([
    ["student", "/auth/student/login", { registrationNumber: "202039012345", password: "p" }],
    ["professor", "/auth/professor/login", { universityEmail: "a@univ.dz", password: "p" }],
    ["admin", "/auth/admin/login", { email: "a@univ.dz", password: "p" }],
  ])("%s ⇒ مسار دوره، ثمّ الجلسة", async (role, url, body) => {
    reply = { user: user(role), accessToken: `tok-${role}` };
    const { result } = renderHook(() => useLogin(role as never), { wrapper });
    await act(() => result.current.mutateAsync(body as never));
    expect(calls).toEqual([{ url, body }]);
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, accessToken: `tok-${role}`, user: { role } });
  });

  it("ومسؤولٌ بتحقّقٍ بخطوتين ⇒ تذكرةٌ لا جلسة، ثمّ الرمز يفتحها", async () => {
    reply = { twoFactorRequired: true, challenge: "ticket" };
    const { result } = renderHook(() => useLogin("admin" as never), { wrapper });
    await act(() => result.current.mutateAsync({ email: "a@univ.dz", password: "p" } as never));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    reply = { user: user("admin"), accessToken: "tok-2fa" };
    const second = renderHook(() => useTwoFactorLogin(), { wrapper });
    await act(() => second.result.current.mutateAsync({ challenge: "ticket", code: "123456" }));
    expect(calls.at(-1)).toEqual({ url: "/auth/admin/login/2fa", body: { challenge: "ticket", code: "123456" } });
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, accessToken: "tok-2fa" });
  });
});

describe("useMe", () => {
  it("الزائر ⇒ لا يُسأل الخادم", () => {
    renderHook(() => useMe(), { wrapper });
    expect(calls).toEqual([]);
  });

  /** إعلامٌ من الخادم (كلمة مرورٍ أعادتها الإدارة) يصل الصفحة في الزيارة التالية، بلا خروج. */
  it("من دخل ⇒ يُحدَّث المستخدم بما يقوله الخادم الآن", async () => {
    useAuthStore.getState().login(user("student") as never, { accessToken: "t" } as never);
    reply = { user: { ...user("student"), mustChangePassword: true } };
    renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(useAuthStore.getState().user).toMatchObject({ mustChangePassword: true }));
    expect(calls[0]!.url).toBe("/auth/me");
  });
});
