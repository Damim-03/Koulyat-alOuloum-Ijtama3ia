import {
  LayoutDashboard,
  ListChecks,
  Milestone,
  FolderKanban,
  Mail,
} from "lucide-react";
import { PATHS } from "../../../routes/paths";
import type { NavItem } from "../Dashboard/dashboard-sidebar";
import { DashboardShell } from "../Dashboard/dashboard-shell";

const R = PATHS.professor.root;

const NAV: NavItem[] = [
  { to: R, labelKey: "dash.dashboard", icon: LayoutDashboard, end: true },
  { to: `${R}/topics`, labelKey: "dash.topics", icon: ListChecks },
  { to: `${R}/groups`, labelKey: "dash.myProjects", icon: FolderKanban },
  { to: `${R}/milestones`, labelKey: "dash.milestones", icon: Milestone },
  { to: `${R}/messages`, labelKey: "messages.title", icon: Mail },
];

export function ProfessorLayout() {
  return <DashboardShell items={NAV} role="professor" panelKey="dash.professorPanel" />;
}
