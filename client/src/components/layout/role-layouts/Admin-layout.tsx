import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCog,
  Building2,
  Layers,
  CalendarDays,
  FileText,
  ClipboardList,
  FolderKanban,
  MessagesSquare, Mail,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import { DashboardSidebar, type NavItem } from "../Dashboard/dashboard-sidebar";
import { DashboardHeader } from "../Dashboard/dashboard-header";
import { SessionGuard } from "../../session/session-guard";

const R = PATHS.admin.root;

const NAV: NavItem[] = [
  { to: R, labelKey: "dash.dashboard", icon: LayoutDashboard, end: true },
  { to: `${R}/users`, labelKey: "dash.users", icon: Users },
  { to: `${R}/students`, labelKey: "dash.students", icon: GraduationCap },
  { to: `${R}/professors`, labelKey: "dash.professors", icon: UserCog },
  {
    to: `${R}/faculties`,
    labelKey: "admin.academicHierarchy",
    icon: Building2,
  },
  {
    to: `${R}/specializations`,
    labelKey: "dash.specializations",
    icon: Layers,
  },
  {
    to: `${R}/academic-years`,
    labelKey: "dash.academicYears",
    icon: CalendarDays,
  },
  { to: `${R}/topics`, labelKey: "dash.topics", icon: FileText },
  {
    to: `${R}/group-requests`,
    labelKey: "admin.groupRequestsTitle",
    icon: Users,
  },
  {
    to: `${R}/applications`,
    labelKey: "admin.applications",
    icon: ClipboardList,
  },
  { to: `${R}/projects`, labelKey: "admin.projects", icon: FolderKanban },
  { to: `${R}/messages`, labelKey: "admin.messagesTitle", icon: Mail },
  { to: `${R}/defenses`, labelKey: "dash.defense", icon: MessagesSquare },
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
