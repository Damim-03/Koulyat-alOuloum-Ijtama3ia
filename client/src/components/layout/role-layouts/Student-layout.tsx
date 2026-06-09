import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  FolderKanban,
  CalendarClock,
  FileText,
  Users,
  GraduationCap,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import {
  DashboardSidebar,
  type NavItem,
} from "../Dashboard/dashboard-sidebar";
import { SessionGuard } from "../../../components/session/session-guard";
import { DashboardHeader } from "../Dashboard/dashboard-header";

const NAV: NavItem[] = [
  {
    to: PATHS.student.root,
    labelKey: "dash.dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: `${PATHS.student.root}/topics`,
    labelKey: "dash.browseTopics",
    icon: ListChecks,
  },
  {
    to: `${PATHS.student.root}/project`,
    labelKey: "dash.myProject",
    icon: FolderKanban,
  },
  {
    to: `${PATHS.student.root}/timeline`,
    labelKey: "dash.timeline",
    icon: CalendarClock,
  },
  { to: `${PATHS.student.root}/files`, labelKey: "dash.files", icon: FileText },
  {
    to: `${PATHS.student.root}/meetings`,
    labelKey: "dash.meetings",
    icon: Users,
  },
  {
    to: `${PATHS.student.root}/defense`,
    labelKey: "dash.defense",
    icon: GraduationCap,
  },
];

export function StudentLayout() {
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
          panelKey="dash.studentPanel"
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            onMenuClick={() => setCollapsed((c) => !c)}
            titleKey="dash.studentPanel"
          />
          <main className="flex-1 overflow-y-auto p-5 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}
