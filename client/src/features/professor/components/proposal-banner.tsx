import { useTranslation } from "react-i18next";
import { CalendarCheck2, CalendarClock, CalendarX2 } from "lucide-react";
import type { AcademicYearLite } from "../../../types/professor.types";
import { formatDay, windowState } from "../../../lib/proposal-window";
import { useNow } from "../../../hooks/use-now";
import { Countdown } from "../../../components/ui/countdown";

/**
 * فترة اقتراح المواضيع للسنة الجارية، كما يراها الأستاذ فوق مواضيعه: مفتوحةٌ
 * حتى يومٍ وعدٌّ تنازليّ إلى نهايتها، أو تبدأ في يومٍ وعدٌّ إلى بدايتها، أو
 * انتهت (وتعديل مقترحاته باقٍ له). وبلا فترةٍ لا يظهر شيء: الاقتراح بلا قيد.
 *
 * والحال من الساعة: فترةٌ تبدأ أو تنتهي والصفحة مفتوحة تتغيّر في لحظتها.
 */
export function ProposalBanner({ year }: { year?: AcademicYearLite }) {
  const { t, i18n } = useTranslation();
  const tp = (k: string, o?: Record<string, unknown>) => t(`pro.proposals.${k}`, o);
  const pending = !!year && ["open", "upcoming"].includes(windowState(year));
  const now = useNow(pending, 1000);
  if (!year) return null;
  const state = windowState(year, now);
  if (state === "unset") return null;

  const open = year.proposalsOpenAt!;
  const close = year.proposalsCloseAt!;

  const tone =
    state === "open"
      ? { icon: CalendarCheck2, box: "border-emerald-500/25 bg-emerald-500/8", ink: "text-emerald-700 dark:text-emerald-300" }
      : state === "upcoming"
        ? { icon: CalendarClock, box: "border-amber-500/25 bg-amber-500/8", ink: "text-amber-700 dark:text-amber-300" }
        : { icon: CalendarX2, box: "border-red-500/25 bg-red-500/8", ink: "text-red-700 dark:text-red-300" };
  const Icon = tone.icon;

  const text =
    state === "open"
      ? tp("open", { year: year.title, date: formatDay(close, i18n.language) })
      : state === "upcoming"
        ? tp("upcoming", { year: year.title, date: formatDay(open, i18n.language) })
        : tp("closed", { year: year.title, date: formatDay(close, i18n.language) });
  const target = state === "open" ? close : state === "upcoming" ? open : null;
  const label = state === "open" ? t("admin.proposals.endsIn") : t("admin.proposals.opensIn");

  return (
    <div role="status" data-testid="proposal-banner" className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${tone.box}`}>
      <Icon size={20} className={`shrink-0 ${tone.ink}`} />
      <p className="min-w-0 flex-1 basis-56 text-sm text-forest">{text}</p>
      {target && (
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={`text-[11px] font-bold ${tone.ink}`}>{label}</span>
          <Countdown ms={Date.parse(target) - now} label={label} size="sm" />
        </div>
      )}
    </div>
  );
}
