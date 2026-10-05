import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CloudOff,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Unplug,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { checkConnection, useConnection } from "../../lib/connection/connection";
import { secondsUntil, useNow } from "../../hooks/use-now";

/**
 * تعذّرَ الجلب — ومعه زرُّ إعادة المحاولة.
 *
 * وسببُ وجودها أنّ الشاشات كانت تعرض «لا يوجد طلاب» حين ينقطع الاتّصال:
 * الجلبُ يفشل، و`isLoading` يصير `false`، فيصدق شرطُ `length === 0` — لأنّ
 * القائمة لم تصل لا لأنّها فارغة. فيقرأ المسؤول أنّ القاعدة خالية وهي عامرة.
 *
 * ولغتُها لغةُ من يقرؤها لا لغةُ من كتبها: تقول **ما جرى** (البيانات لم
 * تصل)، **وأين** — اتّصالُ الجهاز، أم الخادم، أم هذا الطلب وحده — من حال
 * الاتّصال المشتركة (`lib/connection`) التي تسأل الخادمَ حين تظهر، **وما لم
 * يجرِ** (لم يُحذف شيء — وهو أوّل ما يخطر لمن رأى قائمته فارغة)، **وما
 * يفعله** (زرٌّ واحد ظاهر).
 *
 * وزرُّ الإعادة يستدعي `refetch` لهذا الاستعلام وحده: لا تُفقد حالةُ الشاشة
 * — المرشِّحات والصفحة والبحث — ولا يُعاد تحميل ما لم يفشل. وإن أعاد وعداً
 * دار الزرّ حتى يُحسم، فلا تُرسَل المحاولة مرّتين بنقرتين. وما دام الخادم لا
 * يجيب فالحالُ المشتركة تعيد سؤاله، ولحظةَ يجيب تعيد جلبَ كلّ ما فشل — هذا
 * وغيره — فلا تحتاج كلُّ بطاقةٍ إلى مؤقّتها.
 */

type Diagnosis = "checking" | "offline" | "down" | "up";
type Tone = "ok" | "bad" | "warn" | "muted" | "checking";

/* The panel is dark in both themes, so its colours are fixed light shades. */
const TEXT: Record<Tone, string> = {
  ok: "text-emerald-300",
  bad: "text-rose-300",
  warn: "text-amber-300",
  muted: "text-cream/55",
  checking: "text-gold-soft",
};
const DOT: Record<Tone, string> = {
  ok: "bg-emerald-400",
  bad: "bg-rose-400",
  warn: "bg-amber-400",
  muted: "bg-cream/40",
  checking: "bg-gold-soft",
};

/** What is wrong, as far as the shared connection state can tell. */
function useDiagnosis() {
  const { link, nextAt, waitMs, checkedAt } = useConnection();
  // A fresh look, from the moment this card appears: was the server up then?
  const [since] = useState(() => Date.now());
  useEffect(() => {
    void checkConnection();
  }, []);
  const diagnosis: Diagnosis =
    link === "offline" ? "offline" : link === "down" ? "down" : link === "checking" || checkedAt < since ? "checking" : "up";
  const now = useNow(nextAt !== null);
  const left = nextAt !== null ? secondsUntil(nextAt, now) : null;
  const progress = nextAt !== null && waitMs ? Math.min(1, Math.max(0, (nextAt - now) / waitMs)) : 0;
  return { diagnosis, left, progress };
}

