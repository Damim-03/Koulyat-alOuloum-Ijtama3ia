import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone, Radio, WifiOff, type LucideIcon } from "lucide-react";
import { useSocketStatus } from "../hooks/use-message-alerts";
import { broadcastLabel } from "../messages-utils";
import type { ContactRelation } from "../api/messages.api";

const ROLE_TONE: Record<string, string> = {
  admin: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  professor: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  student: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
};

export function RoleChip({ role }: { role: string }) {
  const { t } = useTranslation();
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${ROLE_TONE[role] ?? "bg-forest/10 text-forest"}`}>
      {t(`roles.${role}`, { defaultValue: role })}
    </span>
  );
}

const RELATION_TONE: Record<ContactRelation, string> = {
  admin: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  supervisor: "bg-gold/15 text-gold",
  teammate: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  professor: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  student: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
};

export function RelationChip({ relation }: { relation: ContactRelation }) {
  const { t } = useTranslation();
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${RELATION_TONE[relation]}`}>
      {t(`msg.relation.${relation}`)}
    </span>
  );
}

export function BroadcastChip({ tag, full }: { tag: string; full?: boolean }) {
  const { t } = useTranslation();
  const label = broadcastLabel(tag, t);
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10.5px] font-bold text-gold ${full ? "" : "max-w-56"}`}
      title={label}
    >
      <Megaphone size={11} className="shrink-0" />
      <span className="truncate">{full ? label : t("msg.broadcast")}</span>
    </span>
  );
}

/** Says whether messages are arriving live right now. */
export function LiveBadge() {
  const { t } = useTranslation();
  const live = useSocketStatus();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        live ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border-white/15 bg-cream/10 text-cream/70"
      }`}
      data-testid="messages-live"
      title={live ? t("msg.liveHint") : t("msg.offlineHint")}
    >
      {live ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
      ) : (
        <WifiOff size={12} />
      )}
      {live ? t("msg.live") : t("msg.offline")}
      {live && <Radio size={12} className="opacity-70" />}
    </span>
  );
}

export function EmptyPane({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid h-full min-h-72 place-items-center p-8 text-center">
      <div className="grid place-items-center gap-2.5">
        <span className="grid size-16 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
          <Icon size={26} />
        </span>
        <p className="text-[15px] font-bold text-forest">{title}</p>
        {hint && <p className="max-w-xs text-[12.5px] leading-relaxed text-clay">{hint}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}
