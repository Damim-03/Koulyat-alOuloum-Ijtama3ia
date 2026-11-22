import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import universityLogo from "../../../assets/university-logo.png";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import { cn } from "../../../lib/utils";
import { useLoginTexts } from "../hooks/use-login-texts";

/**
 * The frame of the pages a forgotten password goes through — asking
 * (/forgot-password), the waiting and the answer of a request to the
 * administration, the link's page (/reset-password) and the address's
 * (/verify-email) — with what they share: the gold button, the notices, and
 * the steps of the road back into the account.
 */

export type Tone = "gold" | "ok" | "warn";

const MEDAL: Record<Tone, { disc: string; halo: string }> = {
  gold: { disc: "from-gold/30 to-gold/5 text-gold ring-gold/50", halo: "bg-gold/25" },
  ok: {
    disc: "from-emerald-500/25 to-emerald-500/5 text-emerald-600 ring-emerald-500/40 dark:text-emerald-300",
    halo: "bg-emerald-500/20",
  },
  warn: {
    disc: "from-amber-500/25 to-amber-500/5 text-amber-600 ring-amber-500/40 dark:text-amber-300",
    halo: "bg-amber-500/20",
  },
};

/** The university's seal on a light tile in a gold frame — large on the brand panel, small in the narrow header. */
export function Seal({ big }: { big?: boolean }) {
  return (
    <div className={cn("relative shrink-0", big ? "size-24" : "size-12")}>
      <div className={cn("pointer-events-none absolute rounded-full bg-gold/20 blur-2xl", big ? "-inset-8" : "-inset-3")} />
      <div className={cn("pointer-events-none absolute border border-gold/40", big ? "-inset-2.5 rounded-[1.9rem]" : "-inset-1 rounded-[1.05rem]")} />
      <div
        className={cn(
          "logo-shine relative grid size-full place-items-center overflow-hidden bg-[#fbf6ea] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.5)] ring-1 ring-gold/70",
          big ? "rounded-[1.5rem] p-2.5" : "rounded-[0.85rem] p-1",
        )}
      >
        <img src={universityLogo} alt="" className="size-full object-contain" draggable={false} />
      </div>
    </div>
  );
}

/**
 * The frame of the three pages, built to fit one screen. On a wide screen the
 * card is two panels: the brand green at the start (the university's seal,
 * its name, and the steps of the recovery) and the form at the end. Below
 * that, one column: the seal shrinks into a row atop the card, and the steps
 * become a band at its foot. A page whose form is laid out in two columns
 * (the photo of the card beside the rest) asks for a wider card — from a
 * tablet's width up, with a narrower green panel until the screen is wide.
 * On a short window the spacing tightens, so the card still fits.
 */
