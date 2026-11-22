import { LayoutDashboard, Inbox, FolderKanban, Mail } from "lucide-react";
import { PATHS } from "../../../routes/paths";
import type { NavItem } from "../Dashboard/dashboard-sidebar";
import { DashboardShell } from "../Dashboard/dashboard-shell";

const R = PATHS.student.root;

const NAV: NavItem[] = [
  { to: R, labelKey: "dash.dashboard", icon: LayoutDashboard, end: true },
  { to: `${R}/requests`, labelKey: "dash.myRequests", icon: Inbox },
  { to: `${R}/project`, labelKey: "dash.myProject", icon: FolderKanban },
  { to: `${R}/messages`, labelKey: "messages.title", icon: Mail },
];

export function StudentLayout() {
  return <DashboardShell items={NAV} role="student" panelKey="dash.studentPanel" />;
}
