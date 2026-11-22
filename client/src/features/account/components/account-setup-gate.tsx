import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Check, ClipboardCheck, IdCard, KeyRound, LogOut, ShieldCheck, type LucideIcon } from "lucide-react";
import { useAuthStore } from "../../../store/auth.store";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { useMe } from "../../auth/hooks/use-me";
import { LoadingArea } from "../../../components/ui/loading-area";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { useMyAccount } from "../account.api";
import { PasswordForm } from "./password-form";
import { TwoFactorCard } from "./two-factor-card";
import { VerificationStep } from "./activation-screen";
import { ReviewStep } from "./activation-review";

/**
 * In front of every dashboard: an account that must first be put right shows
 * that, and nothing else, until it is done.
 *
 *  - A password the administration handed out (a birth date, one printed by
 *    an import) is known to others: its owner replaces it first.
 *  - A student doing so while activation is on goes through three stages:
 *    the password — which applies at once — then the photos of the card and
 *    the face that verify the account (Backend modules/activation), which
 *    they may skip, then a review of it all and of their account's details,
 *    confirmed to go in.
 *  - An administrator sets up two-step verification first.
 *
 * The server refuses everything else to such an account anyway (403, with the
 * reason as its code — the API client turns that into these flags), so this
 * screen is what the person sees instead of a page of errors.
 */
export function AccountSetupGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  // Fresh flags from the server — a reset by the administration shows here
  // on the next visit, without signing out.
  useMe();
  // Activation's later stages outlive its flag: the password chosen lifts it,
  // and the photos and the review still come next, on this same screen. Seen
  // as the flag drops while the screen is up — during render, so the
  // dashboard behind it never shows in between.
  const [after, setAfter] = useState<"photos" | "review" | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [wasActivating, setWasActivating] = useState(!!user?.activationRequired);
  if (!!user?.activationRequired !== wasActivating) {
    setWasActivating(!!user?.activationRequired);
    if (wasActivating && user && !user.mustChangePassword) setAfter("photos");
  }
  const kind = user && (user.activationRequired || after)
    ? "activation"
    : user?.mustChangePassword
      ? "password"
      : user?.twoFactorSetupRequired
        ? "twoFactor"
        : null;
  if (!kind) return <>{children}</>;
  return (
    <SetupScreen
      kind={kind}
      stage={after ?? "password"}
      skipped={skipped}
      onPhotosDone={(skip) => {
        setSkipped(skip);
        setAfter("review");
      }}
      onBackToPhotos={() => setAfter("photos")}
      onFinished={() => setAfter(null)}
      both={!!user?.mustChangePassword && user?.role === "admin" && user?.twoFactorEnabled === false}
    />
  );
}

type Kind = "activation" | "password" | "twoFactor";
type Stage = "password" | "photos" | "review";

const ICON: Record<Kind, LucideIcon> = { activation: IdCard, password: KeyRound, twoFactor: ShieldCheck };
const STAGE_ICON: Record<Stage, LucideIcon> = { password: KeyRound, photos: BadgeCheck, review: ClipboardCheck };
const STAGES: Stage[] = ["password", "photos", "review"];

