import { useTranslation } from "react-i18next";
import { AlertTriangle, BadgeCheck, Loader2, Mail, MailX, Send } from "lucide-react";
import type { MyAccount } from "../../../types/account";
import { useRequestEmailVerification } from "../account.api";

/**
 * The address that can reset this account's password, and where security
 * alerts go — once its owner proved it theirs (Backend modules/auth/email-
 * links): the account's own address, confirmed by opening a link sent to it;
 * a professor's university address until they confirm one of their own.
 */
export function RecoveryEmailCard({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const send = useRequestEmailVerification();
  const address = a.recoveryEmail ?? a.email;
  const verified = !!a.recoveryEmail;
  // An address of its own still waiting for its link — beside a professor's university one, which works already.
  const ownPending = !!a.email && !a.emailVerified;
  const pendingBeside = !!a.mailEnabled && verified && ownPending;

  const state = !a.mailEnabled
    ? { icon: MailX, tone: "bg-forest/8 text-clay", title: t("admin.account.recovery.off"), hint: t("admin.account.recovery.offHint") }
    : !address
      ? { icon: MailX, tone: "bg-amber-500/12 text-amber-600 dark:text-amber-300", title: t("admin.account.recovery.none"), hint: t(`admin.account.recovery.noneHint_${a.role === "admin" ? "admin" : "other"}`) }
      : verified
        ? { icon: BadgeCheck, tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300", title: t("admin.account.recovery.verified"), hint: t("admin.account.recovery.verifiedHint") }
        : { icon: AlertTriangle, tone: "bg-amber-500/12 text-amber-600 dark:text-amber-300", title: t("admin.account.recovery.unverified"), hint: t("admin.account.recovery.unverifiedHint") };

  return (
    <div className="rounded-3xl border border-forest/10 bg-cream-card p-5" data-testid="recovery-email" data-verified={verified || undefined}>
      <div className="flex flex-wrap items-center gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${state.tone}`}>
          <state.icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11.5px] text-clay">
            <Mail size={13} className="text-gold" />
            {t("admin.account.recovery.label")}
          </p>
          {address && (
            <p dir="ltr" className="truncate text-start text-[14px] font-bold text-forest">
              {address}
            </p>
          )}
          <p className="mt-0.5 text-[12.5px] font-semibold text-forest">{state.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-clay">{state.hint}</p>
        </div>
        {a.mailEnabled && address && !verified && <SendLink send={send} />}
      </div>

      {pendingBeside && (
        <div
          data-testid="recovery-own-pending"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3"
        >
          <AlertTriangle size={17} className="shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-forest">
              {t("admin.account.recovery.ownPending")}{" "}
              <bdi dir="ltr" className="font-bold">
                {a.email}
              </bdi>
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-clay">{t("admin.account.recovery.ownPendingHint")}</p>
          </div>
          <SendLink send={send} />
        </div>
      )}
    </div>
  );
}

function SendLink({ send }: { send: ReturnType<typeof useRequestEmailVerification> }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => send.mutate()}
      disabled={send.isPending || send.isSuccess}
      data-testid="recovery-send"
      className="inline-flex items-center gap-2 rounded-2xl bg-gold px-5 py-3 text-sm font-bold text-forest-deep shadow-md transition hover:bg-gold-soft disabled:opacity-60"
    >
      {send.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} className="rtl:-scale-x-100" />}
      {send.isSuccess ? t("admin.account.recovery.sent") : t("admin.account.recovery.send")}
    </button>
  );
}
