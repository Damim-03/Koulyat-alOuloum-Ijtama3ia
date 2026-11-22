import { describe, expect, it, afterEach } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LayoutDashboard, LayoutTemplate, Archive, Users } from "lucide-react";
import { setHidden, useShown } from "./site-visibility";
import { DashboardSidebar, type NavItem } from "../components/layout/Dashboard/dashboard-sidebar";

afterEach(() => act(() => setHidden([])));

describe("site visibility", () => {
  it("answers per element, and updates open screens when the list changes", () => {
    const { result } = renderHook(() => useShown());
    expect(result.current("home.news")).toBe(true);

    act(() => setHidden(["home.news"]));
    expect(result.current("home.news")).toBe(false);
    expect(result.current("home.features")).toBe(true);

    act(() => setHidden([]));
    expect(result.current("home.news")).toBe(true);
  });

  it("the same list again re-renders nothing", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useShown();
    });
    act(() => setHidden(["a.b"]));
    const after = renders;
    act(() => setHidden(["a.b"]));
    expect(renders).toBe(after);
  });
});

describe("sidebar links the admin hid", () => {
  const items: NavItem[] = [
    { to: "/admin", labelKey: "dash.dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/users", labelKey: "dash.users", icon: Users },
    { to: "/admin/academic-years", labelKey: "dash.archive", icon: Archive },
    { to: "/admin/homepage", labelKey: "admin.site.nav", icon: LayoutTemplate },
  ];
  const draw = () =>
    render(
      <MemoryRouter>
        <DashboardSidebar items={items} role="admin" panelKey="dash.adminPanel" collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );

  it("leaves the hidden link out of that role's menu only", () => {
    act(() => setHidden(["sidebar.admin.dash.archive", "sidebar.professor.dash.users"]));
    draw();
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links.some((h) => h?.endsWith("/admin/academic-years"))).toBe(false);
    expect(links.some((h) => h?.endsWith("/admin/users"))).toBe(true);
  });

  it("never hides the dashboard or the way back to the site editor", () => {
    act(() => setHidden(["sidebar.admin.dash.dashboard", "sidebar.admin.admin.site.nav"]));
    draw();
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links.some((h) => h?.endsWith("/admin"))).toBe(true);
    expect(links.some((h) => h?.endsWith("/admin/homepage"))).toBe(true);
  });
});
