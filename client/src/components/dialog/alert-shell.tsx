import { useEffect, useId, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBodyScrollLock } from "../../hooks/use-body-scroll-lock";

/**
 * إطار التنبيهات في المنصّة كلّها — التأكيد والحذف والنجاح وانتهاء الجلسة.
 *
 * نافذةٌ واحدة الشكل لكلّ ما يستوقف المستعمل، فيعرف من النظرة الأولى ما
 * هو أمامه قبل أن يقرأ: **لونٌ** لكلّ نبرة (خطرٌ أحمر، تنبيهٌ ذهبيّ، معلومةٌ
 * خضراء، نجاحٌ بلون المريمية)، و**شعارٌ** كبيرٌ بأيقونة الفعل نفسه (سلّة
 * الحذف، علامة الرفض…)، و**عنوانٌ** واضح فوقه سطرٌ صغير يسمّي نوع الموقف.
 *
 * وما بين «…» في الرسالة — اسمُ ما يُحذف أو يُرفض — يُبرز بلون النبرة،
 * والأرقام تُكتب عريضة: فلا يُقرأ «حذف التخصص» دون أن يُرى أيّ تخصّص.
 */

export type AlertTone = "danger" | "warning" | "info" | "success";

const TONE: Record<
  AlertTone,
  {
    halo: string;
    /** الجوهرة: تدرّجٌ شعاعيّ يبدأ من أعلى يسارها، كضوءٍ يقع عليها. */
    emblem: string;
    /** الوهج خلف الوسام. */
    glow: string;
    /** الحلقة المنقّطة حول الجوهرة. */
    dash: string;
    pulse: string;
    kicker: string;
    chip: string;
    line: string;
    button: string;
  }
> = {
  danger: {
    halo: "from-brick/18 via-brick/6",
    emblem: "from-[#ee9476] via-[#c4502f] to-[#7a2414] text-white shadow-[0_18px_38px_-10px_rgba(168,68,45,0.8)]",
    glow: "bg-brick/40",
    dash: "border-brick/30",
    pulse: "bg-brick/25",
    kicker: "text-brick",
    chip: "bg-brick/10 text-brick ring-brick/25",
    line: "via-brick/45",
    button:
      "bg-linear-to-b from-[#c8573c] to-[#952f1b] text-white shadow-[0_12px_26px_-10px_rgba(168,68,45,0.95)] hover:brightness-110",
  },
  warning: {
    halo: "from-gold/22 via-gold/7",
    emblem: "from-[#f3d9a8] via-gold-soft to-[#a3753a] text-[var(--t-brand-deep)] shadow-[0_18px_38px_-10px_rgba(193,150,90,0.85)]",
    glow: "bg-gold/45",
    dash: "border-gold/40",
    pulse: "bg-gold/30",
    kicker: "text-gold",
    chip: "bg-gold/12 text-forest ring-gold/35",
    line: "via-gold/60",
    button:
      "bg-linear-to-b from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_12px_26px_-10px_rgba(193,150,90,0.9)] hover:brightness-105",
  },
  info: {
    halo: "from-sage/16 via-gold/6",
    emblem: "from-[#5c8b7f] via-[#2e5048] to-[#13241f] text-[#f5edda] shadow-[0_18px_38px_-10px_rgba(26,49,45,0.75)]",
    glow: "bg-sage/35",
    dash: "border-sage/35",
    pulse: "bg-sage/25",
    kicker: "text-sage",
    chip: "bg-sage/10 text-forest ring-sage/30",
    line: "via-gold/60",
    button:
      "bg-linear-to-b from-[#34574e] to-[#1a312d] text-[#f5edda] shadow-[0_12px_26px_-10px_rgba(26,49,45,0.9)] hover:brightness-115",
  },
  success: {
    halo: "from-sage/22 via-sage/7",
    emblem: "from-[#9ccbbd] via-[#5b8d80] to-[#2f5449] text-white shadow-[0_18px_38px_-10px_rgba(74,112,102,0.85)]",
    glow: "bg-sage/45",
    dash: "border-sage/40",
    pulse: "bg-sage/30",
    kicker: "text-sage",
    chip: "bg-sage/12 text-forest ring-sage/30",
    line: "via-sage/55",
    button:
      "bg-linear-to-b from-[#5b8d80] to-[#3d6b5f] text-white shadow-[0_12px_26px_-10px_rgba(74,112,102,0.9)] hover:brightness-110",
  },
};

