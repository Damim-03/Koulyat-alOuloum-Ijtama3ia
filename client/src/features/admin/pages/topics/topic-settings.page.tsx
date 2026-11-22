import { useEffect, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  FileStack,
  GraduationCap,
  Hourglass,
  Settings2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { useAcademicYears, useProposalWindow, useSelectionWindow, useTeamSize, useTopicQuota } from "../../hooks/admin-hook";
import { Select } from "../../../../components/ui/select";
import { ProposalTimeline, SelectionTimeline } from "../../components/dialog/topic/proposal-timeline";
import { TeamSizeCard } from "../../components/dialog/topic/team-size-card";
import { TopicQuotaCard } from "../../components/dialog/topic/topic-quota-card";
import { MINUTE, STATE_DOT, periodLine } from "../../components/dialog/topic/topic-settings-summary";
import { useNow } from "../../../../hooks/use-now";
import { formatDay, proposalsOf, selectionOf, type Period } from "../../../../lib/proposal-window";
import { SPEC_LEVEL_LABEL, SPEC_LEVEL_ORDER } from "../../../../lib/spec-level";
import type { ProposalWindowState } from "../../../../types/admin";

/**
 * إعدادات المواضيع — لكلّ سنةٍ جامعية: فترة اقتراح المواضيع (الأساتذة)،
 * وحدّ المواضيع لكلّ أستاذ، ومهلة اختيارها (الطلبة)، وعدد الطلبة في كلّ
 * موضوع لكلّ مستوى.
 *
 * كانت بطاقاتٍ فوق قائمة المواضيع فازدحمت بها الصفحة؛ فبقي هناك سطرٌ يلخّصها
 * (TopicSettingsStrip) ورابطٌ إلى هنا، وهنا تُرى كاملةً وتُعدَّل.
 *
 * شاشةُ إعدادات: واجهةٌ داكنة بالسنة ومنتقيها، وثلاث لوحاتٍ تقول حال كلّ
 * إعدادٍ بنظرة — وتنقل إليه —، ثمّ الأقسام مرقّمة: لكلٍّ عنوانه ومن يخصّه
 * وما يحكمه، ثمّ بطاقته كما هي.
 *
 * والسنة في الرابط (`?year=`) — يحملها السطر من فلتر صفحة المواضيع —، وإلّا
 * الجارية. وتُختار هنا أيّ سنة: والمؤرشفة تُرى ولا تُعدَّل.
 */

type SectionId = "proposals" | "quota" | "selection" | "team-size";
const anchor = (id: SectionId) => `settings-${id}`;

function jumpTo(id: SectionId) {
  const el = document.getElementById(anchor(id));
  el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

export function AdminTopicSettingsPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const [params, setParams] = useSearchParams();
  const { data: years } = useAcademicYears();

  const asked = params.get("year");
  const yearId =
    (asked && years?.find((y) => y.id === asked)?.id) || years?.find((y) => y.isActive && !y.archivedAt)?.id;
  const year = years?.find((y) => y.id === yearId);

  // Opened at a section — «#settings-team-size», from the topics page's warning: scrolled to it once the sections are there.
  const { hash } = useLocation();
  useEffect(() => {
    if (!years || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [years, hash]);

  return (
    <div className="font-body">
      {/* ══════════ the header ══════════ */}
      <section
        data-testid="topic-settings-hero"
        className="relative mb-10 rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_18px_50px_-12px_rgba(26,49,45,0.45)] sm:p-8"
      >
        {/* ornament, clipped by a layer of its own so the year's list is never clipped */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "18px 18px" }}
          />
          <div className="absolute -end-20 -top-32 size-[28rem] rounded-full bg-gold/25 blur-3xl" />
          <div className="absolute -start-16 -bottom-40 size-96 rounded-full bg-soft-sage/15 blur-3xl" />
          {/* a slow gear, big and faint, behind the title */}
          <Settings2
            className="absolute -end-10 top-1/2 size-72 -translate-y-1/2 text-gold opacity-[0.06] motion-safe:animate-[spin_60s_linear_infinite]"
            strokeWidth={1}
          />
          <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => navigate("/admin/topics")}
            data-testid="topic-settings-back"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-soft-sage transition hover:text-cream"
          >
            <ChevronRight size={17} className="ltr:rotate-180" />
            {t("admin.backToTopics")}
          </button>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold to-gold-soft text-[#1a312d] shadow-[0_12px_30px_-10px_rgba(193,150,90,0.9)]">
                <Settings2 size={30} strokeWidth={1.8} />
                <span aria-hidden className="absolute inset-0 rounded-2xl ring-1 ring-white/30" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.2em] text-gold">{t("admin.topicSettings.eyebrow")}</p>
                <h1 className="mt-1 font-serif text-3xl font-bold leading-tight text-cream sm:text-4xl">{t("admin.topicSettings.title")}</h1>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-cream/70">{t("admin.topicSettings.subtitle")}</p>
              </div>
            </div>

            {/* the year: a light pill on the dark, its list over everything */}
            <div className="w-full sm:w-72">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-cream/60">{t("admin.academicYear")}</p>
              <div className="rounded-2xl bg-cream-card p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
                <Select
                  value={yearId ?? ""}
                  onChange={(v) => setParams({ year: v }, { replace: true })}
                  icon={CalendarDays}
                  aria-label={t("admin.academicYear")}
                  placeholder={t("admin.selectYear")}
                  options={(years ?? []).map((y) => ({
                    value: y.id,
                    label: y.archivedAt
                      ? t("admin.topicSettings.yearArchived", { year: y.title })
                      : y.isActive
                        ? t("admin.topicSettings.yearCurrent", { year: y.title })
                        : y.title,
                  }))}
                />
              </div>
              {year?.archivedAt && (
                <p className="mt-1.5 text-[11px] text-amber-200/90" data-testid="topic-settings-archived">
                  {t("admin.topicSettings.archivedNote")}
                </p>
              )}
            </div>
          </div>

          {/* each setting at a glance — and a press takes you to it */}
          <Overview yearId={yearId} />
        </div>
      </section>

      {/* Once the years are in — before, "no current year" would flash while they load. */}
      {years && (
        <div className="space-y-4">
          <Section
            id="proposals"
            n={1}
            icon={CalendarRange}
            title={t("admin.proposals.title")}
            audience={t("admin.topicSettings.forProfessors")}
            audienceIcon={UserRound}
            desc={t("admin.topicSettings.proposalsDesc")}
          >
            <ProposalTimeline yearId={yearId} />
          </Section>
          <Section
            id="quota"
            n={2}
            icon={FileStack}
            title={t("admin.topicQuota.title")}
            audience={t("admin.topicSettings.forProfessors")}
            audienceIcon={UserRound}
            desc={t("admin.topicSettings.quotaDesc")}
          >
            <TopicQuotaCard yearId={yearId} />
          </Section>
          <Section
            id="selection"
            n={3}
            icon={Hourglass}
            title={t("admin.selection.title")}
            audience={t("admin.topicSettings.forStudents")}
            audienceIcon={GraduationCap}
            desc={t("admin.topicSettings.selectionDesc")}
          >
            <SelectionTimeline yearId={yearId} />
          </Section>
          <Section
            id="team-size"
            n={4}
            icon={Users}
            title={t("admin.teamSize.title")}
            audience={t("admin.topicSettings.forEveryone")}
            audienceIcon={Users}
            desc={t("admin.topicSettings.teamSizeDesc")}
          >
            <TeamSizeCard yearId={yearId} />
          </Section>

          <p className="flex items-center justify-center gap-2 pt-2 pb-4 text-center text-[12px] text-clay">
            <BellRing size={14} className="shrink-0 text-gold" />
            {t("admin.topicSettings.footnote")}
          </p>
        </div>
      )}
    </div>
  );
}

/** A section: its number, what it is called, whom it concerns and what it governs — then its card. */
function Section({
  id,
  n,
  icon: Icon,
  title,
  audience,
  audienceIcon: AudienceIcon,
  desc,
  children,
}: {
  id: SectionId;
  n: number;
  icon: LucideIcon;
  title: string;
  audience: string;
  audienceIcon: LucideIcon;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section id={anchor(id)} aria-labelledby={`${anchor(id)}-title`} data-testid={`topic-settings-section-${id}`} className="scroll-mt-24">
      <header className="mb-3 flex items-end gap-4">
        <span aria-hidden className="font-serif text-5xl leading-none font-bold text-gold/25 tabular-nums">
          {String(n).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon size={17} className="text-gold" aria-hidden />
            <h2 id={`${anchor(id)}-title`} className="font-serif text-lg font-bold text-forest">
              {title}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-forest/6 px-2.5 py-0.5 text-[11px] font-semibold text-forest/75 ring-1 ring-forest/10">
              <AudienceIcon size={11} aria-hidden />
              {audience}
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-clay">{desc}</p>
        </div>
        <span aria-hidden className="mb-2 hidden h-px flex-1 from-gold/40 via-gold/10 to-transparent sm:block ltr:bg-linear-to-r rtl:bg-linear-to-l" />
      </header>
      {children}
    </section>
  );
}

/** The three settings of the year, each in a tile on the header. */
function Overview({ yearId }: { yearId?: string }) {
  const { t, i18n } = useTranslation();
  const { data: proposals } = useProposalWindow(yearId);
  const { data: selection } = useSelectionWindow(yearId);
  const { data: team } = useTeamSize(yearId);
  const { data: quota } = useTopicQuota(yearId);
  const now = useNow(!!yearId, MINUTE);
  const limit = quota?.year.maxTopicsPerProfessor ?? null;

  const ruled = team ? SPEC_LEVEL_ORDER.filter((l) => team.year.teamSizes?.[l]) : [];
  const differing = team && ruled.length ? team.stats.differing : 0;

  const periodTile = (period: Period | null, words: string) => {
    if (!period) return { state: null, value: null, sub: null };
    const { state, when } = periodLine(t, period, now);
    const sub =
      when ??
      (state === "unset"
        ? t("admin.topicSettings.noLimit")
        : t(`admin.${words}.range`, { from: formatDay(period.openAt!, i18n.language), to: formatDay(period.closeAt!, i18n.language) }));
    return { state, value: t(`admin.${words}.state.${state}`), sub };
  };

  const p = periodTile(proposals ? proposalsOf(proposals.year) : null, "proposals");
  const s = periodTile(selection ? selectionOf(selection.year) : null, "selection");

  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="topic-settings-overview">
      <Tile
        testId="overview-proposals"
        icon={CalendarRange}
        label={t("admin.proposals.title")}
        state={p.state}
        value={yearId ? p.value : "—"}
        sub={yearId ? p.sub : null}
        onClick={() => jumpTo("proposals")}
      />
      <Tile
        testId="overview-quota"
        icon={FileStack}
        label={t("admin.topicQuota.title")}
        value={!yearId ? "—" : !quota ? null : limit === null ? t("admin.topicQuota.none") : t("admin.topicQuota.perProfessor", { count: limit })}
        sub={
          !quota || !yearId ? null : limit === null ? (
            t("admin.topicSettings.quotaHint")
          ) : quota.stats.over > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-200">
              <AlertTriangle size={12} />
              {t("admin.topicSettings.quotaOver", { count: quota.stats.over })}
            </span>
          ) : (
            t("admin.topicSettings.quotaAt", { count: quota.stats.atLimit })
          )
        }
        onClick={() => jumpTo("quota")}
      />
      <Tile
        testId="overview-selection"
        icon={Hourglass}
        label={t("admin.selection.title")}
        state={s.state}
        value={yearId ? s.value : "—"}
        sub={yearId ? s.sub : null}
        onClick={() => jumpTo("selection")}
      />
      <Tile
        testId="overview-team-size"
        icon={Users}
        label={t("admin.teamSize.title")}
        value={
          !yearId
            ? "—"
            : !team
              ? null
              : ruled.length === 0
                ? t("admin.topicSettings.teamSizeUnset")
                : ruled.map((l) => `${t(SPEC_LEVEL_LABEL[l])} ${team.year.teamSizes![l]!.n}`).join(" · ")
        }
        sub={
          !team || !yearId ? null : differing > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-200">
              <AlertTriangle size={12} />
              {t("admin.topicSettings.differing", { count: differing })}
            </span>
          ) : ruled.length ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-300" />
              {t("admin.topicSettings.allMatch")}
            </span>
          ) : (
            t("admin.topicSettings.teamSizeHint")
          )
        }
        onClick={() => jumpTo("team-size")}
      />
    </div>
  );
}

