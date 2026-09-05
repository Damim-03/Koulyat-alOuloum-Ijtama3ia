import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, ListChecks, FolderKanban } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import {
  DashboardSidebar,
  type NavItem,
} from "../../../components/layout/Dashboard/dashboard-sidebar";
import { DashboardHeader } from "../../../components/layout/Dashboard/dashboard-header";

export function ProfessorLayout() {
  const { dir, localePath } = useLanguage();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // build nav with locale-aware paths
  const NAV: NavItem[] = [
    {
      to: localePath(PATHS.professor.root),
      labelKey: "dash.dashboard",
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: localePath(`${PATHS.professor.root}/topics`),
      labelKey: "dash.topics",
      icon: ListChecks,
    },
    {
      to: localePath(`${PATHS.professor.root}/groups`),
      labelKey: "dash.myProjects",
      icon: FolderKanban,
    },
  ];

  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true);
  }, [location.pathname]);

  return (
    <div dir={dir} className="flex min-h-svh bg-cream font-body">
      <DashboardSidebar
        items={NAV}
        panelKey="dash.professorPanel"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          onMenuClick={() => setCollapsed((c) => !c)}
          titleKey="dash.professorPanel"
        />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
