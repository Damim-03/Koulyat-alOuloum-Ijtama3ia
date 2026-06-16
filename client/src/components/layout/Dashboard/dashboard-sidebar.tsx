import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { GraduationCap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";

export interface NavItem {
  to: string; // raw path, e.g. PATHS.professor.root
  labelKey: string; // i18n key
  icon: LucideIcon;
  end?: boolean; // exact match (for index route)
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
      {/* brand */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-gold to-gold-soft text-forest-deep shadow-lg shadow-gold/20">
          <GraduationCap size={20} strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate font-serif text-sm font-bold text-cream">
              {t("brand.short")}
            </p>
            <p className="truncate text-[10.5px] text-soft-sage">{t(panelKey)}</p>
          </div>
        )}
      </div>

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
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
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