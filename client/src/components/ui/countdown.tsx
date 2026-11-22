import { Fragment } from "react";
import { useTranslation } from "react-i18next";

/** أيّامٌ وساعاتٌ ودقائقُ وثوانٍ في مدّة (لا تنزل تحت الصفر). */
function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86_400), hours: Math.floor((s % 86_400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * عدٌّ تنازليّ كساعة لوحاتٍ قلّابة: لكلّ وحدةٍ لوحٌ داكن برقمٍ ذهبيّ وخطّ
 * القلب في وسطه، وتحته اسمها. والرقم الذي يتغيّر ينزل في مكانه بهدوء —
 * الثواني كلّ ثانية، والبقيّة حين تتغيّر.
 *
 * يعرض ما يُعطى (`ms`) ولا يدقّ بنفسه: من يعرضه يقرأ الوقت (useNow) ويعرف
 * ما ينتهي إليه. و`role="timer"` لا يُعلن كلّ ثانية لقارئ الشاشة؛ اسمه
 * (`label`) يقول ما يُعدّ إليه والمدّة كاملة.
 */
export function Countdown({
  ms,
  label,
  size = "lg",
  as = "timer",
}: {
  ms: number;
  label: string;
  size?: "lg" | "sm";
  /** `duration`: a length shown with the same plates — not counting down, so not a timer. */
  as?: "timer" | "duration";
}) {
  const { t } = useTranslation();
  const d = splitDuration(ms);
  const units = [
    { key: "days", value: d.days },
    { key: "hours", value: d.hours },
    { key: "minutes", value: d.minutes },
    { key: "seconds", value: d.seconds },
  ] as const;
  const lg = size === "lg";

  return (
    <div
      role={as === "timer" ? "timer" : "group"}
      aria-label={`${label} ${t("countdown.aria", { count: d.days, time: `${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}` })}`}
      className={`flex items-start ${lg ? "gap-1.5 sm:gap-2.5" : "gap-1"}`}
    >
      {units.map((u, i) => (
        <Fragment key={u.key}>
          {i > 0 && (
            <span aria-hidden className={`font-serif font-bold text-gold/70 ${lg ? "pt-3 text-2xl sm:pt-3.5" : "pt-1 text-sm"}`}>
              :
            </span>
          )}
          <div className={`flex flex-col items-center ${lg ? "gap-1.5" : "gap-0.5"}`} data-unit={u.key}>
            <div
              className={`relative grid place-items-center overflow-hidden ring-1 ring-gold/25 ${
                lg
                  ? "h-14 w-14 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_26px_-14px_rgba(0,0,0,0.7)] sm:h-16 sm:w-[4.4rem]"
                  : "h-8 w-9 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              }`}
              style={{ background: "linear-gradient(180deg, #2f5a52 0%, #1f3f39 50%, #16302b 50%, #122823 100%)" }}
            >
              {/* خطّ القلب، ولمعةٌ في النصف الأعلى */}
              <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-black/35" />
              <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.035]" />
              <span
                key={u.value}
                dir="ltr"
                className={`animate-digit relative font-serif font-bold tabular-nums text-gold-soft drop-shadow-[0_1px_0_rgba(0,0,0,0.45)] ${
                  lg ? "text-[26px] sm:text-[30px]" : "text-[15px]"
                }`}
              >
                {pad(u.value)}
              </span>
            </div>
            <span className={`font-semibold text-clay ${lg ? "text-[10.5px] tracking-wide" : "text-[9px]"}`}>{t(`countdown.${u.key}`)}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
