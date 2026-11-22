import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useLanguage } from "../../../hooks/use-language";
import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import { PHONE_QUERY, useMediaQuery } from "../../../hooks/use-media-query";
import { useMessagesSummary } from "../../../features/messages/hooks/messages-hook";
import { DashboardSidebar, type NavItem } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { SecurityAlerts } from "../../../features/account/components/security-alerts";

interface Props {
  items: NavItem[];
  role: "admin" | "professor" | "student";
  /** i18n key of the panel's name — the sidebar's subtitle and the header. */
  panelKey: string;
}

/**
 * The frame every dashboard shares: sidebar, header, and the page.
 *
 * On a phone the sidebar is a drawer over the page, opened from the header's
 * menu button and closed by choosing a page, tapping outside it, or Escape.
 * From a tablet up it stays in the row beside the page — the narrow rail by
 * default below 1024px, open above — and an open sidebar folds back into the
 * rail the moment the reader clicks anywhere outside it (or presses Escape):
 * open while it is wanted, out of the way as soon as the page is.
 */
export function DashboardShell({ items: nav, role, panelKey }: Props) {
  const { dir } = useLanguage();
  const location = useLocation();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = isPhone && drawerOpen;
  /** Open in the row, from a tablet up. */
  const pinnedOpen = !isPhone && !collapsed;
  const close = () => {
    setDrawerOpen(false);
    setCollapsed(true);
  };

  // A press anywhere outside the open sidebar folds it. The sidebar itself
  // and the buttons that toggle it are not "outside": the header's menu
  // button would otherwise fold it on press and reopen it on click.
  useEffect(() => {
    if (!pinnedOpen) return;
    const onPress = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-sidebar], [data-sidebar-toggle]")) return;
      setCollapsed(true);
    };
    document.addEventListener("pointerdown", onPress);
    return () => document.removeEventListener("pointerdown", onPress);
  }, [pinnedOpen]);

  // The unread count rides on the messages link, kept live by the socket.
  const { data: summary } = useMessagesSummary();
  const items = nav.map((i) => (i.to.endsWith("/messages") ? { ...i, badge: summary?.unread } : i));

  useEffect(() => {
    // A new page starts at its top. The window keeps its scroll across
    // client-side navigation, so a page opened from a scrolled list used to
    // open part-way down, its heading tucked under the sticky header. Only
    // the path counts: changing a filter in the query string stays put.
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useBodyScrollLock(drawer);
  const open = drawer || pinnedOpen;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDrawerOpen(false);
      setCollapsed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div dir={dir} className="flex min-h-svh bg-cream font-body">
      <DashboardSidebar
        items={items}
        role={role}
        panelKey={panelKey}
        collapsed={collapsed && !isPhone}
        onToggle={() => setCollapsed((c) => !c)}
        isPhone={isPhone}
        drawerOpen={drawer}
        onClose={close}
      />
      {/* The phone drawer's backdrop: a tap there closes it. Always mounted,
          so it fades in and out instead of blinking. */}
      <div
        aria-hidden
        data-testid="sidebar-backdrop"
        onClick={close}
        className={`fixed inset-0 z-40 bg-forest-deep/55 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none md:hidden ${
          drawer ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          onMenuClick={() => (isPhone ? setDrawerOpen((o) => !o) : setCollapsed((c) => !c))}
          menuExpanded={isPhone ? drawer : !collapsed}
          titleKey={panelKey}
        />
        {/*
          The window scrolls, not <main>: it grows with its page. It used to
          carry `overflow-y-auto`, which never scrolled but made it a scroll
          container all the same — so every `sticky` inside it (the previews
          beside the site's forms, «unsaved changes» bar) stuck to a box that
          never moved, and scrolled away with the page. `clip` keeps what is
          wider than the column from widening the page, without that.
        */}
        <main className="min-w-0 flex-1 overflow-x-clip p-4 sm:p-5 lg:p-6">
          <SecurityAlerts role={role} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
