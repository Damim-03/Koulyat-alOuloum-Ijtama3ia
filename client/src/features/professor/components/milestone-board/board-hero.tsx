import { useTranslation } from "react-i18next";
import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  ListPlus,
  Milestone,
  Paperclip,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Ring } from "../progress-ring";
import type { Health } from "../../lib/milestone-board";

/**
 * رأس اللوحة: ما يلخّص عمل الأستاذ كلّه (مذكراتٌ وطلبةٌ وملفات، ومتوسّط
 * الإنجاز)، وتحته حال المراحل — وكلّ حالٍ عددٌ وفلترٌ إليه معاً.
 */
export function BoardHero({
  totals,
  counts,
  health,
  onHealth,
}: {
  totals: { projects: number; students: number; files: number; avg: number };
  counts: Record<Health, number>;
  health: Health;
  onHealth: (h: Health) => void;
}) {
  const { t } = useTranslation();
  const tiles: { key: Health; icon: LucideIcon; tone: string; alarm?: boolean }[] = [
    { key: "all", icon: FolderKanban, tone: "text-cream" },
    { key: "late", icon: AlertTriangle, tone: counts.late > 0 ? "text-[#f0a48f]" : "text-soft-sage", alarm: counts.late > 0 },
    { key: "soon", icon: AlarmClock, tone: "text-amber-300" },
    { key: "done", icon: CheckCircle2, tone: "text-emerald-300" },
    { key: "empty", icon: ListPlus, tone: "text-gold-soft" },
  ];

  return (
    <section
      data-testid="board-hero"
      className="relative rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8"
    >
      {/* الزخرفة في طبقتها، مقصوصةً بحوافّ البطاقة */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "18px 18px" }}
        />
        <div className="absolute -end-16 -top-28 size-96 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -start-10 -bottom-32 size-80 rounded-full bg-soft-sage/15 blur-3xl" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_8px_24px_rgba(193,150,90,0.35)] sm:grid">
            <Milestone size={26} />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-tight font-bold text-cream">{t("pro.milestonesPageTitle")}</h1>
            <p className="mt-1 max-w-xl text-sm text-soft-sage">{t("pro.ms.subtitle")}</p>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="col-span-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-1">
            <Ring percent={totals.avg} size={52} />
            <div>
              <dt className="text-[11px] text-soft-sage">{t("pro.ms.statCompletion")}</dt>
              <dd className="font-serif text-2xl leading-none font-bold text-cream tabular-nums">{totals.avg}%</dd>
            </div>
          </div>
          <Stat icon={FolderKanban} label={t("pro.ms.statProjects")} value={totals.projects} />
          <Stat icon={Users} label={t("pro.ms.statStudents")} value={totals.students} />
          <Stat icon={Paperclip} label={t("pro.ms.statFiles")} value={totals.files} />
        </dl>
      </div>

      {/* حال المراحل — كلّ عددٍ فلترٌ إليه، والنقرة الثانية تلغيه */}
      <div role="group" aria-label={t("pro.ms.quick")} className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ key, icon: Icon, tone, alarm }) => {
          const active = health === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              data-health={key}
              onClick={() => onHealth(active && key !== "all" ? "all" : key)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition active:scale-[0.98] ${
                active
                  ? "border-gold/70 bg-white/12 shadow-[0_0_0_1px_rgba(217,174,114,0.35)]"
                  : alarm
                    ? "border-[#f0a48f]/40 bg-[#f0a48f]/10 hover:bg-[#f0a48f]/15"
                    : "border-white/10 bg-white/5 hover:border-gold/40 hover:bg-white/8"
              } ${key === "all" ? "col-span-2 sm:col-span-1" : ""}`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 ${tone}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-2xl leading-none font-bold text-cream tabular-nums">{counts[key]}</span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-tight text-soft-sage">{t(`pro.ms.health.${key}`)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    // على الهاتف ثلاثتها في سطرٍ واحد، بلا أيقوناتها.
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 sm:px-4">
      <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-white/8 text-gold-soft sm:grid">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] leading-tight text-soft-sage">{label}</dt>
        <dd className="font-serif text-2xl leading-none font-bold text-cream tabular-nums">{value}</dd>
      </div>
    </div>
  );
}
