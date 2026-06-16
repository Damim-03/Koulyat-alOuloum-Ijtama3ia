import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Check,
  Loader2,
  Lock,
  Clock3,
  CalendarClock,
  MapPin,
  CircleDot,
  LifeBuoy,
  FolderKanban,
  CalendarDays,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useMyProject } from "../hooks/Student-hook";
import { PATHS } from "../../../routes/paths";
import type { GroupRequestMember } from "../../../types/student.types";

function nameOf(m: GroupRequestMember): string {
  const u = m.student?.user;
  return (
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
    m.student?.registrationNumber ||
    "—"
  );
}
function initials(name?: string | null) {
  if (!name) return "؟";
  const clean = name.replace(/^(د\.?|أ\.?|prof\.?|dr\.?)\s*/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "") || "؟";
}

const MILESTONE_STYLE: Record<
  string,
  {
    node: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  completed: {
    node: "bg-emerald-500 text-white ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    icon: Check,
  },
  in_progress: {
    node: "bg-gold text-forest-deep ring-gold/30 animate-pulse",
    badge: "bg-amber-100 text-amber-700",
    icon: CircleDot,
  },
  overdue: {
    node: "bg-red-500 text-white ring-red-100",
    badge: "bg-red-100 text-red-700",
    icon: Clock3,
  },
  pending: {
    node: "bg-cream-2 text-clay ring-clay/10",
    badge: "bg-clay/10 text-clay",
    icon: Lock,
  },
};

