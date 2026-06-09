import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Layers,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import {
  DashboardSidebar,
  type NavItem,
} from "../Dashboard/dashboard-sidebar";
import { DashboardHeader } from "../Dashboard/dashboard-header";
import { SessionGuard } from "../../session/session-guard";

const NAV: NavItem[] = [
  { to: PATHS.admin.root, labelKey: "dash.dashboard", icon: LayoutDashboard, end: true },
  { to: `${PATHS.admin.root}/users`, labelKey: "dash.users", icon: Users },
  { to: `${PATHS.admin.root}/topics`, labelKey: "dash.topics", icon: ListChecks },
  { to: `${PATHS.admin.root}/specializations`, labelKey: "dash.specializations", icon: Layers },
  { to: `${PATHS.admin.root}/academic-years`, labelKey: "dash.academicYears", icon: CalendarDays },
  { to: `${PATHS.admin.root}/reports`, labelKey: "dash.reports", icon: BarChart3 },
];

export function AdminLayout() {
  const { dir } = useLanguage();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true);
  }, [location.pathname]);

  return (
    <SessionGuard>
      <div dir={dir} className="flex min-h-svh bg-cream font-body">
        <DashboardSidebar
          items={NAV}
          panelKey="dash.adminPanel"
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            onMenuClick={() => setCollapsed((c) => !c)}
            titleKey="dash.adminPanel"
          />
          <main className="flex-1 overflow-y-auto p-5 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}