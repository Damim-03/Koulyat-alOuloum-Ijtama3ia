import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "../i18n/i18n";
import { useAuthStore } from "../store/auth.store";
import { ProtectedRoute } from "./guards/protected-route";
import { RoleRoute } from "./guards/role-route";
import { PublicOnlyRoute } from "./guards/public-only-route";
import { RoleRedirect } from "./role-redirect";

/**
 * حرّاس المسارات — بين الزائر والصفحات المحميّة، وبين كلّ دورٍ وصفحات غيره.
 * والوجهة دائماً بلغة الرابط الحاليّ: من كان في /fr/… يبقى في /fr/….
 */
vi.mock("../features/account/components/account-setup-gate", () => ({
  AccountSetupGate: ({ children }: { children: ReactNode }) => <div data-testid="gate">{children}</div>,
}));

function Where() {
  const { pathname, state } = useLocation();
  const from = (state as { from?: { pathname: string } } | null)?.from?.pathname;
  return <p data-testid="at">{from ? `${pathname} ← ${from}` : pathname}</p>;
}

/** زيارةٌ جديدة: ما رُسم قبلها في الاختبار نفسه يُزال. */
const visit = (path: string, element: ReactNode) => {
  cleanup();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
};
const at = () => screen.getByTestId("at").textContent;
const signIn = (role: string) =>
  useAuthStore.setState({ user: { id: "u1", role } as never, isAuthenticated: true, accessToken: "t" });

beforeEach(() => useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null }));

describe("ProtectedRoute", () => {
  it("الزائر ⇒ إلى الدخول بلغته، ومعه من أين جاء ليعود إليه", () => {
    visit("/fr/student/topics", <ProtectedRoute>secret</ProtectedRoute>);
    expect(at()).toBe("/fr/login ← /fr/student/topics");
  });

  it("ومن دخل ⇒ الصفحة، خلف بوّابة إعداد الحساب", () => {
    signIn("student");
    visit("/ar/student/topics", <ProtectedRoute>secret</ProtectedRoute>);
    expect(screen.getByTestId("gate")).toHaveTextContent("secret");
  });
});

describe("RoleRoute", () => {
  it("بلا مستخدم ⇒ الدخول؛ وبدورٍ آخر ⇒ 403؛ وبدوره (بأيّ حالة أحرف) ⇒ الصفحة", () => {
    visit("/en/admin", <RoleRoute roles={["admin" as never]}>admin page</RoleRoute>);
    expect(at()).toBe("/en/login");

    signIn("student");
    visit("/en/admin/x", <RoleRoute roles={["admin" as never]}>admin page</RoleRoute>);
    expect(at()).toBe("/en/403");

    signIn("ADMIN");
    visit("/en/admin/y", <RoleRoute roles={["admin" as never]}>admin page</RoleRoute>);
    expect(screen.getByText("admin page")).toBeInTheDocument();
  });
});

describe("PublicOnlyRoute", () => {
  it("الدخول للزائر وحده: من دخل ⇒ لوحته", () => {
    visit("/ar/login", <PublicOnlyRoute>login form</PublicOnlyRoute>);
    expect(screen.getByText("login form")).toBeInTheDocument();

    signIn("student");
    visit("/ar/login/again", <PublicOnlyRoute>login form</PublicOnlyRoute>);
    expect(at()).toBe("/ar/dashboard");
  });

  /**
   * لحظةَ تُحفظ الجلسة يُعاد رسم هذا الحارس وتختفي استمارة الدخول — قبل أن
   * تنتقل هي إلى حيث أرادت. فالعودة إلى الصفحة التي أُرسل منها هنا، لا فيها.
   */
  const loginFrom = (from: unknown) => {
    cleanup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/ar/login", state: { from } }]}>
        <Routes>
          <Route path="/ar/login" element={<PublicOnlyRoute>login form</PublicOnlyRoute>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it.each([
    ["مساراً مشتركاً (صفحة المواضيع)", "student", "/ar/topics"],
    ["أو موضعاً كاملاً في منطقة دوره (ProtectedRoute)", "admin", { pathname: "/ar/admin/topics", search: "?status=open" }],
  ])("ومن دخل وقد جاء من صفحة ⇒ إليها — %s", (_, role, from) => {
    signIn(role);
    loginFrom(from);
    expect(at()).toBe(typeof from === "string" ? from : from.pathname);
  });

  /**
   * الملاحظة يتركها من كان داخلاً قبله: جلسة مسؤولٍ انتهت على /ar/admin/…،
   * ثمّ دخل أستاذٌ من الجهاز نفسه — فكان يُرسل مباشرةً إلى «غير مصرّح».
   */
  it.each([
    ["أستاذٌ وصفحةٌ للإدارة", "professor", { pathname: "/ar/admin/students" }],
    ["طالبٌ وصفحةٌ للأستاذ (مساراً)", "student", "/fr/professor/topics"],
    ["مسؤولٌ وصفحةٌ للطالب", "ADMIN", { pathname: "/ar/student/requests" }],
  ])("وصفحةٌ في منطقة دورٍ آخر ⇒ تُهمل، وإلى لوحته — %s", (_, role, from) => {
    signIn(role);
    loginFrom(from);
    expect(at()).toBe("/ar/dashboard");
  });
});

describe("RoleRedirect", () => {
  it.each([
    [null, "/en/login"],
    ["professor", "/en/professor"],
    ["Student", "/en/student"],
    ["admin", "/en/admin"],
    ["guest", "/en/403"],
  ])("الدور %s ⇒ %s", (role, target) => {
    if (role) signIn(role);
    visit("/en/dashboard", <RoleRedirect />);
    expect(at()).toBe(target);
  });
});
