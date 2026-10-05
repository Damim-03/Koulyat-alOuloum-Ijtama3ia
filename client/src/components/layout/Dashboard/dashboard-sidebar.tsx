import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import facultyLogo from "../../../assets/Faculty.png";

export interface NavItem {
  to: string; // raw path, e.g. PATHS.professor.root
  labelKey: string; // i18n key
  icon: LucideIcon;
  end?: boolean; // exact match (for index route)
  /** A count to show beside the link — unread messages, for one. */
  badge?: number;
}

interface Props {
  items: NavItem[];
  panelKey: string; // i18n key for the panel title
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({ items, panelKey, collapsed, onToggle }: Props) {
  const { t } = useTranslation();
  const { localePath } = useLanguage();

  return (
    <aside
      className={`sticky top-0 flex h-svh shrink-0 flex-col border-e border-forest/10 bg-forest text-cream transition-[width] duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* brand — ويعود إلى الصفحة الرئيسية للموقع، كما يُنتظر من شعارٍ في رأس الصفحة */}
      <Link
        to={localePath("/")}
        title={t("auth.backHome")}
        aria-label={`${t("brand.short")} — ${t("auth.backHome")}`}
        className={`group flex h-16 items-center gap-3 border-b border-white/10 transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none ${
          collapsed ? "justify-center px-2" : "px-3"
        }`}
      >
        {/* The faculty mark is 1.3:1, so it is sized by height and takes the
            width it needs. Collapsed the rail is only 64px wide, so there it is
            capped by width instead — otherwise it would spill past the rail. */}
        <img
          src={facultyLogo}
          alt={t("brand.facultyName")}
          className={`shrink-0 object-contain transition-transform duration-300 group-hover:scale-105 ${
            collapsed ? "h-auto w-11" : "h-11 w-auto"
          }`}
        />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate font-serif text-sm font-bold text-cream transition group-hover:text-gold-soft">
              {t("brand.short")}
            </p>
            <p className="truncate text-[10.5px] text-soft-sage">{t(panelKey)}</p>
          </div>
        )}
      </Link>

      {/* nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={localePath(item.to)}
              end={item.end}
              title={collapsed ? t(item.labelKey) : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                  collapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "bg-linear-to-br from-gold to-gold-soft text-forest-deep shadow-md shadow-gold/20"
                    : "text-cream/70 hover:bg-white/8 hover:text-cream"
                }`
              }
            >
              <span className="relative shrink-0">
                <Icon size={18} />
                {collapsed && !!item.badge && (
                  <span className="absolute -top-1.5 -end-1.5 size-2.5 rounded-full border-2 border-forest bg-red-500" />
                )}
              </span>
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
              {!collapsed && !!item.badge && (
                <span
                  className="ms-auto grid min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10.5px] font-bold text-white tabular-nums"
                  data-testid="nav-badge"
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center gap-3 border-t border-white/10 px-3 py-3 text-[12px] text-cream/50 transition hover:bg-white/5 hover:text-cream"
        title={collapsed ? t("dash.expand") : t("dash.collapse")}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5">
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </span>
        {!collapsed && <span>{t("dash.collapse")}</span>}
      </button>
    </aside>
  );
}