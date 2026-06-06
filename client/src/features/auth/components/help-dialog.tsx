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
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(4,6,8,0.72)] p-6 backdrop-blur-sm [animation:fade_0.2s_both]"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[18px] border border-white/[0.07] bg-panel p-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.6)] [animation:fadeUp_0.25s_both]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 font-display text-[17px]">{content.title}</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid place-items-center rounded-[9px] border border-white/[0.07] bg-white/[0.05] p-1.5 text-muted hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {content.items.map((it, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-[7px] size-2 flex-none rounded-full bg-gradient-to-br from-mint to-teal" />
              <div>
                <div className="mb-[3px] text-sm font-bold">{it.t}</div>
                <div className="text-[13px] leading-[1.8] text-muted">{it.d}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full cursor-pointer rounded-[11px] bg-gradient-to-br from-mint to-teal p-[11px] font-bold text-[#06302a]"
        >
          فهمت
        </button>
      </div>
    </div>
  );
}