/** الرسالة بما بين «…» مبرَزاً بلون النبرة، والأرقام عريضة. */
function Highlighted({ text, tone }: { text: string; tone: AlertTone }) {
  return (
    <>
      {text.split(/(«[^»]+»)/g).map((part, i) =>
        part.startsWith("«") && part.endsWith("»") ? (
          <b
            key={i}
            dir="auto"
            className={`mx-0.5 inline-block rounded-lg px-2 py-px font-bold ring-1 ring-inset ${TONE[tone].chip}`}
          >
            {part.slice(1, -1)}
          </b>
        ) : (
          part.split(/(\d+)/g).map((bit, j) =>
            /^\d+$/.test(bit) ? (
              <b key={`${i}-${j}`} className="font-serif font-bold text-forest tabular-nums">
                {bit}
              </b>
            ) : (
              bit
            ),
          )
        ),
      )}
    </>
  );
}

/**
 * شعار النبرة: وسامٌ مستدير.
 *
 * في قلبه **جوهرةٌ** بلون النبرة عليها أيقونة الفعل، يقع عليها ضوءٌ من أعلى
 * (لمعةٌ زجاجية وظلٌّ داخليّ في أسفلها)، وحولها حلقةٌ منقّطة، ثمّ قرصٌ هادئ،
 * ثمّ **حلقةٌ ذهبية** يدور عليها بريقٌ ببطء — ذهبُ المنصّة نفسه في كلّ نبرة،
 * فاللون يقول نوع الموقف والذهب يقول إنّه من المنصّة. ومن خلفه وهجٌ ونبضٌ
 * هادئان. والدوران والنبض يقفان لمن طلب تقليل الحركة.
 */
function Emblem({ icon: Icon, tone }: { icon: LucideIcon; tone: AlertTone }) {
  const t = TONE[tone];
  return (
    <div aria-hidden className="relative mx-auto grid size-28 place-items-center">
      <span className={`absolute inset-4 rounded-full blur-2xl ${t.glow}`} />
      <span className={`animate-halo absolute inset-3 rounded-full ${t.pulse}`} />

      <span className="absolute inset-0 rounded-full ring-1 ring-gold/25" />
      <span className="animate-orbit absolute inset-0">
        <span className="emblem-arc absolute inset-0 rounded-full" />
        <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-soft shadow-[0_0_10px_3px_rgba(212,175,117,0.75)]" />
      </span>

      <span className="absolute inset-2.5 rounded-full bg-cream-card/80 ring-1 ring-gold/15" />
      <span className={`absolute inset-4 rounded-full border border-dashed ${t.dash}`} />

      <span
        className={`relative grid size-16 place-items-center overflow-hidden rounded-full bg-radial-[at_32%_24%] ring-1 ring-white/25 ${t.emblem}`}
      >
        <span className="absolute inset-x-4 top-1.5 h-5 rounded-full bg-linear-to-b from-white/35 to-transparent" />
        <span className="absolute inset-0 rounded-full shadow-[inset_0_-7px_14px_rgba(0,0,0,0.28)]" />
        <Icon size={28} strokeWidth={2.1} className="relative drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]" />
      </span>
    </div>
  );
}

/**
 * زرّ التنبيه: «أساسيّ» بلون النبرة — ويدور حين يعمل — أو «ثانويّ» هادئ.
 * والزرّان بعرضٍ واحد، فلا يبدو أحدهما أهمّ لأنّ نصّه أطول.
 */
