import { X } from "lucide-react";
import type { LoginRole } from "../../../types/enums";
import { HELP } from "../../../config/roles.config";

interface Props {
  role: LoginRole;
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ role, open, onClose }: Props) {
  if (!open) return null;
  const content = HELP[role];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(26,49,45,0.55)] p-6 backdrop-blur-sm animate-[fade_0.2s_both]"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-105nded-[18px] border border-forest/10 bg-cream-card p-5.5 text-forest shadow-[0_30px_80px_rgba(26,49,45,0.35)] animate-[fadeUp_0.25s_both]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 font-display text-[19px] font-bold text-forest">
            {content.title}
          </h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid place-items-center rounded-[9px] border border-forest/10 bg-cream-2 p-1.5 text-clay transition hover:text-forest"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {content.items.map((it, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-1.75 size-2 flex-none rounded-full bg-linear-to-br from-gold-soft to-gold" />
              <div>
                <div className="mb-0.75 text-sm font-bold text-forest">
                  {it.t}
                </div>
                <div className="text-[13px] leading-[1.8] text-clay">
                  {it.d}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full cursor-pointer rounded-[11px] bg-linear-to-br from-forest-soft to-forest p-2.75 font-bold text-cream ring-1 ring-inset ring-gold/15 transition hover:ring-gold/35"
        >
          فهمت
        </button>
      </div>
    </div>
  );
}