function Tile({
  testId,
  icon: Icon,
  label,
  state,
  value,
  sub,
  onClick,
}: {
  testId: string;
  icon: LucideIcon;
  label: string;
  state?: ProposalWindowState | null;
  value: string | null;
  sub: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group relative overflow-hidden rounded-2xl bg-cream/5 p-4 text-start ring-1 ring-gold/15 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-cream/10 hover:ring-gold/45 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
    >
      <span aria-hidden className="absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-gold/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <span className="flex items-center gap-2 text-[11.5px] font-semibold text-cream/65">
        <span className="grid size-7 place-items-center rounded-lg bg-gold/15 text-gold">
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight size={15} className="shrink-0 rotate-90 text-cream/40 transition group-hover:text-gold" aria-hidden />
      </span>
      <span className="mt-3 flex items-center gap-2 font-serif text-xl font-bold text-cream">
        {state && (
          <span aria-hidden className="relative flex size-2.5">
            {state === "open" && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${STATE_DOT[state]}`} />}
            <span className={`relative inline-flex size-2.5 rounded-full ${STATE_DOT[state]}`} />
          </span>
        )}
        {value ?? <span className="inline-block h-5 w-24 animate-pulse rounded bg-cream/10" aria-hidden />}
      </span>
      <span className="mt-1 block min-h-4 text-[12px] text-cream/60">{sub}</span>
    </button>
  );
}
