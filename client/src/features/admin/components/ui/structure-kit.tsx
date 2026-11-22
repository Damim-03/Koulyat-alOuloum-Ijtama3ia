import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowDownUp,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  GitBranch,
  GraduationCap,
  Hash,
  Info,
  Landmark,
  Layers,
  Users,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { Select } from "../../../../components/ui/select";
import { DangerConfirm, type DangerFact } from "../../../../components/dialog/danger-confirm";

/**
 * The pieces every level of the academic structure is built from — faculty,
 * department, domain, filiere, specialization — so the five pages read as one
 * place: the same card, the same toolbar, the same way to add, open, edit and
 * delete, and the same warning when a branch is missing what makes it usable.
 */

export interface NodeStat {
  icon: LucideIcon;
  label: string;
  value: number | string;
}

export interface NodeHealth {
  tone: "warn" | "info" | "ok";
  label: string;
  detail?: string;
}

const HEALTH: Record<NodeHealth["tone"], { cls: string; icon: LucideIcon }> = {
  warn: { cls: "border-amber-400/40 bg-amber-500/10 text-amber-800 dark:text-amber-200", icon: TriangleAlert },
  info: { cls: "border-sky-400/30 bg-sky-500/8 text-sky-800 dark:text-sky-200", icon: Info },
  ok: { cls: "border-emerald-400/30 bg-emerald-500/8 text-emerald-800 dark:text-emerald-200", icon: CheckCircle2 },
};

