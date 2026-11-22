import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCog,
  Building2,
  Layers,
  Archive,
  FileText,
  FolderKanban,
  MessagesSquare, Mail,
  LayoutTemplate,
} from "lucide-react";
import { PATHS } from "../../../routes/paths";
import type { NavItem } from "../Dashboard/dashboard-sidebar";
import { DashboardShell } from "../Dashboard/dashboard-shell";

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
    labelKey: "dash.archive",
    icon: Archive,
  },
  { to: `${R}/topics`, labelKey: "dash.professorProposals", icon: FileText },
  {
    to: `${R}/group-requests`,
    labelKey: "admin.groupRequestsTitle",
    icon: Users,
  },
  { to: `${R}/projects`, labelKey: "admin.projects", icon: FolderKanban },
  { to: `${R}/messages`, labelKey: "admin.messagesTitle", icon: Mail },
  { to: `${R}/defenses`, labelKey: "dash.defense", icon: MessagesSquare },
  { to: `${R}/homepage`, labelKey: "admin.site.nav", icon: LayoutTemplate },
];

export function AdminLayout() {
  return <DashboardShell items={NAV} role="admin" panelKey="dash.adminPanel" />;
}
