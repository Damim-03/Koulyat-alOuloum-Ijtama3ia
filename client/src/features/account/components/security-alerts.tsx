import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ShieldAlert } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useDates } from "../../../hooks/use-dates";
import { PATHS } from "../../../routes/paths";
import type { SecurityAlert } from "../../../types/account";
import { useAckSecurityAlert, useSecurityAlerts } from "../account.api";

/**
 * "A sign-in to your account from a new device" — at the top of every page of
 * the dashboard, on the account's other devices, until its owner answers:
 * it was me (the notice goes, everywhere), or it was not (to the devices list,
 * to sign that one out and change the password).
 *
 * One card however many there are: the newest in full, the others folded
 * beneath it — a week away from a shared lab must not bury the page.
 */
export function SecurityAlerts({ role }: { role: "admin" | "professor" | "student" }) {
  const { t } = useTranslation();
  const { localePath, currentLang } = useLanguage();
  const { fmtDate } = useDates();
  const { data } = useSecurityAlerts();
  const ack = useAckSecurityAlert();
  const [open, setOpen] = useState(false);
  if (!data?.length) return null;

  const text = (a: SecurityAlert) => a.i18n?.[currentLang] ?? { title: a.title, message: a.message };
  const [newest, ...older] = data;
  const many = older.length > 0;

  return (
    <div role="alert" className="mb-4 rounded-2xl border border-amber-400/45 bg-amber-500/8 p-4" data-testid="security-alerts">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <ShieldAlert size={19} />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-[13.5px] font-bold text-forest">{text(newest!).title}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-forest/80">{text(newest!).message}</p>
          <p className="mt-1 text-[11px] text-clay">{fmtDate(newest!.createdAt, true)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => ack.mutate(many ? "all" : newest!.id)}
            data-testid="security-alert-ack"
            className="inline-flex items-center gap-1.5 rounded-xl border border-forest/12 bg-cream-card px-3 py-2 text-[12px] font-semibold text-forest transition hover:bg-forest/5"
          >
            <Check size={14} /> {many ? t("account.alerts.allMe", { count: data.length }) : t("account.alerts.itWasMe")}
          </button>
          <Link
            to={`${localePath(`${PATHS[role].root}/account`)}?tab=security`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-amber-700"
          >
            {t("account.alerts.notMe")}
          </Link>
        </div>
      </div>

      {many && (
        <div className="mt-3 border-t border-amber-400/30 pt-2.5 ps-13">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-800 hover:text-amber-900 dark:text-amber-300"
          >
            <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
            {t("account.alerts.more", { count: older.length })}
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5">
              {older.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] text-forest/80">
                  <span className="min-w-0">{text(a).message.split(" — ")[0]}</span>
                  <span className="shrink-0 text-[11px] text-clay">{fmtDate(a.createdAt, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
