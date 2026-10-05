import { useTranslation } from "react-i18next";
import { Megaphone, X } from "lucide-react";
import { UserAvatar } from "../../../components/ui/user-avatar";
import type { NewMessagePayload } from "../../../lib/socket/socket";
import { personName } from "../messages-utils";

/**
 * The card a new message arrives as, wherever the reader happens to be.
 * Sender, subject and the first line of the text — enough to decide whether
 * to open it now.
 */
export function MessageToast({
  payload,
  onOpen,
  onClose,
}: {
  payload: NewMessagePayload;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex w-[min(92vw,380px)] items-start gap-3 overflow-hidden rounded-2xl border border-gold/40 bg-cream-card p-3.5 font-body shadow-[0_18px_40px_-12px_rgba(22,36,31,0.55)]"
      role="status"
      data-testid="message-toast"
    >
      <span className="relative shrink-0">
        <UserAvatar user={payload.sender} size={42} />
        <span className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-cream-card bg-emerald-500" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gold">
          {payload.broadcast ? <Megaphone size={12} /> : null}
          {payload.broadcast ? t("msg.toast.broadcast") : t("msg.toast.newMessage")}
        </p>
        <p className="truncate text-[13.5px] font-bold text-forest">{personName(payload.sender)}</p>
        {payload.subject && <p className="truncate text-[12.5px] font-semibold text-forest/85">{payload.subject}</p>}
        <p className="line-clamp-2 text-[12px] leading-relaxed text-clay">{payload.preview}</p>
        <span className="mt-1.5 inline-flex rounded-lg bg-forest px-2.5 py-1 text-[11px] font-semibold text-cream">
          {t("msg.toast.open")}
        </span>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("msg.close")}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/10 hover:text-forest"
      >
        <X size={14} />
      </button>
    </div>
  );
}