function SetupScreen({
  kind,
  stage,
  skipped,
  onPhotosDone,
  onBackToPhotos,
  onFinished,
  both,
}: {
  kind: Kind;
  stage: Stage;
  skipped: boolean;
  onPhotosDone: (skipped: boolean) => void;
  onBackToPhotos: () => void;
  onFinished: () => void;
  both: boolean;
}) {
  const { t } = useTranslation();
  const { dir } = useLanguage();
  const { logout } = useAuth();
  const activation = kind === "activation";
  const Icon = activation ? STAGE_ICON[stage] : ICON[kind];
  // The activation's stages each say what they are; the other screens, what they ask.
  const texts = activation ? `account.gate.activation.${stage}` : `account.gate.${kind}`;
  const eyebrow = activation
    ? t("account.gate.stepOf", { n: STAGES.indexOf(stage) + 1, total: STAGES.length })
    : both
      ? t("account.gate.stepOf", { n: kind === "password" ? 1 : 2, total: 2 })
      : t("account.gate.eyebrow");

  return (
    <div dir={dir} className="min-h-svh bg-cream px-4 py-8 font-body sm:py-12" data-testid={`setup-gate-${kind}`}>
      <div className="mx-auto max-w-3xl">
        {activation && <ActivationSteps stage={stage} skipped={skipped} />}

        <header className="mb-6 flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-forest to-forest-deep text-gold-soft shadow-[0_10px_24px_-12px_rgba(22,36,31,0.8)]">
            <Icon size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold tracking-wide text-gold">{eyebrow}</p>
            <h1 className="font-serif text-[22px] leading-tight font-bold text-forest sm:text-[26px]">{t(`${texts}.title`)}</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-clay">{t(`${texts}.body`)}</p>
          </div>
        </header>

        <div className="rounded-3xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-7">
          {activation && stage === "photos" ? (
            <VerificationStep onDone={onPhotosDone} />
          ) : activation && stage === "review" ? (
            <ReviewStep onVerifyNow={onBackToPhotos} onConfirm={onFinished} />
          ) : (
            <AccountStep kind={kind === "twoFactor" ? "twoFactor" : "password"} />
          )}
        </div>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            <LogOut size={15} className="rtl:rotate-180" />
            {t("common.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Where the student is in the activation: the password, the photos (which may be skipped), the review. */
function ActivationSteps({ stage, skipped }: { stage: Stage; skipped: boolean }) {
  const { t } = useTranslation();
  const at = STAGES.indexOf(stage);
  return (
    <ol className="mb-6 flex items-center gap-2 sm:gap-3" data-testid="activation-steps">
      {STAGES.map((s, i) => {
        const passed = i < at;
        const state = passed ? (s === "photos" && skipped ? "skipped" : "done") : i === at ? "current" : "next";
        const StepIcon = state === "done" ? Check : STAGE_ICON[s];
        const hint = s === "photos" ? t(state === "skipped" ? "account.gate.activation.steps.skipped" : "account.gate.activation.steps.optional") : undefined;
        return (
          <li
            key={s}
            // A phone has no room for three labels beside their icons: each goes under its own.
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-3 sm:text-start"
            aria-current={state === "current" ? "step" : undefined}
            data-state={state}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-2xl transition ${
                state === "done"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : state === "skipped"
                    ? "bg-amber-500/12 text-amber-600 dark:text-amber-300"
                    : state === "current"
                      ? "bg-linear-to-br from-gold to-gold-soft text-[#1a312d] shadow-[0_8px_20px_-8px_rgba(193,150,90,0.9)]"
                      : "bg-forest/[0.06] text-forest/45"
              }`}
            >
              <StepIcon size={18} />
            </span>
            <span className="min-w-0">
              <span
                className={`block text-[12.5px] leading-tight font-bold sm:truncate sm:text-[13px] ${state === "current" ? "text-forest" : state === "next" ? "text-forest/50" : "text-forest/80"}`}
              >
                {t(`account.gate.activation.steps.${s}`)}
              </span>
              {hint && <span className="mt-0.5 block text-[11px] leading-tight text-clay sm:truncate">{hint}</span>}
            </span>
            {i < STAGES.length - 1 && <span aria-hidden className={`hidden h-px min-w-4 flex-1 sm:block ${passed ? "bg-emerald-500/40" : "bg-forest/12"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** The steps that work on the account itself: they read it first. */
function AccountStep({ kind }: { kind: "password" | "twoFactor" }) {
  const q = useMyAccount();
  if (q.isLoading) return <LoadingArea className="py-16" />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => q.refetch()} />;
  return kind === "password" ? <PasswordForm a={q.data} compact /> : <TwoFactorCard a={q.data} gate />;
}
