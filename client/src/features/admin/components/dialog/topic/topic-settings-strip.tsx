import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarDays, CalendarRange, ChevronLeft, FileStack, Hourglass, Users, type LucideIcon } from "lucide-react";
import { useProposalWindow, useSelectionWindow, useTeamSize, useTopicQuota } from "../../../hooks/admin-hook";
import { periodState, proposalsOf, selectionOf, type Period } from "../../../../../lib/proposal-window";
import { useNow } from "../../../../../hooks/use-now";
import { SPEC_LEVEL_LABEL, SPEC_LEVEL_ORDER } from "../../../../../lib/spec-level";
import { MINUTE, STATE_DOT, timeLeft } from "./topic-settings-summary";

/**
 * إعدادات المواضيع في شريطٍ واحد فوق قائمتها — وتفاصيلها وتعديلها في صفحتها
 * (pages/topics/topic-settings.page)، يُفتح إليها من زرّ «إعدادات المواضيع».
 *
 * كانت ثلاث بطاقاتٍ تأخذ نصف الصفحة قبل المواضيع؛ وما يحتاج أن يُرى كلّ يومٍ
 * منها قليل: حالُ اقتراح الأساتذة واختيار الطلبة — وكم بقي —، وحدّ مواضيع
 * كلّ أستاذ، وعددُ طلبة كلّ موضوعٍ لكلّ مستوى، ومواضيعُ تخالفه إن وُجدت —
 * وهذه وحدها تنقل إلى قسمها في الإعدادات، فهي ما يُعمل به.
 *
 * وكلّ خانةٍ تسمّي من يخصّه فوق حاله بعبارةٍ تامّة — «اختيار الطلبة» ثمّ
 * «مفتوح — ينتهي بعد 6 أيام» —، وشرحُها الأطول في تلميحها. والسنة سنةُ فلتر
 * الصفحة إن اختيرت، وإلّا الجارية.
 */
