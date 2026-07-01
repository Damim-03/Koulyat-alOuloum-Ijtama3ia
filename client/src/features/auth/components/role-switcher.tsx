import type { LoginRole } from "../../../types/enums";
import { ROLES } from "../../../config/roles.config";
import { cn } from "../../../lib/utils";

interface Props {
  value: LoginRole;
  onChange: (role: LoginRole) => void;
}

const ORDER: LoginRole[] = ["student", "professor", "admin"];

export function RoleSwitcher({ value, onChange }: Props) {
  return (
    <div className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-forest/10 bg-cream-card/70 p-1">
      {ORDER.map((key) => {
        const { label, Icon } = ROLES[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13.5px] font-medium transition",
              active
                ? "bg-linear-to-br from-forest-soft to-forest font-bold text-cream shadow-[0_6px_16px_rgba(38,66,61,0.28)]"
                : "text-clay hover:bg-forest/[0.04] hover:text-forest",
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}