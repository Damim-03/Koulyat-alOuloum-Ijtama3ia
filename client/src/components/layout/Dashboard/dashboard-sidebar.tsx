import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import facultyLogo from "../../../assets/Faculty.png";
import { useShown } from "../../../i18n/site-visibility";

export interface NavItem {
  to: string; // raw path, e.g. PATHS.professor.root
  labelKey: string; // i18n key
  icon: LucideIcon;
  end?: boolean; // exact match (for index route)
  /** A count to show beside the link — unread messages, for one. */
  badge?: number;
}

/**
 * Links the admin can never hide (واجهة الموقع ← النصوص): each space's
 * dashboard, and the way back to that very editor.
 */
const ALWAYS_SHOWN = new Set(["admin.site.nav"]);

interface Props {
  items: NavItem[];
  /** Whose menu — the admin may hide its links: «sidebar.<role>.<labelKey>». */
  role?: "admin" | "professor" | "student";
  panelKey: string; // i18n key for the panel title
  collapsed: boolean;
  onToggle: () => void;
  /** Below `md` the sidebar is a drawer over the page (see DashboardShell). */
  isPhone?: boolean;
  drawerOpen?: boolean;
  onClose?: () => void;
}

export function DashboardSidebar({
  items: all,
  role,
  panelKey,
  collapsed,
  onToggle,
  isPhone = false,
  drawerOpen = false,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const shown = useShown();
  const items = role
    ? all.filter((i) => i.end || ALWAYS_SHOWN.has(i.labelKey) || shown(`sidebar.${role}.${i.labelKey}`))
    : all;

  // Text that only shows with the panel open fades rather than popping in —
  // and comes in a beat after the panel starts to widen, never squeezed.
  const fade = `transition-opacity duration-200 ease-out motion-reduce:transition-none ${
    collapsed ? "opacity-0" : "opacity-100 delay-75"
  }`;

  return (
    <aside
      // Off-screen and closed, the drawer's links must not take keyboard focus.
      inert={isPhone && !drawerOpen}
      aria-label={t(panelKey)}
      // A press inside here is not "outside the sidebar" (see DashboardShell).
      data-sidebar
      className={`flex h-svh shrink-0 flex-col overflow-x-hidden border-e border-forest/10 bg-forest text-cream ${
        // Phone: a drawer sliding in from the start edge, over the page.
        "fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none " +
        // Scoped to phones: an unscoped `rtl:` would outrank `md:` and push the
        // tablet's rail off-screen in Arabic.
        (drawerOpen ? "" : "max-md:ltr:-translate-x-full max-md:rtl:translate-x-full") +
        // Tablet and up: in the row beside the page, as a rail or open — the
        // width eases between the two instead of jumping.
        " md:sticky md:top-0 md:z-auto md:max-w-none md:shadow-none md:transition-[width] md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)] " +
        (collapsed ? "md:w-16" : "md:w-64")
      }`}
    >
      {/* brand — ويعود إلى الصفحة الرئيسية للموقع، كما يُنتظر من شعارٍ في رأس الصفحة */}
      <div className="flex items-stretch border-b border-white/10">
      <Link
        to={localePath("/")}
        title={t("auth.backHome")}
        aria-label={`${t("brand.short")} — ${t("auth.backHome")}`}
        className="group flex h-16 min-w-0 flex-1 items-center gap-3 px-2.5 transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
      >
        {/* One size open or closed, centred in the 64px rail: the mark stays
            put while the panel widens around it. */}
        <img
          src={facultyLogo}
          alt={t("brand.facultyName")}
          className="h-11 w-11 shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
        />
        <div className={`min-w-0 leading-tight whitespace-nowrap ${fade}`}>
          <p className="truncate font-serif text-sm font-bold text-cream transition group-hover:text-gold-soft">
            {t("brand.short")}
          </p>
          <p className="truncate text-[10.5px] text-soft-sage">{t(panelKey)}</p>
        </div>
      </Link>
      {isPhone && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dash.closeMenu")}
          className="grid w-14 shrink-0 place-items-center text-cream/70 transition hover:bg-white/5 hover:text-cream"
        >
          <X size={20} />
        </button>
      )}
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={localePath(item.to)}
              end={item.end}
              title={collapsed ? t(item.labelKey) : undefined}
              // Choosing a page closes the phone's drawer; beside the page the
              // sidebar stays as it is until a press lands outside it.
              onClick={isPhone ? onClose : undefined}
              // 15px puts the 18px icon on the rail's centre line, open or not.
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-[15px] py-2.5 text-[13px] font-medium transition ${
                  isActive
                    ? "bg-linear-to-br from-gold to-gold-soft text-forest-deep shadow-md shadow-gold/20"
                    : "text-cream/70 hover:bg-white/8 hover:text-cream"
                }`
              }
            >
              <span className="relative shrink-0">
                <Icon size={18} />
                {!!item.badge && (
                  <span
                    className={`absolute -top-1.5 -end-1.5 size-2.5 rounded-full border-2 border-forest bg-red-500 transition-opacity duration-200 ${
                      collapsed ? "opacity-100" : "opacity-0"
                    }`}
                  />
                )}
              </span>
              <span className={`truncate whitespace-nowrap ${fade}`}>{t(item.labelKey)}</span>
              {!!item.badge && (
                <span
                  className={`ms-auto grid min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10.5px] font-bold text-white tabular-nums ${fade}`}
                  data-testid="nav-badge"
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* open / close — a drawer closes instead (its own button, or outside it) */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("dash.expand") : t("dash.collapse")}
        className="hidden items-center md:flex gap-3 border-t border-white/10 px-[14px] py-3 text-[12px] text-cream/50 transition hover:bg-white/5 hover:text-cream"
        title={collapsed ? t("dash.expand") : t("dash.collapse")}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5">
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </span>
        <span className={`whitespace-nowrap ${fade}`}>{t("dash.collapse")}</span>
      </button>
    </aside>
  );
}