export function AlertAction({
  children,
  onClick,
  tone = "info",
  variant = "primary",
  icon: Icon,
  loading = false,
  disabled = false,
  title,
  ref,
  testid,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: AlertTone;
  variant?: "primary" | "ghost";
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  ref?: Ref<HTMLButtonElement>;
  testid?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      data-testid={testid}
      className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold transition outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === "primary"
          ? `${TONE[tone].button} focus-visible:ring-gold/40 active:translate-y-px`
          : "border border-forest/15 bg-cream-card text-forest hover:border-forest/30 hover:bg-forest/5 focus-visible:ring-forest/15"
      }`}
    >
      {loading ? <Loader2 size={17} className="animate-spin" /> : Icon && <Icon size={17} />}
      {children}
    </button>
  );
}

/**
 * النافذة نفسها. `onClose` غائبٌ ⇒ لا تُغلق إلّا بفعلها (انتهاء الجلسة).
 * و`busy` يمنع الإغلاق والزرّين ما دام الطلب جارياً.
 */
export function AlertShell({
  open,
  tone,
  icon,
  kicker,
  title,
  message,
  children,
  actions,
  onClose,
  busy = false,
  size = "md",
  footnote,
  top = false,
}: {
  open: boolean;
  tone: AlertTone;
  icon: LucideIcon;
  /** سطرٌ صغير فوق العنوان يسمّي نوع الموقف. */
  kicker?: string;
  title: string;
  message?: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
  busy?: boolean;
  /** md: تأكيدٌ ورسالة · lg: نافذةٌ فيها تفاصيل تُمرَّر. */
  size?: "md" | "lg";
  /** سطرٌ تحت الأزرار — عدٌّ تنازليّ مثلاً. */
  footnote?: ReactNode;
  /** فوق كلّ نافذةٍ أخرى — لما يوقف العمل كلّه (انتهاء الجلسة). */
  top?: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const tn = TONE[tone];
  const close = () => !busy && onClose?.();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 grid place-items-center p-4 font-body ${top ? "z-100" : "z-70"}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={message ? bodyId : undefined}
    >
      <div
        onClick={close}
        className="absolute inset-0 animate-[fadeIn_0.2s_ease-out] bg-[#08110f]/70 backdrop-blur-md"
      />

      <div
        className={`animate-scale-in relative flex w-full flex-col overflow-hidden rounded-[28px] border border-gold/25 bg-cream-card shadow-[0_50px_120px_-30px_rgba(4,10,8,0.85)] ring-1 ring-black/5 ${
          size === "lg" ? "max-h-[92dvh] max-w-2xl" : "max-w-[460px]"
        }`}
      >
        {/* الهالة: لون النبرة يذوب من أعلى النافذة */}
        <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-52 bg-linear-to-b ${tn.halo} to-transparent`} />
        <div
          aria-hidden
          className="dot-matrix pointer-events-none absolute inset-x-0 top-0 h-48 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-l from-gold via-gold-soft to-gold" />

        {onClose && (
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label={t("alert.close")}
            className="absolute end-4 top-4 z-10 grid size-9 place-items-center rounded-xl text-clay ring-1 ring-forest/10 transition hover:bg-forest/5 hover:text-forest disabled:opacity-40"
          >
            <X size={17} />
          </button>
        )}

        <div className="relative shrink-0 px-7 pt-8 text-center">
          <Emblem icon={icon} tone={tone} />
          {kicker && (
            <p className={`mt-3 text-[11px] font-bold tracking-[0.18em] ${tn.kicker}`}>{kicker}</p>
          )}
          <h3 id={titleId} className="mt-1.5 font-serif text-[22px] leading-snug font-bold text-forest">
            {title}
          </h3>
          <div aria-hidden className={`mx-auto mt-4 h-px w-28 bg-linear-to-l from-transparent ${tn.line} to-transparent`} />
          {message && (
            <p id={bodyId} className="mx-auto mt-4 max-w-sm text-[15px] leading-[1.95] text-forest/80">
              {typeof message === "string" ? <Highlighted text={message} tone={tone} /> : message}
            </p>
          )}
        </div>

        {children && (
          <div className={`relative px-7 pt-5 text-start ${size === "lg" ? "min-h-0 flex-1 overflow-y-auto pb-2" : ""}`}>
            {children}
          </div>
        )}

        <div className="relative mt-6 shrink-0 border-t border-forest/8 bg-cream-2/60 px-7 py-5">
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">{actions}</div>
          {footnote && <div className="mt-3 text-center text-[11.5px] text-clay">{footnote}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
