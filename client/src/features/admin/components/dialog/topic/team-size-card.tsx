import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  FileText,
  Inbox,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Repeat2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TeamSizeImpact, TeamSizeState } from "../../../../../types/admin";
import { useClearTeamSize, useSetTeamSize, useTeamSize, useTeamSizePreview } from "../../../hooks/admin-hook";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import { SPEC_LEVEL_LABEL, SPEC_LEVEL_ORDER, type SpecLevel } from "../../../../../lib/spec-level";
import type { TeamSizeRule, TeamSizes } from "../../../../../lib/team-size";
import { TopicPeek } from "./topic-peek";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { statusChip } from "../../../utils/status-styles";

const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** A rule as a person reads it: «طالبان» or «حتى 3». */
function useRuleText() {
  const { t } = useTranslation();
  return (r: TeamSizeRule) => (r.mode === "exact" ? t("teamSize.count", { count: r.n }) : t("teamSize.upTo", { n: r.n }));
}

/**
 * عدد الطلبة في كلّ موضوع — فوق قائمة المواضيع، بجانب فترتَي الاقتراح
 * والاختيار وللسنة نفسها: ما قرّرته الإدارة لكلّ مستوى (أو أنّه حرّ)، وكم
 * موضوعاً تحت القاعدة يطابقها وكم يخالفها. ومنها تُحدَّد وتُغيَّر وتُلغى.
 */
export function TeamSizeCard({ yearId }: { yearId?: string }) {
  const { t } = useTranslation();
  const ruleText = useRuleText();
  const { data } = useTeamSize(yearId);
  const [editing, setEditing] = useState(false);

  if (!yearId) return null;
  if (!data) return <div className="mb-6 h-[88px] animate-pulse rounded-2xl bg-forest/5" aria-hidden />;

  const { year, stats } = data;
  const ruled = SPEC_LEVEL_ORDER.filter((l) => year.teamSizes?.[l]);
  return (
    <section
      aria-labelledby="team-size-title"
      data-testid="team-size-card"
      className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-forest/10 bg-cream-card px-5 py-4 shadow-sm"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
        <Users size={21} />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="team-size-title" className="font-serif text-[15px] font-bold text-forest">
            {t("admin.teamSize.title")}
          </h2>
          <span className="text-xs text-clay">{year.title}</span>
          {ruled.length === 0 && (
            <span data-testid="team-size-state" className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-400/15 dark:text-gray-300">
              {t("admin.teamSize.free")}
            </span>
          )}
          {ruled.map((l) => (
            <span key={l} data-testid={`team-size-rule-${l}`} className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
              {t(SPEC_LEVEL_LABEL[l])}: {ruleText(year.teamSizes![l]!)}
            </span>
          ))}
        </div>
        <p className="mt-0.5 text-[12.5px] text-clay">{ruled.length ? t("admin.teamSize.setHint") : t("admin.teamSize.unsetHint")}</p>
      </div>

      {ruled.length > 0 && (
        <dl className="flex flex-wrap items-stretch gap-2">
          <Stat icon={FileText} label={t("admin.teamSize.statTopics")} value={stats.topics} />
          <Stat icon={CheckCircle2} label={t("admin.teamSize.statMatching")} value={stats.matching} />
          <Stat icon={AlertTriangle} label={t("admin.teamSize.statDiffering")} value={stats.differing} warn={stats.differing > 0} />
        </dl>
      )}

      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={!!year.archivedAt}
        title={year.archivedAt ? t("admin.teamSize.archived") : undefined}
        data-testid="team-size-edit"
        className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ruled.length ? <Pencil size={16} /> : <Plus size={16} />}
        {ruled.length ? t("admin.teamSize.edit") : t("admin.teamSize.set")}
      </button>

      {editing && <TeamSizeDialog state={data} onClose={() => setEditing(false)} />}
    </section>
  );
}