export function Shell({
  icon: Icon,
  tone = "gold",
  title,
  subtitle,
  children,
  step,
  road = "email",
  wide,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Where the page stands on the road to a new password, when it is on it. */
  step?: 0 | 1 | 2;
  /** Which road: the link by email, or a request to the administration. */
  road?: Road;
  /** A wider card on a wide screen, for a form in two columns. */
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const { texts, ready } = useLoginTexts();
  const medal = MEDAL[tone];
  const hide = ready ? "" : "invisible";
  const backLink = (cls: string) => (
    <Link
      to={localePath(PATHS.login)}
      className={cn("group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-semibold transition", cls)}
    >
      <ArrowRight size={14} className="text-gold transition-transform ltr:rotate-180 rtl:group-hover:translate-x-0.5 ltr:group-hover:-translate-x-0.5" />
      {t("auth.recover.backToLogin")}
    </Link>
  );
  return (
    <div className="auth-bg relative isolate grid min-h-svh place-items-center overflow-hidden px-4 py-5 text-forest sm:px-6 sm:py-8 short:py-4">
      {/* الأجواء: حلقاتٌ ذهبيّة كختم الجامعة خلف البطاقة، وضوءٌ دافئ من الأعلى */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="gold-rings absolute left-1/2 top-1/2 size-[64rem] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute -top-48 left-1/2 h-96 w-[44rem] max-w-full -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />
      </div>

      <div className={cn("w-full max-w-120", wide ? "md:max-w-[46rem] lg:max-w-[70rem]" : "lg:max-w-[57rem]")}>
        {/* البطاقة: حافّةٌ ذهبيّة رفيعة (الغلاف ذو البكسل الواحد) حول سطحٍ مرتفع */}
        <div className="relative rounded-[28px] bg-linear-to-b from-gold/55 via-gold/10 to-forest/10 p-px shadow-[0_40px_90px_-30px_rgba(26,49,45,0.5)] animate-[fadeUp_0.6s_both]">
          <div
            className={cn(
              "relative overflow-hidden rounded-[27px] bg-cream-card lg:grid",
              wide ? "lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]" : "lg:grid-cols-[21rem_minmax(0,1fr)]",
            )}
          >
            {/* اللوحة الخضراء — الشاشات الواسعة وحدها */}
            <aside className="forest-glow relative hidden flex-col overflow-hidden px-8 py-9 text-cream lg:flex short:py-7">
              <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
              <div aria-hidden className="pointer-events-none absolute -end-28 -top-28 size-72 rounded-full border border-gold/15" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 -start-20 size-64 rounded-full border border-soft-sage/20 bg-soft-sage/[0.04]" />

              <div className={cn("relative flex flex-1 flex-col", step === undefined && "justify-center")}>
                <div className="flex flex-col items-center text-center">
                  <Seal big />
                  <div className={cn("mt-6", hide)}>
                    <div dir="auto" className="font-display text-[20px] font-bold leading-snug text-cream">
                      {texts.university}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2 text-[12.5px] font-semibold tracking-wide text-gold-soft">
                      <span className="h-px w-7 bg-linear-to-r from-transparent via-gold/70 to-transparent" />
                      <span className="size-1.5 rotate-45 bg-gold" />
                      <span dir="auto">{texts.platform}</span>
                      <span className="size-1.5 rotate-45 bg-gold" />
                      <span className="h-px w-7 bg-linear-to-r from-transparent via-gold/70 to-transparent" />
                    </div>
                  </div>
                </div>
                {step !== undefined && (
                  <>
                    <div aria-hidden className="my-7 h-px bg-linear-to-r from-transparent via-gold/35 to-transparent" />
                    <RecoverSteps current={step} road={road} vertical />
                  </>
                )}
              </div>

              <div className="relative mt-7 flex justify-center">
                {backLink("border-gold/25 bg-cream/5 text-cream/75 hover:border-gold/55 hover:text-cream")}
              </div>
            </aside>

            {/* لوحة النموذج */}
            <div className="relative flex flex-col">
              <div aria-hidden className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold to-transparent" />
              <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-52 w-80 -translate-x-1/2 rounded-full bg-gold/12 blur-3xl" />

              <div
                className={cn(
                  "relative flex flex-1 flex-col justify-center px-6 pb-6 pt-6 sm:px-9 lg:py-10 short:lg:py-7",
                  wide ? "lg:px-9 xl:px-11" : "lg:px-11",
                )}
              >
                {/* الختم واسم الجامعة في صفّ — حين تغيب اللوحة الخضراء */}
                <div className="mb-5 flex items-center justify-center gap-3.5 lg:hidden short:mb-3">
                  <Seal />
                  <div className={cn("min-w-0 text-start", hide)}>
                    <div dir="auto" className="font-display text-[15px] font-bold leading-snug text-forest">
                      {texts.university}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-gold">
                      <span className="size-1.5 shrink-0 rotate-45 bg-gold" />
                      <span dir="auto">{texts.platform}</span>
                    </div>
                  </div>
                </div>

                <div className="relative mx-auto mb-4 grid size-15 place-items-center lg:size-16 short:mb-3 short:size-13">
                  <div className={`pointer-events-none absolute -inset-3 rounded-full blur-xl ${medal.halo}`} />
                  <div className="pointer-events-none absolute -inset-1.5 rounded-full border border-gold/25" />
                  <div
                    className={`relative grid size-full place-items-center rounded-full bg-linear-to-b ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_26px_-12px_rgba(26,49,45,0.45)] ${medal.disc}`}
                  >
                    <Icon size={26} strokeWidth={1.75} />
                  </div>
                </div>
                <h1 className="m-0 text-center font-display text-[25px] font-bold leading-tight text-forest sm:text-[28px] short:text-[24px]">{title}</h1>
                {subtitle && (
                  <p key={subtitle} className="mx-auto mt-2 max-w-sm text-center text-[13px] leading-[1.75] text-clay animate-[fadeIn_0.35s_both]">
                    {subtitle}
                  </p>
                )}
                <div className="mt-6 short:mt-4">{children}</div>
              </div>

              {step !== undefined && (
                <div className="relative border-t border-forest/8 bg-cream-2/70 px-6 py-4 sm:px-9 lg:hidden">
                  <RecoverSteps current={step} road={road} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center lg:hidden">
          {backLink("border-forest/10 bg-cream-card/70 text-clay shadow-sm backdrop-blur-sm hover:border-gold/45 hover:text-forest")}
        </div>
      </div>
    </div>
  );
}

export const primaryBtn =
  "btn-sheen flex h-12.5 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-linear-to-b from-gold-soft to-gold text-[15px] font-bold text-forest-deep shadow-[0_14px_30px_-12px_rgba(193,150,90,0.75),inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-inset ring-black/5 transition hover:-translate-y-px hover:shadow-[0_18px_36px_-12px_rgba(193,150,90,0.9),inset_0_1px_0_rgba(255,255,255,0.45)] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none";
export const inputCls =
  "h-12 w-full rounded-xl border border-forest/15 bg-cream-2 px-3.5 text-[14.5px] text-forest outline-none transition focus:border-gold/70 focus:bg-cream-card focus:ring-4 focus:ring-gold/15";

export function Notice({ tone, children, testId }: { tone: "error" | "ok"; children: ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className={`rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
        tone === "error"
          ? "bg-red-500/8 text-red-700 ring-1 ring-red-400/25 dark:text-red-300"
          : "bg-emerald-500/8 text-emerald-800 ring-1 ring-emerald-400/25 dark:text-emerald-200"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * The road from a forgotten password to a new one; `current` is where the page
 * stands. Upright on the brand panel, across the card's foot otherwise.
 */
export type Road = "email" | "admin";

const STEPS: Record<Road, string[]> = {
  email: ["auth.recover.stepWrite", "auth.recover.stepOpen", "auth.recover.stepChoose"],
  admin: ["auth.recover.stepWrite", "auth.recover.stepWait", "auth.recover.stepCopy"],
};

export function RecoverSteps({ current, road = "email", vertical }: { current: 0 | 1 | 2; road?: Road; vertical?: boolean }) {
  const { t } = useTranslation();
  const steps = STEPS[road];
  if (vertical)
    return (
      <ol className="relative mx-auto my-0 w-fit list-none space-y-4 p-0">
        <span aria-hidden className="absolute bottom-4 start-4 top-4 w-px bg-linear-to-b from-gold/60 via-gold/30 to-gold/10" />
        {steps.map((k, i) => {
          const done = i < current;
          const here = i === current;
          return (
            <li key={k} aria-current={here ? "step" : undefined} className="relative flex items-center gap-3.5">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ring-1",
                  done || here ? "bg-gold text-forest-deep ring-gold" : "bg-forest-deep text-gold-soft ring-gold/35",
                  here && "shadow-[0_0_0_5px_color-mix(in_oklab,var(--t-gold)_20%,transparent)]",
                )}
              >
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-[14px] leading-snug", here ? "font-semibold text-cream" : done ? "text-cream/70" : "text-cream/50")}>
                {t(k)}
              </span>
            </li>
          );
        })}
      </ol>
    );
  return (
    <ol className="relative m-0 grid list-none grid-cols-3 gap-2 p-0">
      <span aria-hidden className="absolute inset-x-[17%] top-3.5 h-px bg-linear-to-r from-gold/15 via-gold/50 to-gold/15" />
      {steps.map((k, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <li key={k} aria-current={here ? "step" : undefined} className="relative flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-[12.5px] font-bold ring-1 transition",
                done || here ? "bg-gold text-forest-deep ring-gold" : "bg-cream-card text-gold ring-gold/40",
                here && "shadow-[0_0_0_4px_color-mix(in_oklab,var(--t-gold)_18%,transparent)]",
              )}
            >
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("text-[11px] leading-snug", here ? "font-semibold text-forest" : "font-medium text-clay")}>{t(k)}</span>
          </li>
        );
      })}
    </ol>
  );
}
