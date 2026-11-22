import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hash,
  Info,
  KeyRound,
  Mail,
  SkipForward,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { LoadingArea } from "../../../components/ui/loading-area";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { personName, otherScriptName } from "../../../lib/person-name";
import { useMyAccount, useMyActivationRequest } from "../account.api";

type Verification = "verified" | "pending" | "skipped";

/**
 * The third and last stage of a student's first sign-in: what they did — the
 * password, and the photos sent or skipped (with a way back to them) — and
 * their account as the administration registered it, to look over before
 * going in. Something wrong there is the administration's to correct: the
 * student is told so, not given a form.
 */
export function ReviewStep({ onVerifyNow, onConfirm }: { onVerifyNow: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  const account = useMyAccount();
  const request = useMyActivationRequest();
  if (account.isLoading || request.isLoading) return <LoadingArea className="py-16" />;
  if (account.isError || !account.data) return <ErrorRetry onRetry={() => account.refetch()} />;

  const a = account.data;
  const s = a.student;
  const verification: Verification = a.isVerified ? "verified" : request.data?.status === "pending" ? "pending" : "skipped";
  const latin = otherScriptName(a);
  const spec = s?.specialization;
  const place = [spec?.filiere?.department?.faculty?.name, spec?.filiere?.department?.name].filter(Boolean).join(" · ");

  return (
    <div data-testid="activation-review">
      <ul className="space-y-2.5" data-testid="activation-review-summary">
        <Done icon={KeyRound} tone="ok" title={t("account.gate.activation.review.password")}>
          {t("account.gate.activation.review.passwordDone")}
        </Done>
        <Done
          icon={verification === "skipped" ? SkipForward : verification === "pending" ? Clock : BadgeCheck}
          tone={verification === "verified" ? "ok" : verification === "pending" ? "wait" : "skip"}
          title={t("account.gate.activation.review.verification")}
          action={
            verification === "skipped" && (
              <button
                type="button"
                onClick={onVerifyNow}
                data-testid="activation-verify-now"
                className="shrink-0 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] font-bold text-forest transition hover:bg-gold/20"
              >
                {t("account.gate.activation.review.verifyNow")}
              </button>
            )
          }
        >
          <span data-testid="activation-review-verification" data-state={verification}>
            {t(`account.gate.activation.review.state.${verification}`)}
          </span>
        </Done>
      </ul>

      <section className="mt-6">
        <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-forest">
          <UserRound size={16} className="text-gold" />
          {t("account.gate.activation.review.details")}
        </h3>
        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" data-testid="activation-review-details">
          <Field icon={UserRound} label={t("account.gate.activation.review.fields.name")}>
            <bdi>{personName(a)}</bdi>
            {latin && (
              <bdi dir="auto" className="block text-[11.5px] font-medium text-clay">
                {latin}
              </bdi>
            )}
          </Field>
          {s && (
            <Field icon={Hash} label={t("account.gate.activation.review.fields.registration")}>
              <bdi dir="ltr" className="font-mono">
                {s.registrationNumber}
              </bdi>
            </Field>
          )}
          <Field icon={Mail} label={t("account.gate.activation.review.fields.email")}>
            {a.email ? <bdi dir="ltr">{a.email}</bdi> : <span className="text-clay">{t("account.gate.activation.review.none")}</span>}
          </Field>
          {spec && (
            <Field icon={BookOpen} label={t("account.gate.activation.review.fields.specialization")}>
              {spec.name} · {t(`admin.proj.level.${spec.level}`, { defaultValue: spec.level })}
            </Field>
          )}
          {place && (
            <Field icon={Building2} label={t("account.gate.activation.review.fields.place")}>
              {place}
            </Field>
          )}
          {s?.academicYear && (
            <Field icon={CalendarDays} label={t("account.gate.activation.review.fields.year")}>
              {s.academicYear.title}
            </Field>
          )}
        </dl>
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-forest/5 px-3 py-2.5 text-[12px] leading-relaxed text-forest/80">
          <Info size={14} className="mt-0.5 shrink-0 text-gold" />
          {t("account.gate.activation.review.wrong")}
        </p>
      </section>

      <button
        type="button"
        onClick={onConfirm}
        data-testid="activation-confirm"
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-br from-forest-soft to-forest p-3.5 text-[14.5px] font-bold text-cream shadow-[0_10px_24px_rgba(38,66,61,0.30)] ring-1 ring-inset ring-gold/15 transition hover:-translate-y-px"
      >
        <CheckCircle2 size={17} className="text-gold-soft" />
        {t("account.gate.activation.review.confirm")}
        <ArrowLeft size={16} className="ltr:rotate-180" />
      </button>
    </div>
  );
}

const TONE: Record<"ok" | "wait" | "skip", string> = {
  ok: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  wait: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  skip: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
};

function Done({
  icon: Icon,
  tone,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONE;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-2/60 p-3.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-forest">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-clay">{children}</span>
      </span>
      {action}
    </li>
  );
}

function Field({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-forest/8 px-3 py-2.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-gold" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold text-clay">{label}</dt>
        <dd className="mt-0.5 break-words text-[13px] font-bold text-forest">{children}</dd>
      </div>
    </div>
  );
}