/** One entry of a level: what it is, what it holds, and what can be done with it. */
export function NodeCard({
  to,
  icon: Icon,
  iconUrl,
  iconTint,
  coverUrl,
  code,
  title,
  badge,
  meta,
  stats,
  people,
  health,
  onEdit,
  onDelete,
  deleteBlocked,
  testId,
}: {
  /** The entry's own page, without the language prefix. */
  to?: string;
  icon: LucideIcon;
  /** A logo to show instead of the icon (faculties). */
  iconUrl?: string | null;
  /** Override for the icon tile's colours (specialization levels). */
  iconTint?: string;
  coverUrl?: string | null;
  code?: string | null;
  title: string;
  badge?: ReactNode;
  /** A line under the title — where the entry sits, for instance. */
  meta?: ReactNode;
  /** What lies directly under the entry. */
  stats: NodeStat[];
  /** Who and what it reaches further down — students, professors, topics. */
  people?: NodeStat[];
  health?: NodeHealth | null;
  onEdit: () => void;
  onDelete: () => void;
  /** Why the server would refuse a delete — shown instead of letting it fail. */
  deleteBlocked?: string | null;
  testId?: string;
}) {
  const { t } = useTranslation();
  const { lang } = useParams();
  const href = to ? `/${lang}${to}` : undefined;
  const H = health ? HEALTH[health.tone] : null;
  const glass = !!coverUrl;

  const tile = (
    <span
      className={`relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border shadow-sm ${
        iconUrl ? "border-forest/10 bg-cream-card" : (iconTint ?? "border-gold/25 bg-linear-to-br from-forest to-forest-deep text-gold-soft")
      }`}
    >
      {iconUrl ? <img src={iconUrl} alt="" className="size-full object-contain" /> : <Icon size={24} />}
    </span>
  );
  const chips = (code || badge) && (
    <>
      {code && (
        <span dir="ltr" className="rounded-md border border-gold/25 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-gold">
          {code}
        </span>
      )}
      {badge}
    </>
  );
  const titleCls = glass
    ? "line-clamp-2 font-serif text-[18px] leading-snug font-bold text-cream [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]"
    : "line-clamp-2 font-serif text-[16.5px] leading-snug font-bold text-forest";
  const heading = href ? (
    <Link to={href} className={`${titleCls} transition ${glass ? "hover:text-gold-soft" : "hover:text-gold"}`}>
      {title}
    </Link>
  ) : (
    <h3 className={titleCls}>{title}</h3>
  );
  const actions = (
    <>
      <IconBtn onClick={onEdit} label={t("admin.edit")} icon={Pencil} glass={glass} />
      <IconBtn
        onClick={onDelete}
        label={deleteBlocked ?? t("admin.delete")}
        icon={deleteBlocked ? Lock : Trash2}
        danger={!deleteBlocked}
        disabled={!!deleteBlocked}
        glass={glass}
      />
    </>
  );

  return (
    <article
      data-testid={testId}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_18px_40px_-18px_rgba(38,66,61,0.35)]"
    >
      {coverUrl ? (
        // The picture is the card's hero: the name sits on it, over a brand
        // wash that keeps any picture readable; the chips and the actions
        // float in its top corners.
        <div className="node-cover relative h-44 shrink-0" data-testid="node-cover">
          <CoverImage src={coverUrl} />
          <div className="node-cover-scrim" aria-hidden="true" />
          <span className="node-cover-shine" aria-hidden="true" />
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            {chips ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-full bg-cream-card/90 p-1 shadow-sm backdrop-blur-sm">{chips}</div>
            ) : (
              <span />
            )}
            <div className="node-cover-glass flex shrink-0 gap-0.5 rounded-xl p-0.5">{actions}</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3.5 px-5 pb-4">
            {/* A solid ground under the tile, so a translucent level tint
                reads as it does on the card rather than over the picture. */}
            <span className="shrink-0 rounded-2xl bg-cream-card shadow-[0_14px_30px_-10px_rgba(0,0,0,0.75)] ring-1 ring-white/25">{tile}</span>
            <div className="min-w-0 flex-1 pb-0.5">{heading}</div>
          </div>
        </div>
      ) : (
        <span className="h-1 w-full bg-linear-to-l from-transparent via-gold/50 to-transparent opacity-60 transition group-hover:opacity-100" />
      )}

      <div className={`flex-1 p-5 ${glass ? "[&>:first-child]:mt-0" : ""}`}>
        {!glass && (
          <div className="flex items-start gap-3.5">
            {tile}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">{chips}</div>
              {heading}
            </div>
            <div className="flex shrink-0 gap-1">{actions}</div>
          </div>
        )}

        {meta && <div className="mt-3 text-[11px] leading-relaxed text-clay">{meta}</div>}

        {H && health && (
          <div className={`mt-3.5 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11.5px] leading-relaxed ${H.cls}`}>
            <H.icon size={14} className="mt-0.5 shrink-0" />
            <span>
              <b className="font-semibold">{health.label}</b>
              {health.detail && <span className="block opacity-80">{health.detail}</span>}
            </span>
          </div>
        )}

        <dl className={`mt-4 grid gap-2 ${stats.length >= 4 ? "grid-cols-2 min-[360px]:grid-cols-4" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-forest/8 bg-cream-2/50 px-1.5 py-2.5 text-center">
              <s.icon size={13} className="mx-auto mb-1 text-gold" />
              <dd className="font-serif text-[18px] leading-none font-bold text-forest tabular-nums">{s.value}</dd>
              <dt className="mt-1 truncate text-[10.5px] text-clay">{s.label}</dt>
            </div>
          ))}
        </dl>

        {people && people.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-dashed border-forest/10 pt-3 text-[11.5px] text-clay">
            {people.map((p) => (
              <span key={p.label} className="inline-flex items-center gap-1.5">
                <p.icon size={13} className="text-gold" />
                {p.label}
                <b className="font-semibold text-forest tabular-nums">{p.value}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {href && (
        <Link
          to={href}
          className="flex items-center justify-between gap-2 border-t border-forest/8 bg-cream-2/40 px-5 py-3 text-[13px] font-semibold text-forest transition hover:bg-gold/10 hover:text-gold"
        >
          {t("admin.viewDetails")}
          <ChevronLeft size={16} className="transition ltr:rotate-180 rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1" />
        </Link>
      )}
    </article>
  );
}

/** A cover, faded in once it has loaded. One that fails to load leaves the
    brand-green ground of the cover rather than a broken-image mark. */
function CoverImage({ src }: { src: string }) {
  const [ready, setReady] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      data-ready={ready === src}
      onLoad={() => setReady(src)}
      onError={() => setBroken(src)}
      className="node-cover-img"
    />
  );
}

function IconBtn({
  onClick,
  label,
  icon: Icon,
  danger,
  disabled,
  glass,
}: {
  onClick: () => void;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  /** Sitting on a cover picture rather than on the card. */
  glass?: boolean;
}) {
  const tone = glass
    ? danger
      ? "text-red-300 hover:bg-red-500/25 hover:text-red-200 disabled:opacity-60"
      : "text-cream/90 hover:bg-white/15 hover:text-cream disabled:opacity-60"
    : danger
      ? "text-red-500 hover:border-red-300/50 hover:bg-red-500/10 disabled:opacity-45"
      : "text-clay hover:border-forest/10 hover:bg-forest/5 hover:text-forest disabled:opacity-45";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid size-8 place-items-center rounded-lg border border-transparent transition disabled:cursor-not-allowed ${tone}`}
    >
      <Icon size={15} />
    </button>
  );
}

