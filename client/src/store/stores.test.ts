import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth.store";
import { applyTheme, resolveTheme, systemTheme, useUIStore } from "./ui.store";

/**
 * المخزنان — من دخل، وتفضيلات الواجهة.
 *
 * ما يُحرس في الجلسة: **لا توكن في localStorage** — التوكن في الذاكرة وحدها،
 * فلا يسرقه سكربتٌ يُحقن في الصفحة؛ وتوكن التجديد ليس هنا أصلاً (كعكة httpOnly).
 */
const user = { id: "u1", role: "student", mustChangePassword: true } as never;
const stored = () => JSON.parse(localStorage.getItem("auth") ?? "{}").state;

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it("الدخول يحفظ المستخدم وعلامته — والتوكن في الذاكرة لا في localStorage", () => {
    useAuthStore.getState().login(user, { accessToken: "secret-token" } as never);
    expect(useAuthStore.getState()).toMatchObject({ user, accessToken: "secret-token", isAuthenticated: true });
    expect(stored()).toEqual({ user, isAuthenticated: true });
    expect(localStorage.getItem("auth")).not.toContain("secret-token");
  });

  it("تعديل بعض حقول المستخدم، واستبداله، وتوكنٌ جديد", () => {
    const { login, patchUser, setUser, setAccessToken } = useAuthStore.getState();
    login(user, { accessToken: "a" } as never);
    patchUser({ mustChangePassword: false } as never);
    expect(useAuthStore.getState().user).toMatchObject({ id: "u1", mustChangePassword: false });
    setUser({ id: "u2" } as never);
    setAccessToken("b");
    expect(useAuthStore.getState()).toMatchObject({ user: { id: "u2" }, accessToken: "b" });
  });

  /** لا مستخدم: لا شيء يُعدَّل — لا مستخدمٌ نصفيّ من بضعة حقول. */
  it("وتعديلٌ بلا مستخدم ⇒ لا شيء", () => {
    useAuthStore.getState().patchUser({ mustChangePassword: false } as never);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("الخروج يمحو كلّ شيء", () => {
    useAuthStore.getState().login(user, { accessToken: "a" } as never);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ user: null, accessToken: null, isAuthenticated: false });
    expect(stored()).toEqual({ user: null, isAuthenticated: false });
  });

  it("ما حُفظ بإصدارٍ قديم بلا شيء ⇒ زائر", async () => {
    localStorage.setItem("auth", JSON.stringify({ state: null, version: 0 }));
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false });
  });
});

describe("useUIStore والسمة", () => {
  afterEach(() => vi.restoreAllMocks());

  it("السمة والصوت يُحفظان", () => {
    useUIStore.getState().setTheme("dark");
    useUIStore.getState().setSound(false);
    expect(JSON.parse(localStorage.getItem("ui")!).state).toEqual({ theme: "dark", sound: false });
  });

  it("«النظام» يتبع ما يطلبه نظام التشغيل، والاختيار الصريح يغلبه", () => {
    expect(systemTheme()).toBe("light");
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    expect([systemTheme(), resolveTheme("system"), resolveTheme("light")]).toEqual(["dark", "dark", "light"]);
  });

  it("تُكتب على <html> بالسمة والصنف معاً", () => {
    applyTheme("dark");
    expect([document.documentElement.dataset.theme, document.documentElement.classList.contains("dark")]).toEqual(["dark", true]);
    applyTheme("light");
    expect([document.documentElement.dataset.theme, document.documentElement.classList.contains("dark")]).toEqual(["light", false]);
  });
});
