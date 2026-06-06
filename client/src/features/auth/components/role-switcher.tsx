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
    <div className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-1">
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
                ? "bg-gradient-to-br from-mint to-teal font-bold text-[#06302a] shadow-[0_6px_18px_rgba(45,212,191,0.3)]"
                : "text-muted hover:text-fg",
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