export interface ToolbarChip {
  value: string;
  label: string;
  count: number;
  tone?: "warn";
}

/** Search, sort, and the quick filters of a level — with how many are shown. */
export function NodeToolbar({
  query,
  onQuery,
  placeholder,
  sort,
  onSort,
  sortOptions,
  chips,
  chip,
  onChip,
  shown,
  total,
  extra,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  sort: string;
  onSort: (v: string) => void;
  sortOptions: { value: string; label: string }[];
  chips?: ToolbarChip[];
  chip?: string;
  onChip?: (v: string) => void;
  shown: number;
  total: number;
  /** Anything else the level needs at hand — a level filter, a view switch. */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="mb-5 rounded-2xl border border-forest/10 bg-cream-card p-3 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-clay" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            data-testid="structure-search"
            className="h-11 w-full rounded-xl border border-forest/15 bg-cream-2 ps-10 pe-9 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery("")}
              aria-label={t("admin.struct.clear")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-clay transition hover:text-forest"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          <div className="w-full sm:w-52">
            <Select value={sort} icon={ArrowDownUp} onChange={onSort} options={sortOptions} aria-label={t("admin.struct.sort")} />
          </div>
        </div>
      </div>
      {(chips?.length || query) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/8 pt-3">
          {chips?.map((c) => {
            const on = chip === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChip?.(c.value)}
                disabled={!on && c.count === 0 && c.value !== "all"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  on
                    ? c.tone === "warn"
                      ? "border-amber-400/60 bg-amber-500/15 text-forest"
                      : "border-gold/60 bg-gold/15 text-forest"
                    : "border-forest/12 text-clay hover:border-forest/25 hover:text-forest"
                }`}
              >
                {c.tone === "warn" && <TriangleAlert size={12} className="text-amber-500" />}
                {c.label}
                <span className="rounded-full bg-forest/6 px-1.5 text-[10.5px] tabular-nums">{c.count}</span>
              </button>
            );
          })}
          <span className="ms-auto text-[11.5px] text-clay tabular-nums">{t("admin.struct.shown", { shown, total })}</span>
        </div>
      )}
    </section>
  );
}

/** A level with nothing in it yet — and the one action that starts it. */
export function EmptyLevel({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-gold/35 bg-cream-card px-6 py-14 text-center">
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative">
        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl border border-gold/30 bg-gold/10 text-gold">
          <Icon size={28} />
        </span>
        <p className="font-serif text-[17px] font-bold text-forest">{title}</p>
        {hint && <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-clay">{hint}</p>}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
          >
            <Plus size={16} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export type StructKind = "faculty" | "department" | "domain" | "filiere" | "spec" | "year";

/** ما يُعرف عن العنصر المحذوف — من الكيان نفسه كما تحمله الصفحة. */
export interface StructTarget {
  name: string;
  code?: string | null;
  level?: string;
  isActive?: boolean;
  archivedAt?: string | null;
  _count?: Partial<Record<string, number>>;
  counts?: Partial<Record<string, number>>;
}

/**
 * ما يرتبط بكلّ عنصرٍ في الهيكل — بقاعدة الخادم نفسها: ما يمنع حذفه (blocks)
 * وما يُذكر للعلم. فالقسم يُمنع بميادينه وشعبه وأساتذته، وتخصّصاته في شعبه.
 */
const LINKS: Record<StructKind, { key: string; icon: LucideIcon; blocks: boolean }[]> = {
  faculty: [{ key: "departments", icon: Landmark, blocks: true }],
  department: [
    { key: "domains", icon: Layers, blocks: true },
    { key: "filieres", icon: GitBranch, blocks: true },
    { key: "specializations", icon: GraduationCap, blocks: false },
    { key: "professors", icon: Users, blocks: true },
  ],
  domain: [{ key: "filieres", icon: GitBranch, blocks: true }],
  filiere: [{ key: "specializations", icon: GraduationCap, blocks: true }],
  spec: [
    { key: "students", icon: Users, blocks: true },
    { key: "topics", icon: BookOpen, blocks: true },
  ],
  year: [
    { key: "students", icon: Users, blocks: true },
    { key: "topics", icon: BookOpen, blocks: true },
  ],
};

const KIND_ICON: Record<StructKind, LucideIcon> = {
  faculty: Building2,
  department: Landmark,
  domain: Layers,
  filiere: GitBranch,
  spec: GraduationCap,
  year: CalendarDays,
};

/**
 * تأكيد حذف عنصرٍ من الهيكل — يُري ما يُحذف بالضبط وأين هو:
 *
 *   **البطاقة** — اسمه ونوعه ورمزه، وموقعه في الهيكل من الكلية إليه.
 *   **ما يرتبط به** — بعدده: الأقسام والشعب والأساتذة والطلبة والمواضيع.
 *   **المانع** — إن ارتبط به ما يمنع حذفه، يُقال قبل الضغط لا بعد ردّ الخادم،
 *     وبما يُفعل أوّلاً؛ والزرّ معطَّل.
 *
 * والنصوص كلّها من الترجمة، فتتبع لغة العرض.
 */
export function DeleteNodeDialog({
  kind,
  target,
  trail = [],
  title,
  loading,
  onConfirm,
  onClose,
}: {
  kind: StructKind;
  target: StructTarget | null;
  /** موقعه في الهيكل، من الأعلى إليه (بلا اسمه). */
  trail?: string[];
  title: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const KindIcon = KIND_ICON[kind];
  const countOf = (key: string) => target?._count?.[key] ?? target?.counts?.[key] ?? 0;
  const links = LINKS[kind].map((l) => ({ ...l, count: countOf(l.key) }));
  const blocking = links.filter((l) => l.blocks && l.count > 0);
  const list = (items: string[]) =>
    new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(items);

  const block = !target
    ? null
    : kind === "year" && target.isActive
      ? { message: t("admin.struct.del.activeYear"), hint: t("admin.struct.del.activeYearHint") }
      : kind === "year" && target.archivedAt
        ? { message: t("admin.struct.del.archivedYear"), hint: t("admin.struct.del.archivedYearHint") }
        : blocking.length
          ? {
              message: t("admin.struct.del.blocked", {
                list: list(blocking.map((l) => t(`admin.struct.del.count.${l.key}`, { count: l.count }))),
              }),
              hint: t(`admin.struct.del.hint.${kind}`),
            }
          : null;

  const facts: DangerFact[] = [
    ...(target?.code ? [{ icon: Hash, label: t("admin.struct.del.code"), value: target.code, dir: "ltr" as const }] : []),
    ...(target?.level
      ? [{ icon: GraduationCap, label: t("admin.struct.del.level"), value: t(`admin.proj.level.${target.level}`) }]
      : []),
    ...(kind === "year" && target
      ? [
          {
            icon: CalendarDays,
            label: t("admin.struct.del.status"),
            value: target.isActive
              ? t("admin.struct.del.statusActive")
              : target.archivedAt
                ? t("admin.struct.del.statusArchived")
                : t("admin.struct.del.statusIdle"),
          },
        ]
      : []),
  ];

  const nothing = links.every((l) => l.count === 0);
  return (
    <DangerConfirm
      open={!!target}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      title={title}
      icon={Trash2}
      name={target?.name ?? ""}
      kicker={t(`admin.struct.kind.${kind}`)}
      avatar={
        <span className="grid size-12 place-items-center rounded-2xl bg-brick/10 text-brick ring-1 ring-brick/20">
          <KindIcon size={22} />
        </span>
      }
      trail={trail.filter(Boolean)}
      facts={facts}
      block={block}
      impactsAlways
      impactsTitle={t("admin.struct.del.linked")}
      impacts={links.map((l) => ({
        icon: l.icon,
        label: t(`admin.struct.del.label.${l.key}`),
        value: l.count,
        heavy: l.blocks && l.count > 0,
      }))}
      warning={t("admin.struct.del.warning")}
      confirmLabel={t("admin.delete")}
    >
      {nothing && !block && (
        <p className="flex items-start gap-2 rounded-xl bg-sage/8 px-3 py-2.5 text-[12.5px] leading-relaxed font-semibold text-sage ring-1 ring-sage/20">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          {t("admin.struct.del.nothingLinked")}
        </p>
      )}
    </DangerConfirm>
  );
}

/** Primary and secondary actions for the dark header. */
export function HeaderAction({ icon: Icon, children, onClick, primary }: { icon: LucideIcon; children: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
        primary
          ? "bg-gold font-bold text-forest-deep shadow-sm hover:bg-gold-soft"
          : "border border-white/15 bg-cream/10 text-cream hover:bg-cream/20"
      }`}
    >
      <Icon size={17} />
      {children}
    </button>
  );
}
