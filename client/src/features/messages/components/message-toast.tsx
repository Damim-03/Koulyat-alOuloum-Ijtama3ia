import { useTranslation } from "react-i18next";
import { Megaphone, X } from "lucide-react";
import { UserAvatar } from "../../../components/ui/user-avatar";
import type { NewMessagePayload } from "../../../lib/socket/socket";
import { personName, previewOf } from "../messages-utils";

/**
 * The card a new message arrives as, wherever the reader happens to be.
 * Sender, subject and the first line of the text — enough to decide whether
 * to open it now.
 *
 * Content only: the frame is the Toaster's, shared with every other
 * notification. It used to draw a frame of its own inside that one — two
 * borders a few pixels apart, the inner card pushed to one side and its close
 * button cut off by the outer.
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
    <div className="flex min-w-0 flex-1 items-start gap-3" role="status" data-testid="message-toast">
      <span className="relative shrink-0">
        <UserAvatar user={payload.sender} size={42} />
        <span className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-cream-card bg-emerald-500" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold">
          {payload.broadcast ? <Megaphone size={12} /> : null}
          {payload.broadcast ? t("msg.toast.broadcast") : t("msg.toast.newMessage")}
        </p>
        <p className="mt-0.5 truncate font-serif text-[14.5px] leading-snug font-bold text-forest">{personName(payload.sender)}</p>
        {payload.subject && <p className="truncate text-[12.5px] font-semibold text-forest/85">{payload.subject}</p>}
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-clay">{previewOf(payload.preview, payload.attachments, t)}</p>
        <span className="mt-2 inline-flex rounded-xl bg-linear-to-b from-gold-soft to-gold px-3 py-1.5 text-xs font-bold text-[var(--t-brand-deep)]">
          {t("msg.toast.open")}
        </span>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("msg.close")}
        // Where the Toaster puts its own close button, so every notification closes alike.
        className="absolute end-2.5 top-2.5 grid size-7 place-items-center rounded-lg text-clay ring-1 ring-forest/10 transition hover:bg-forest/5 hover:text-forest"
      >
        <X size={14} />
      </button>
    </div>
  );
}