export function TopicSettingsStrip({ yearId }: { yearId?: string }) {
  const { t } = useTranslation();
  const ts = (k: string, o?: Record<string, unknown>) => t(`admin.topicSettings.strip.${k}`, o);
  const { lang } = useParams();
  const { data: proposals } = useProposalWindow(yearId);
  const { data: selection } = useSelectionWindow(yearId);
  const { data: team } = useTeamSize(yearId);
  const { data: quota } = useTopicQuota(yearId);

  const proposalPeriod = proposals ? proposalsOf(proposals.year) : null;
  const selectionPeriod = selection ? selectionOf(selection.year) : null;
  // The minute is enough for «6 days», «3 hours» — and a period that ends while the page is open says so.
  const now = useNow(!!yearId, MINUTE);

  const year = proposals?.year.title ?? team?.year.title;
  const ruled = team ? SPEC_LEVEL_ORDER.filter((l) => team.year.teamSizes?.[l]) : [];
  const differing = team && ruled.length ? team.stats.differing : 0;
  const limit = quota?.year.maxTopicsPerProfessor ?? null;

  return (
    <section
      aria-label={t("admin.topicSettings.title")}
      data-testid="topic-settings-strip"
      className="relative mb-6 overflow-hidden rounded-2xl border border-gold/15 bg-cream-card shadow-[0_10px_30px_-20px_rgba(26,49,45,0.55)]"
    >
      {/* a wash of gold from the year's side, and a hairline under it all */}
      <div aria-hidden className="pointer-events-none absolute inset-0 from-gold/8 via-transparent to-transparent ltr:bg-linear-to-r rtl:bg-linear-to-l" />
      <div aria-hidden className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/55 to-transparent" />

      {!yearId ? (
        <p className="relative px-5 py-3.5 text-[13px] text-clay">{t("admin.topicSettings.noYear")}</p>
      ) : (
        <div className="relative flex flex-wrap items-stretch">
          {/* the year */}
          <div className="flex shrink-0 items-center px-4 py-3" title={ts("yearTip")}>
            {year ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-br from-gold to-gold-soft px-3 py-1.5 font-serif text-[14px] font-bold text-[#1a312d] shadow-[0_8px_18px_-10px_rgba(193,150,90,0.95)] tabular-nums">
                <CalendarDays size={14} aria-hidden />
                {year}
              </span>
            ) : (
              <Pending wide />
            )}
          </div>

          <PeriodCell testId="strip-proposals" icon={CalendarRange} label={ts("proposals")} tip={ts("proposalsTip")} period={proposalPeriod} now={now} />
          <Cell testId="strip-quota" icon={FileStack} label={ts("quota")} tip={ts("quotaTip")}>
            {!quota ? <Pending /> : <Value muted={limit === null}>{limit === null ? ts("quotaNone") : ts("quotaMax", { count: limit })}</Value>}
          </Cell>
          <PeriodCell testId="strip-selection" icon={Hourglass} label={ts("selection")} tip={ts("selectionTip")} period={selectionPeriod} now={now} />
          <Cell testId="strip-team-size" icon={Users} label={ts("teamSize")} tip={ts("teamSizeTip")}>
            {!team ? (
              <Pending />
            ) : ruled.length === 0 ? (
              <Value muted>{ts("teamUnset")}</Value>
            ) : (
              <Value>{ruled.map((l) => `${t(SPEC_LEVEL_LABEL[l])} ${team.year.teamSizes![l]!.n}`).join(" · ")}</Value>
            )}
          </Cell>

          {/* What to act on: straight to its section of the settings. */}
          {differing > 0 && (
            <div className="flex shrink-0 items-center px-4 py-3 lg:ms-auto">
              <Link
                to={`/${lang}/admin/topics/settings?year=${encodeURIComponent(yearId)}#settings-team-size`}
                data-testid="strip-differing"
                title={ts("differingTip")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1.5 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-500/30 transition hover:bg-amber-500/20 dark:text-amber-300"
              >
                <AlertTriangle size={13} aria-hidden />
                {ts("differing", { count: differing })}
                <ChevronLeft size={14} aria-hidden className="transition ltr:rotate-180" />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** One setting: an icon, whom it concerns above, how it stands below — the longer word in its tip. */
function Cell({ testId, icon: Icon, label, tip, children }: { testId: string; icon: LucideIcon; label: string; tip: string; children: ReactNode }) {
  return (
    <div
      data-testid={testId}
      title={tip}
      className="flex min-w-[12rem] flex-1 items-center gap-2.5 border-s border-forest/8 px-4 py-3 transition-colors hover:bg-gold/5 lg:flex-none"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/20">
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-clay">{label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13.5px] leading-tight">{children}</span>
      </span>
    </div>
  );
}

function Value({ muted = false, children }: { muted?: boolean; children: ReactNode }) {
  return <span className={`font-bold ${muted ? "text-clay" : "text-forest"}`}>{children}</span>;
}

function Pending({ wide = false }: { wide?: boolean }) {
  return <span className={`inline-block animate-pulse rounded bg-forest/8 ${wide ? "h-7 w-24" : "h-3.5 w-20"}`} aria-hidden />;
}

/**
 * A period in a whole phrase: «بلا فترة — مفتوح دائماً», «يبدأ بعد 3 أيام»,
 * «مفتوح — ينتهي بعد 6 أيام», «مغلق» — its colour in a dot beside it, a
 * pulse while it is open.
 */
function PeriodCell({
  testId,
  icon,
  label,
  tip,
  period,
  now,
}: {
  testId: string;
  icon: LucideIcon;
  label: string;
  tip: string;
  period: Period | null;
  now: number;
}) {
  const { t } = useTranslation();
  if (!period)
    return (
      <Cell testId={testId} icon={icon} label={label} tip={tip}>
        <Pending />
      </Cell>
    );
  const state = periodState(period, now);
  const target = state === "open" ? period.closeAt : state === "upcoming" ? period.openAt : null;
  const when = target ? timeLeft(t, Date.parse(target) - now) : "";
  return (
    <Cell testId={testId} icon={icon} label={label} tip={tip}>
      <span aria-hidden className="relative flex size-2 shrink-0" data-state={state}>
        {state === "open" && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${STATE_DOT[state]}`} />}
        <span className={`relative inline-flex size-2 rounded-full ${STATE_DOT[state]}`} />
      </span>
      <Value muted={state === "closed"}>{t(`admin.topicSettings.strip.${state}`, { when })}</Value>
    </Cell>
  );
}