export function ErrorRetry({
  onRetry,
  title,
  hint,
  compact = false,
  onDark = false,
  className,
}: {
  /** يُستدعى للإعادة؛ وإن أعاد وعداً (كـ`refetch`) انتظره الزرّ. */
  onRetry: () => unknown;
  /** عنوانٌ يخصّ الشاشة، وإلّا فالعامّ. */
  title?: string;
  hint?: string;
  /** صيغةٌ مختصرة لصفّ جدول أو قائمة: سطرٌ مع تشخيصٍ قصير. */
  compact?: boolean;
  /** المختصرةُ فوق سطحٍ داكن (رأسُ صفحة): بألوانٍ فاتحة. */
  onDark?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { diagnosis, left, progress } = useDiagnosis();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = () => {
    if (busyRef.current) return;
    // While the server is down, a press also looks again at once.
    if (diagnosis === "down") void checkConnection();
    const result = onRetry();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      busyRef.current = true;
      setBusy(true);
      void (result as Promise<unknown>).finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
    }
  };

  const retry = (size: "md" | "sm") => (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      aria-busy={busy}
      className={`group inline-flex shrink-0 items-center gap-2 rounded-xl bg-linear-to-l from-gold to-gold-soft font-bold text-forest-deep shadow-[0_10px_24px_-12px_rgba(193,150,90,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-12px_rgba(193,150,90,1)] active:translate-y-0 active:scale-95 disabled:cursor-wait disabled:opacity-80 disabled:hover:translate-y-0 ${
        size === "md" ? "px-5 py-2.5 text-sm" : "px-4 py-2 text-[13px]"
      }`}
    >
      <RotateCcw
        size={size === "md" ? 15 : 14}
        className={busy ? "animate-spin [animation-direction:reverse]" : "transition-transform duration-500 group-hover:-rotate-180"}
      />
      {busy ? t("admin.retrying") : t("admin.retry")}
    </button>
  );

  // One short line: where it broke, and when the next attempt comes.
  const line =
    diagnosis === "down" && left !== null
      ? `${t("admin.errorPanel.eyebrow_down")} · ${t("admin.errorPanel.autoRetry", { s: left })}`
      : t(`admin.errorPanel.eyebrow_${diagnosis}`);
  const broken = diagnosis === "down" || diagnosis === "offline";
  const BadgeIcon = diagnosis === "offline" ? WifiOff : diagnosis === "down" ? Unplug : diagnosis === "checking" ? Loader2 : CloudOff;

  if (compact)
    return (
      <div
        className={`relative my-3 flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl border px-4 py-3.5 ${
          onDark ? "border-white/10 bg-white/[0.05] backdrop-blur-sm" : "border-brick/20 bg-linear-to-l from-brick/[0.09] via-brick/[0.04] to-transparent"
        } ${className ?? ""}`}
        role="alert"
      >
        {/* the countdown, drawn as a hairline along the bottom */}
        {diagnosis === "down" && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/5">
            <span className="block h-full bg-linear-to-l from-gold to-gold-soft transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
        <span className="relative grid size-10 shrink-0 place-items-center">
          {broken && <span className="absolute inset-0 rounded-full bg-brick/20 motion-safe:animate-ping" />}
          <span
            className={`relative grid size-10 place-items-center rounded-full ring-4 ${
              onDark ? "bg-rose-500/15 text-rose-200 ring-white/5" : "bg-brick/12 text-brick ring-brick/5"
            }`}
          >
            <BadgeIcon size={17} className={diagnosis === "checking" ? "motion-safe:animate-spin" : ""} />
          </span>
        </span>
        {/* a floor under the text: in a narrow column the button moves below instead */}
        <div className="min-w-[11rem] flex-1">
          <p className={`text-[14px] font-bold ${onDark ? "text-cream" : "text-forest"}`}>{title ?? t("admin.loadError")}</p>
          <p className={`mt-0.5 text-[12px] tabular-nums ${onDark ? "text-cream/65" : "text-clay"}`}>{line}</p>
        </div>
        {retry("sm")}
      </div>
    );

  const stateTone: Tone = diagnosis === "up" ? "warn" : diagnosis === "checking" ? "checking" : "bad";
  const serverTone: Tone = diagnosis === "offline" ? "muted" : diagnosis === "up" ? "ok" : diagnosis === "down" ? "bad" : "checking";
  const online = diagnosis !== "offline";
  const rows: { icon: LucideIcon; label: string; value: string; tone: Tone }[] = [
    {
      icon: online ? Wifi : WifiOff,
      label: t("admin.errorPanel.internet"),
      value: t(online ? "admin.errorPanel.online" : "admin.errorPanel.offline"),
      tone: online ? "ok" : "bad",
    },
    {
      icon: Server,
      label: t("admin.errorPanel.server"),
      value: t(diagnosis === "offline" ? "admin.errorPanel.unknown" : `admin.errorPanel.${diagnosis}`),
      tone: serverTone,
    },
    { icon: ShieldCheck, label: t("admin.errorPanel.data"), value: t("admin.errorPanel.dataSafe"), tone: "ok" },
  ];

  return (
    <section
      className={`forest-glow relative isolate overflow-hidden rounded-3xl px-6 py-10 text-cream shadow-[0_24px_60px_-28px_rgba(22,36,31,0.75)] sm:px-10 lg:py-12 ${className ?? ""}`}
      role="alert"
    >
      <div className="dot-matrix pointer-events-none absolute inset-0 -z-10 opacity-50" />
      <div className="pointer-events-none absolute -top-28 -end-24 -z-10 size-96 rounded-full bg-gold/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -start-20 -z-10 size-80 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold/60 to-transparent" />

      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:gap-14">
        {/* what happened, and what to do */}
        <div className="min-w-0 text-center lg:text-start">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11.5px] font-semibold text-cream/85 backdrop-blur-sm">
            <span className="relative flex size-2">
              <span className={`absolute inline-flex size-full rounded-full opacity-70 motion-safe:animate-ping ${DOT[stateTone]}`} />
              <span className={`relative inline-flex size-2 rounded-full ${DOT[stateTone]}`} />
            </span>
            {t(`admin.errorPanel.eyebrow_${diagnosis}`)}
          </p>
          <h2 className="font-serif text-[26px] leading-tight font-bold text-cream lg:text-[32px]">{title ?? t("admin.loadError")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-cream/75 lg:mx-0">
            {hint ?? (diagnosis === "checking" ? t("admin.loadFailedAction") : t(`admin.errorPanel.hint_${diagnosis}`))}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            {retry("md")}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-cream backdrop-blur-sm transition hover:bg-white/[0.12]"
            >
              <RefreshCw size={14} />
              {t("admin.errorPanel.reload")}
            </button>
          </div>

          {diagnosis === "down" && left !== null && (
            <div className="mx-auto mt-6 max-w-xs lg:mx-0" data-testid="auto-retry">
              <p className="flex items-center justify-center gap-1.5 text-[12px] text-cream/65 tabular-nums lg:justify-start">
                <Loader2 size={12} className="text-gold-soft motion-safe:animate-spin" />
                {t("admin.errorPanel.autoRetry", { s: left })}
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-l from-gold to-gold-soft transition-[width] duration-300 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* where it broke */}
        <div className="mx-auto w-full max-w-sm lg:max-w-none">
          <Topology diagnosis={diagnosis} you={t("admin.errorPanel.you")} serverLabel={t("admin.errorPanel.server")} />
          <ul className="mt-7 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-cream/80">
                  <r.icon size={15} />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-cream/85">{r.label}</span>
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${TEXT[r.tone]}`}>
                  {r.tone === "checking" ? <Loader2 size={12} className="motion-safe:animate-spin" /> : <span className={`size-1.5 rounded-full ${DOT[r.tone]}`} />}
                  {r.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The device, the server, and the line between them — broken where it broke. */
function Topology({ diagnosis, you, serverLabel }: { diagnosis: Diagnosis; you: string; serverLabel: string }) {
  const broken = diagnosis === "offline" || diagnosis === "down";
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <Node icon={MonitorSmartphone} label={you} tone={diagnosis === "offline" ? "bad" : "ok"} />
      <div className="relative h-12 flex-1">
        <span
          className={`absolute inset-x-1 top-1/2 -translate-y-1/2 border-t-2 ${
            broken ? "border-dashed border-rose-300/45" : diagnosis === "up" ? "border-amber-300/45" : "border-dashed border-gold/45"
          }`}
        />
        {diagnosis === "checking" && (
          <span className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-gold-soft shadow-[0_0_10px_rgba(212,180,131,0.9)] motion-safe:animate-[signal-travel_1.8s_ease-in-out_infinite]" />
        )}
        <span
          className={`absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border backdrop-blur-sm ${
            broken
              ? "border-rose-300/40 bg-rose-500/15 text-rose-200"
              : diagnosis === "up"
                ? "border-amber-300/40 bg-amber-500/15 text-amber-200"
                : "border-gold/40 bg-gold/15 text-gold-soft"
          }`}
        >
          {broken && <span className="absolute inset-0 rounded-full border border-rose-300/40 motion-safe:animate-ping" />}
          {broken ? <Unplug size={17} /> : diagnosis === "up" ? <AlertTriangle size={17} /> : <Loader2 size={17} className="motion-safe:animate-spin" />}
        </span>
      </div>
      <Node
        icon={Server}
        label={serverLabel}
        tone={diagnosis === "offline" ? "muted" : diagnosis === "up" ? "ok" : diagnosis === "down" ? "bad" : "checking"}
      />
    </div>
  );
}

function Node({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: Tone }) {
  return (
    <div className="flex w-20 shrink-0 flex-col items-center gap-2">
      <span className="relative grid size-16 place-items-center rounded-2xl border border-white/12 bg-white/[0.07] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_-16px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        <Icon size={26} strokeWidth={1.6} />
        <span className={`absolute -top-1 -end-1 size-3.5 rounded-full ring-[3px] ring-black/25 ${DOT[tone]}`} />
      </span>
      <span className="text-[11.5px] font-semibold text-cream/70">{label}</span>
    </div>
  );
}