function Stat({ icon: Icon, label, value, warn = false }: { icon: LucideIcon; label: string; value: number; warn?: boolean }) {
  return (
    <div className={`min-w-[7.5rem] rounded-xl px-3 py-2 ring-1 ${warn ? "bg-amber-500/8 ring-amber-500/25" : "bg-cream-2/70 ring-forest/8"}`}>
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold text-clay">
        <Icon size={12} className={warn ? "text-amber-600 dark:text-amber-300" : "text-gold"} />
        {label}
      </dt>
      <dd className="mt-0.5 font-serif text-lg leading-tight font-bold text-forest tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * العدد لكلّ مستوى — بالضبط: رقمٌ يُختار لكلّ من الليسانس والماستر
 * والدكتوراه، وبجانبه أثره على مواضيع السنة قبل أن يُحفظ.
 *
 * عمودان: الأرقام، ومع كلّ مستوى كم موضوعاً له وبأيّ أعدادٍ هي الآن؛ ثمّ
 * الأثر — جدولٌ لكلّ مستوى (ما يطابق، وما سيتغيّر، وما فيه طلبةٌ أكثر — ولا
 * يُخرج أحد —، والطلبات المعلّقة الأكبر)، ثمّ المواضيع بأسمائها ومن كم إلى كم.
 * ثمّ يُحفظ ويُطبَّق — أو على ما يُنشأ بعد الآن وحده.
 */
function TeamSizeDialog({ state, onClose }: { state: TeamSizeState; onClose: () => void }) {
  const { t } = useTranslation();
  useBodyScrollLock(true);
  const { year } = state;
  const [sizes, setSizes] = useState<Record<SpecLevel, number>>(
    () => Object.fromEntries(SPEC_LEVEL_ORDER.map((l) => [l, year.teamSizes?.[l]?.n ?? 2])) as Record<SpecLevel, number>,
  );
  const [apply, setApply] = useState(true);
  // A topic opened beside the dialog, from the lists: its details at a glance.
  const [peek, setPeek] = useState<{ id: string; level: SpecLevel } | null>(null);
  // The level open, if any: a press anywhere outside it folds it again.
  const [openLevel, setOpenLevel] = useState<SpecLevel | null>(null);
  const rules: TeamSizes = Object.fromEntries(SPEC_LEVEL_ORDER.map((l) => [l, { n: sizes[l], mode: "exact" as const }]));
  const preview = useTeamSizePreview(year.id, rules);
  const save = useSetTeamSize();
  const clear = useClearTeamSize();
  const busy = save.isPending || clear.isPending;

  useEffect(() => {
    // Escape closes the topic opened beside it first, then the dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || busy) return;
      if (peek) setPeek(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, peek]);

  const impact = preview.data;
  const submit = () =>
    save.mutate(
      { yearId: year.id, rules: rules as Record<SpecLevel, TeamSizeRule>, applyToExisting: apply },
      { onSuccess: onClose },
    );

  return createPortal(
    <div className="fixed inset-0 z-60 grid place-items-center overflow-y-auto p-3 font-body sm:p-5" role="dialog" aria-modal="true" aria-labelledby="team-size-dialog-title">
      <div onClick={() => !busy && onClose()} className="fixed inset-0 bg-forest-deep/60 backdrop-blur-md" />

      {/* The dialog, and a topic opened beside it — side by side on a wide screen, over it on a narrow one. */}
      <div className="relative my-auto flex w-full max-w-[min(98vw,1620px)] items-stretch justify-center gap-4">
        <div className="animate-scale-in relative w-full max-w-[1200px] min-w-0 flex-1 overflow-hidden rounded-[26px] border border-gold/20 bg-cream-card shadow-[0_40px_120px_-30px_rgba(10,20,17,0.75)]">
          <header className="forest-glow relative flex items-center gap-4 px-6 py-5 text-cream sm:px-8">
            <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
            <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold-soft ring-1 ring-gold/30">
              <Users size={21} />
            </span>
            <div className="relative min-w-0 flex-1">
              <h3 id="team-size-dialog-title" className="font-serif text-[20px] font-bold">
                {t("admin.teamSize.dialogTitle", { year: year.title })}
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-cream/70">{t("admin.teamSize.dialogHint")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={t("admin.teamSize.close")}
              className="relative grid size-9 shrink-0 place-items-center self-start rounded-xl text-cream/75 transition hover:bg-white/10 hover:text-cream disabled:opacity-40"
            >
              <X size={18} />
            </button>
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-linear-to-l from-gold via-gold-soft to-gold" />
          </header>

          <div className="grid max-h-[72vh] gap-6 overflow-y-auto px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
            {/* ═══ 1 · the number for each level ═══ */}
            <section aria-labelledby="team-size-rules" className="min-w-0 space-y-3">
              <SectionTitle id="team-size-rules" n={1} text={t("admin.teamSize.sectionRules")} />
              {SPEC_LEVEL_ORDER.map((l) => (
                <LevelRule
                  key={l}
                  level={l}
                  open={openLevel === l}
                  onToggle={() => setOpenLevel((o) => (o === l ? null : l))}
                  onFold={() => setOpenLevel((o) => (o === l ? null : o))}
                  value={sizes[l]}
                  onChange={(n) => setSizes((s) => ({ ...s, [l]: n }))}
                  detail={impact?.levels[l]}
                />
              ))}
            </section>

            {/* ═══ 2 · what it does to the year's topics ═══ */}
            <section aria-labelledby="team-size-effect" aria-live="polite" data-testid="team-size-impact" className="min-w-0 space-y-4">
              <SectionTitle id="team-size-effect" n={2} text={t("admin.teamSize.sectionImpact")} />
              {!impact ? (
                <div className="grid h-40 place-items-center text-clay">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : (
                <Impact impact={impact} sizes={sizes} selected={peek?.id ?? null} onOpen={setPeek} />
              )}

              {/* ── on the topics there already, or on the new alone ── */}
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-forest/10 bg-cream-2/60 p-4">
                <input
                  type="checkbox"
                  checked={apply}
                  onChange={(e) => setApply(e.target.checked)}
                  className="mt-0.5 size-4 accent-[#c1965a]"
                  data-testid="team-size-apply"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-forest">{t("admin.teamSize.apply")}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-clay">
                    {apply ? t("admin.teamSize.applyHint") : t("admin.teamSize.newOnlyHint")}
                  </span>
                </span>
              </label>
            </section>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/50 px-6 py-4 sm:px-8">
            {year.teamSizes && Object.keys(year.teamSizes).length > 0 ? (
              <button
                type="button"
                onClick={() => clear.mutate(year.id, { onSuccess: onClose })}
                disabled={busy}
                data-testid="team-size-clear"
                className="text-sm font-semibold text-red-600 transition hover:underline disabled:opacity-50 dark:text-red-300"
              >
                {t("admin.teamSize.clear")}
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-50"
              >
                {t("admin.teamSize.cancel")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !impact}
                data-testid="team-size-save"
                className="inline-flex items-center gap-2 rounded-xl bg-linear-to-br from-gold to-gold-soft px-6 py-2.5 text-sm font-bold text-[#1a312d] shadow-[0_10px_24px_-10px_rgba(193,150,90,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {save.isPending && <Loader2 size={16} className="animate-spin" />}
                {apply && impact && impact.changesCount + impact.overCount > 0 ? t("admin.teamSize.saveApply") : t("admin.teamSize.save")}
              </button>
            </div>
          </footer>
        </div>
        {peek && <TopicPeek key={peek.id} topicId={peek.id} rule={sizes[peek.level]} onClose={() => setPeek(null)} />}
      </div>
    </div>,
    document.body,
  );
}

function SectionTitle({ id, n, text }: { id: string; n: number; text: string }) {
  return (
    <h4 id={id} className="flex items-center gap-2.5 text-[13px] font-bold text-forest">
      <span className="grid size-6 place-items-center rounded-full bg-gold/15 font-serif text-[12px] text-gold">{n}</span>
      {text}
    </h4>
  );
}

/**
 * One level: its number, chosen among ten — and, beside it, how many topics
 * the level has this year and with which numbers now.
 *
 * Folded, its head still says its number and its topics. Open, a press
 * anywhere outside it — another level, the table, the glance — folds it.
 */
function LevelRule({
  level,
  open,
  onToggle,
  onFold,
  value,
  onChange,
  detail,
}: {
  level: SpecLevel;
  open: boolean;
  onToggle: () => void;
  onFold: () => void;
  value: number;
  onChange: (n: number) => void;
  detail?: TeamSizeImpact["levels"][SpecLevel];
}) {
  const { t } = useTranslation();
  const card = useRef<HTMLDivElement | null>(null);
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (card.current && !card.current.contains(e.target as Node)) onFold();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onFold]);
  const name = t(SPEC_LEVEL_LABEL[level]);
  const sizes = Object.entries(detail?.sizes ?? {})
    .map(([size, n]) => ({ size: Number(size), n }))
    .sort((a, b) => a.size - b.size);
  return (
    <div
      ref={card}
      data-testid={`team-size-level-${level}`}
      className={`overflow-hidden rounded-2xl border bg-cream-2/50 transition ${open ? "border-gold/40 shadow-[0_10px_30px_-18px_rgba(193,150,90,0.7)]" : "border-forest/10"}`}
    >
      {/* The head folds the level: its name, its number and its topics stay in sight. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        data-testid={`team-size-toggle-${level}`}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-start transition hover:bg-forest/4"
      >
        <span className="font-serif text-[16px] font-bold text-forest">{name}</span>
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">{t("teamSize.count", { count: value })}</span>
        {detail && (
          <span className="ms-auto rounded-full bg-forest/8 px-2.5 py-0.5 text-[11px] font-semibold text-forest/75" data-testid={`team-size-topics-${level}`}>
            {t("admin.teamSize.levelTopics", { n: detail.total })}
          </span>
        )}
        <ChevronDown size={16} className={`shrink-0 text-clay transition-transform duration-300 ${detail ? "" : "ms-auto"} ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id={bodyId} className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open} aria-hidden={!open || undefined}>
          <div className="px-4 pb-4">
            <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-1.5">
              {SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={value === n}
                  aria-label={t("teamSize.count", { count: n })}
                  onClick={() => onChange(n)}
                  className={`h-10 rounded-xl font-serif text-[17px] font-bold tabular-nums transition ${
                    value === n
                      ? "bg-linear-to-br from-gold to-gold-soft text-[#1a312d] shadow-[0_8px_18px_-10px_rgba(193,150,90,0.9)]"
                      : "bg-cream-card text-forest ring-1 ring-forest/12 hover:ring-gold"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[12px] font-semibold text-forest" data-testid={`team-size-summary-${level}`}>
              {t("admin.teamSize.exactRowHint", { what: t("teamSize.count", { count: value }) })}
            </p>
            {detail && (
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-clay">
                {detail.total === 0 ? (
                  t("admin.teamSize.noTopics")
                ) : (
                  <>
                    <span>{t("admin.teamSize.nowSizes")}</span>
                    {sizes.map((s) => (
                      <span key={s.size} className={`rounded-md px-1.5 py-0.5 font-semibold ${s.size === value ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-forest/6 text-forest/70"}`}>
                        {t("admin.teamSize.sizeChip", { what: t("teamSize.count", { count: s.size }), n: s.n })}
                      </span>
                    ))}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The levels side by side, then the topics that change or keep more students, by name — each opened beside the dialog. */
function Impact({
  impact,
  sizes,
  selected,
  onOpen,
}: {
  impact: TeamSizeImpact;
  sizes: Record<SpecLevel, number>;
  selected: string | null;
  onOpen: (topic: { id: string; level: SpecLevel }) => void;
}) {
  const { t } = useTranslation();
  const closing = impact.over.filter((o) => o.to !== o.from).length;
  const cell = "px-3 py-2.5 text-center tabular-nums";
  const sum = (k: "total" | "matching" | "changes" | "over" | "pendingOver") => SPEC_LEVEL_ORDER.reduce((n, l) => n + impact.levels[l][k], 0);
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-forest/10">
        <table className="w-full min-w-[34rem] text-[12.5px]" data-testid="team-size-table">
          <thead className="bg-cream-2/80 text-[11px] font-bold text-clay">
            <tr>
              <th className="px-3 py-2.5 text-start">{t("admin.teamSize.colLevel")}</th>
              <th className={cell}>{t("admin.teamSize.colTopics")}</th>
              <th className={cell}>
                <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600" />{t("admin.teamSize.colMatching")}</span>
              </th>
              <th className={cell}>
                <span className="inline-flex items-center gap-1"><Repeat2 size={12} className="text-gold" />{t("admin.teamSize.colChanges")}</span>
              </th>
              <th className={cell}>
                <span className="inline-flex items-center gap-1"><AlertTriangle size={12} className="text-amber-600" />{t("admin.teamSize.colOver")}</span>
              </th>
              <th className={cell}>
                <span className="inline-flex items-center gap-1"><Inbox size={12} className="text-red-500" />{t("admin.teamSize.colPending")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/8">
            {SPEC_LEVEL_ORDER.map((l) => {
              const v = impact.levels[l];
              return (
                <tr key={l} data-testid={`team-size-row-${l}`}>
                  <th scope="row" className="px-3 py-2.5 text-start font-semibold text-forest">{t(SPEC_LEVEL_LABEL[l])}</th>
                  <td className={`${cell} font-semibold text-forest`}>{v.total}</td>
                  <td className={`${cell} text-emerald-700 dark:text-emerald-300`}>{v.matching}</td>
                  <td className={`${cell} ${v.changes ? "font-bold text-gold" : "text-clay"}`}>{v.changes}</td>
                  <td className={`${cell} ${v.over ? "font-bold text-amber-700 dark:text-amber-300" : "text-clay"}`}>{v.over}</td>
                  <td className={`${cell} ${v.pendingOver ? "font-bold text-red-600 dark:text-red-300" : "text-clay"}`}>{v.pendingOver}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-forest/15 bg-cream-2/60 font-bold text-forest">
            <tr>
              <th scope="row" className="px-3 py-2.5 text-start">{t("admin.teamSize.rowTotal")}</th>
              <td className={cell}>{sum("total")}</td>
              <td className={cell}>{sum("matching")}</td>
              <td className={cell} data-testid="impact-changes">{sum("changes")}</td>
              <td className={cell} data-testid="impact-over">{sum("over")}</td>
              <td className={cell} data-testid="impact-pending">{sum("pendingOver")}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {impact.pendingOver > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-red-500/8 px-3.5 py-2.5 text-[12px] text-red-700 dark:text-red-300">
          <Inbox size={14} className="mt-0.5 shrink-0" />
          {t("admin.teamSize.pendingOver", { n: impact.pendingOver })}
        </p>
      )}

      {impact.changesCount === 0 && impact.overCount === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-3 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300" data-testid="impact-none">
          <CheckCircle2 size={15} />
          {t("admin.teamSize.nothingChanges")}
        </p>
      ) : (
        <div className="space-y-4">
          {impact.changesCount > 0 && (
            <List title={t("admin.teamSize.changesTitle", { n: impact.changesCount })} more={impact.changesCount - impact.changes.length}>
              {impact.changes.map((c) => (
                <li key={c.id}>
                  <TopicRow row={c} selected={selected === c.id} onOpen={() => onOpen({ id: c.id, level: c.level })}>
                    <span className="flex shrink-0 items-center gap-1.5 font-serif text-[15px] font-bold tabular-nums" data-testid="impact-change">
                      <span className="text-clay line-through decoration-clay/50">{c.from}</span>
                      <ArrowLeft size={13} className="text-gold ltr:rotate-180" />
                      <span className="text-forest">{c.to}</span>
                    </span>
                  </TopicRow>
                </li>
              ))}
            </List>
          )}
          {impact.overCount > 0 && (
            <List
              title={t("admin.teamSize.overTitle", { n: impact.overCount })}
              hint={closing ? t("admin.teamSize.overClosing", { n: closing }) : t("admin.teamSize.overHint")}
              more={impact.overCount - impact.over.length}
              warn
            >
              {impact.over.map((c) => (
                <li key={c.id}>
                  <TopicRow
                    row={c}
                    over
                    selected={selected === c.id}
                    onOpen={() => onOpen({ id: c.id, level: c.level })}
                    note={t("admin.teamSize.overBy", { what: t("teamSize.count", { count: sizes[c.level] }), n: c.members - sizes[c.level] })}
                  >
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-700 dark:text-amber-300" data-testid="impact-over-members">
                        <Lock size={11} />
                        {t("teamSize.count", { count: c.members })}
                      </span>
                      {c.to !== c.from && (
                        <span className="text-[10.5px] font-semibold text-clay tabular-nums">{t("admin.teamSize.seatsClose", { from: c.from, to: c.to })}</span>
                      )}
                    </span>
                  </TopicRow>
                </li>
              ))}
            </List>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A topic in a list — a button that opens it beside the dialog: its
 * supervisor's face and name first, then its title, and under them its small
 * details: level, specialization, status, students — and, for one with more
 * students than the number, by how many.
 */
function TopicRow({
  row,
  over = false,
  note,
  selected,
  onOpen,
  children,
}: {
  row: TeamSizeImpact["changes"][number];
  over?: boolean;
  note?: string;
  selected: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      aria-label={t("admin.teamSize.peekOf", { title: row.title })}
      data-testid="team-size-topic"
      className={`group flex w-full items-center gap-3.5 px-4 py-3.5 text-start transition ${
        selected ? "bg-gold/10 ring-1 ring-gold/30 ring-inset" : "hover:bg-forest/4"
      }`}
    >
      <UserAvatar user={row.avatar} size={42} tone={over ? "gold" : "brand"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-forest/85" data-testid="team-size-topic-professor">
          {row.professor || "—"}
        </span>
        <span className="mt-0.5 block truncate text-[13.5px] font-semibold text-forest group-hover:underline" dir="auto" title={row.title}>
          {row.title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
          <LevelBadge level={row.level} />
          {row.specialization && (
            <span className="max-w-[14rem] truncate rounded-md bg-forest/5 px-1.5 py-0.5 font-semibold text-clay" title={row.specialization}>
              {row.specialization}
            </span>
          )}
          <span className={`rounded-md px-1.5 py-0.5 font-semibold ${statusChip(row.status)}`}>
            {t(`status.${row.status}`, { defaultValue: row.status })}
          </span>
          {!over && (
            <span className="rounded-md bg-forest/5 px-1.5 py-0.5 font-semibold text-clay">{t("admin.teamSize.rowStudents", { n: row.members })}</span>
          )}
          {note && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-bold text-amber-700 dark:text-amber-300">{note}</span>}
        </span>
      </span>
      {children}
      <ChevronLeft size={16} className={`shrink-0 transition ltr:rotate-180 ${selected ? "text-gold" : "text-clay/60 group-hover:text-gold"}`} aria-hidden />
    </button>
  );
}

function LevelBadge({ level }: { level: SpecLevel }) {
  const { t } = useTranslation();
  return <span className="shrink-0 rounded-md bg-forest/8 px-1.5 py-0.5 text-[10.5px] font-bold text-forest/70">{t(SPEC_LEVEL_LABEL[level])}</span>;
}

function List({ title, hint, more, warn = false, children }: { title: string; hint?: string; more: number; warn?: boolean; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className={`overflow-hidden rounded-2xl border ${warn ? "border-amber-500/25" : "border-forest/10"}`}>
      <div className={`px-3.5 py-2.5 ${warn ? "bg-amber-500/8" : "bg-cream-2/70"}`}>
        <p className="text-[12px] font-bold text-forest">{title}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-clay">{hint}</p>}
      </div>
      <ul className="max-h-80 divide-y divide-forest/8 overflow-y-auto">{children}</ul>
      {more > 0 && <p className="border-t border-forest/8 px-3.5 py-2 text-[11px] text-clay">{t("admin.teamSize.moreRows", { n: more })}</p>}
    </div>
  );
}