export function StudentMyProjectPage() {
  const { dir } = useLanguage();
  const { t, i18n } = useTranslation();
  const { data: project, isLoading } = useMyProject();

  const locale = i18n.language?.startsWith("ar")
    ? "ar"
    : i18n.language?.startsWith("fr")
      ? "fr"
      : "en";

  const fmt = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  };

  const milestones = useMemo(
    () => project?.milestones ?? [],
    [project?.milestones],
  );
  const members = project?.members ?? [];

  const prof = project?.topic?.professor?.user;
  const profName =
    [prof?.firstName, prof?.lastName].filter(Boolean).join(" ") || "—";

  const completed = useMemo(
    () => milestones.filter((m) => m.status === "completed").length,
    [milestones],
  );
  const total = milestones.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  const defenseDate = fmt(project?.defense?.date);
  const defenseRoom = project?.defense?.room ?? null;

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-sage" />
      </div>
    );
  }

  /* ── empty (no accepted project yet) ── */
  if (!project) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl bg-cream-card p-10 text-center ring-1 ring-clay/10">
        <div className="grid size-14 place-items-center rounded-full bg-forest/5 text-sage">
          <FolderKanban className="size-7" />
        </div>
        <h2 className="font-serif text-lg text-forest">{t("stu.noProject")}</h2>
        <p className="text-sm text-clay">{t("stu.noProjectDesc")}</p>
        <Link
          to={`${PATHS.student.root}/topics`}
          className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-medium text-cream-2 transition hover:bg-forest-deep"
        >
          {t("stu.browseTopics")}
        </Link>
      </div>
    );
  }

  return (
    <div dir={dir} className="mx-auto max-w-7xl space-y-6 font-body">
      {/* ── project header ── */}
      <header className="rounded-2xl bg-cream-card p-6 ring-1 ring-clay/10 shadow-[0_4px_20px_rgba(38,66,61,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* supervisor */}
          <div className="flex items-center gap-3 rounded-xl bg-forest px-4 py-3 text-cream-2">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-sm font-bold text-gold-soft ring-2 ring-gold/30">
              {initials(profName)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-soft-sage">
                {t("stu.academicSupervisor")}
              </p>
              <p className="truncate font-serif text-sm text-cream">
                {profName}
              </p>
            </div>
          </div>

          {/* title + label */}
          <div className="min-w-0 flex-1 lg:px-6">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-800">
              <CalendarDays className="size-3.5" />
              {t("stu.graduationProject")}
            </span>
            <h1 className="font-serif text-xl font-bold leading-snug text-forest md:text-2xl">
              {project.topic?.title ?? "—"}
            </h1>
          </div>

          {/* team */}
          {members.length > 0 && (
            <div className="shrink-0">
              <p className="mb-2 text-[11px] font-medium text-clay">
                {t("stu.teamMembers")}
              </p>
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {members.map((m, i) => {
                  const nm = nameOf(m);
                  return (
                    <div
                      key={m.id ?? i}
                      title={nm}
                      className="grid size-9 place-items-center rounded-full border-2 border-cream-card bg-linear-to-br from-sage to-forest text-xs font-bold text-cream"
                    >
                      {initials(nm)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* timeline */}
        <section className="lg:col-span-2 rounded-2xl bg-cream-card p-6 ring-1 ring-clay/10 shadow-[0_4px_20px_rgba(38,66,61,0.06)]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold text-forest">
              {t("stu.projectTimeline")}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-2 px-3 py-1 text-xs font-medium text-clay ring-1 ring-clay/10">
              <Lock className="size-3" />
              {t("stu.readOnly")}
            </span>
          </div>

          {total === 0 ? (
            <p className="py-8 text-center text-sm text-clay">
              {t("stu.noMilestones")}
            </p>
          ) : (
            <ol className="relative">
              {milestones.map((m, i) => {
                const st = m.status ?? "pending";
                const style = MILESTONE_STYLE[st] ?? MILESTONE_STYLE.pending;
                const Icon = style.icon;
                const isLast = i === milestones.length - 1;
                return (
                  <li
                    key={m.id ?? i}
                    className="relative flex gap-4 pb-7 last:pb-0"
                  >
                    {/* spine */}
                    {!isLast && (
                      <span className="absolute top-10 bottom-0 inset-s-4.75 w-0.5 bg-clay/15" />
                    )}
                    {/* node */}
                    <div
                      className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full ring-4 ${style.node}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    {/* card */}
                    <div className="min-w-0 flex-1 rounded-xl bg-cream-2 p-4 ring-1 ring-clay/10">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <h3 className="font-serif text-sm font-semibold text-forest">
                          {m.title ?? "—"}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.badge}`}
                        >
                          {t(`status.${st}`, { defaultValue: st })}
                        </span>
                      </div>
                      {m.description && (
                        <p className="mb-2 text-xs leading-relaxed text-clay">
                          {m.description}
                        </p>
                      )}
                      {fmt(m.deadline) && (
                        <p className="flex items-center gap-1.5 text-[11px] text-sage">
                          <CalendarClock className="size-3.5" />
                          {t("stu.deadline")}: {fmt(m.deadline)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* sidebar */}
        <div className="space-y-6">
          {/* final results / defense */}
          <div className="rounded-2xl bg-cream-2 p-5 ring-1 ring-clay/10 shadow-[0_4px_20px_rgba(38,66,61,0.06)]">
            <h3 className="mb-4 font-serif text-base font-semibold text-forest">
              {t("stu.finalResults")}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-gold" />
                <div>
                  <p className="text-[11px] text-clay">
                    {t("stu.expectedDate")}
                  </p>
                  <p className="font-semibold text-forest">
                    {defenseDate ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                <div>
                  <p className="text-[11px] text-clay">{t("stu.room")}</p>
                  <p className="font-semibold text-forest">
                    {defenseRoom ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* progress */}
          <div className="rounded-2xl bg-cream-card p-5 ring-1 ring-clay/10 shadow-[0_4px_20px_rgba(38,66,61,0.06)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-forest">
                {t("stu.progressSummary")}
              </h3>
              <span className="font-serif text-lg font-bold text-gold">
                {percent}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-2">
              <div
                className="h-full rounded-full bg-linear-to-r from-gold to-gold-soft transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-clay">
              {t("stu.milestonesCompleted", { done: completed, total })}
            </p>
          </div>

          {/* help */}
          <div className="rounded-2xl bg-forest p-5 text-cream-2">
            <h3 className="mb-2 flex items-center gap-2 font-serif text-base font-semibold text-cream">
              <LifeBuoy className="size-4 text-gold-soft" />
              {t("stu.needHelp")}
            </h3>
            <p className="mb-4 text-xs leading-relaxed text-soft-sage">
              {t("stu.needHelpDesc")}
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-gold py-2.5 text-sm font-bold text-forest-deep transition hover:bg-gold-soft active:scale-95"
            >
              {t("stu.helpCenter")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
