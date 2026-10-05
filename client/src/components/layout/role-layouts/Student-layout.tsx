import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, FolderKanban, Mail } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import { DashboardSidebar, type NavItem } from "../Dashboard/dashboard-sidebar";
import { DashboardHeader } from "../Dashboard/dashboard-header";
import { SessionGuard } from "../../session/session-guard";
import { useMessagesSummary } from "../../../features/messages/hooks/messages-hook";

const R = PATHS.student.root;

const NAV: NavItem[] = [
  { to: R, labelKey: "dash.dashboard", icon: LayoutDashboard, end: true },
  { to: `${R}/requests`, labelKey: "dash.myRequests", icon: Inbox },
  { to: `${R}/project`, labelKey: "dash.myProject", icon: FolderKanban },
  { to: `${R}/messages`, labelKey: "messages.title", icon: Mail },
];

export function StudentLayout() {
  const { dir } = useLanguage();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  // The unread count rides on the messages link, kept live by the socket.
  const { data: summary } = useMessagesSummary();
  const items = NAV.map((i) => (i.to.endsWith("/messages") ? { ...i, badge: summary?.unread } : i));

  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true);
    // A new page starts at its top. The window keeps its scroll across
    // client-side navigation, so a page opened from a scrolled list used to
    // open part-way down, its heading tucked under the sticky header. Only
    // the path counts: changing a filter in the query string stays put.
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <SessionGuard>
      <div dir={dir} className="flex min-h-svh bg-cream font-body">
        <DashboardSidebar
          items={items}
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
