import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  Milestone,
  FolderKanban,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import { DashboardSidebar, type NavItem } from "../Dashboard/dashboard-sidebar";
import { DashboardHeader } from "../Dashboard/dashboard-header";
import { SessionGuard } from "../../session/session-guard";

const R = PATHS.professor.root;

const NAV: NavItem[] = [
  { to: R, labelKey: "dash.dashboard", icon: LayoutDashboard, end: true },
  { to: `${R}/topics`, labelKey: "dash.topics", icon: ListChecks },
  { to: `${R}/groups`, labelKey: "dash.myProjects", icon: FolderKanban },
  { to: `${R}/milestones`, labelKey: "dash.milestones", icon: Milestone },
];

export function ProfessorLayout() {
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
    </SessionGuard>
  );
}
