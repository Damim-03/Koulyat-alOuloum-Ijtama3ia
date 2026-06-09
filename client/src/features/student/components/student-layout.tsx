import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  FolderKanban,
  GitBranch,
  FolderOpen,
  CalendarClock,
  GraduationCap,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import {
  DashboardSidebar,
  type NavItem,
} from "../../../components/layout/Dashboard/dashboard-sidebar";
import { DashboardHeader } from "../../../components/layout/Dashboard/dashboard-header";

const NAV: NavItem[] = [
  { to: PATHS.student.root, labelKey: "stu.dashboard", icon: LayoutDashboard, end: true },
  { to: `${PATHS.student.root}/topics`, labelKey: "stu.browseTopics", icon: Search },
  { to: `${PATHS.student.root}/project`, labelKey: "stu.myProject", icon: FolderKanban },
  { to: `${PATHS.student.root}/timeline`, labelKey: "stu.timeline", icon: GitBranch },
  { to: `${PATHS.student.root}/files`, labelKey: "stu.files", icon: FolderOpen },
  { to: `${PATHS.student.root}/meetings`, labelKey: "stu.meetings", icon: CalendarClock },
  { to: `${PATHS.student.root}/defense`, labelKey: "stu.defense", icon: GraduationCap },
];

export function StudentLayout() {
  const { dir } = useLanguage();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true);
  }, [location.pathname]);

  return (
    <div dir={dir} className="flex min-h-svh bg-cream font-body">
      <DashboardSidebar
        items={NAV}
        panelKey="stu.studentPanel"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader onMenuClick={() => setCollapsed((c) => !c)} titleKey="stu.studentPanel" />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
