import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Archive, BookOpen, CalendarCheck, CalendarRange, ChevronLeft, Lock, Pencil, Plus, Star, Trash2, Users } from "lucide-react";
import { useActivateAcademicYear, useArchiveYears, useDeleteAcademicYear } from "../../hooks/admin-hook";
import type { AcademicYear, ArchiveYear } from "../../../../types/admin";
import { AcademicYearFormDialog } from "../dialog/academic/academic-dialog.form";
import { DeleteNodeDialog } from "../ui/structure-kit";
import i18n from "../../../../i18n/i18n";

/**
 * Academic years, in full: create, edit, delete, and pick the current one.
 *
 * A year frames the whole structure rather than belonging to one branch, so it
 * lives on the faculties page. Each card says what the year holds and where it
 * stands — current, open, or closed into the archive — and offers only what the
 * server will accept: a closed year is reopened from the archive, not here.
 */
export function AcademicYearsPanel() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const { data: years, isLoading } = useArchiveYears();
  const activateYear = useActivateAcademicYear();
  const deleteYear = useDeleteAcademicYear();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [removing, setRemoving] = useState<ArchiveYear | null>(null);

  function blockedReason(y: ArchiveYear) {
    if (y.isActive) return t("admin.struct.years.blockedActive");
    if (y.archivedAt) return t("admin.struct.years.blockedArchived");
    if (y.counts.students || y.counts.topics) return t("admin.struct.years.blockedUsed", { students: y.counts.students, topics: y.counts.topics });
    return null;
  }

  return (
    <section className="mt-10" data-testid="years-panel">
      <div className="mb-8 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-linear-to-r from-transparent to-forest/25" />
        <span className="size-1.5 rotate-45 bg-gold/70" />
        <span className="h-px flex-1 bg-linear-to-l from-transparent to-forest/25" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-linear-to-br from-gold/20 to-gold/5 text-gold">
            <CalendarRange size={18} />
          </span>
          <div>
            <h2 className="font-serif text-lg leading-tight font-bold text-forest">{t("admin.academicYears")}</h2>
            <p className="mt-0.5 text-[12px] text-clay">{t("admin.struct.years.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/${lang}/admin/academic-years`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-3.5 py-2.5 text-sm font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10"
          >
            <Archive size={15} className="text-gold" />
            {t("dash.archive")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
          >
            <Plus size={16} />
            {t("admin.addYear")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl border border-forest/10 bg-forest/5" />
          ))}
        </div>
      ) : (years?.length ?? 0) === 0 ? (
        <p className="rounded-3xl border border-dashed border-gold/35 bg-cream-card py-10 text-center text-sm text-clay">{t("admin.noYears")}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
          {years?.map((y) => {
            const blocked = blockedReason(y);
            return (
              <article
                key={y.id}
                data-testid="year-card"
                className={`relative overflow-hidden rounded-3xl border p-4 transition ${
                  y.isActive
                    ? "border-gold/50 bg-gold/10 shadow-[0_10px_30px_-14px_rgba(193,150,90,0.6)]"
                    : y.archivedAt
                      ? "border-forest/10 bg-cream-2/50"
                      : "border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                        y.isActive ? "bg-gold text-forest-deep" : y.archivedAt ? "bg-forest/8 text-clay" : "bg-soft-sage/30 text-forest"
                      }`}
                    >
                      {y.isActive ? <CalendarCheck size={20} /> : y.archivedAt ? <Lock size={18} /> : <CalendarRange size={20} />}
                    </span>
                    <div className="min-w-0">
                      <p dir="ltr" className="truncate text-start font-serif text-[19px] leading-tight font-bold text-forest">
                        {y.title}
                      </p>
                      <span
                        className={`mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-bold ${
                          y.isActive ? "text-gold" : y.archivedAt ? "text-clay" : "text-sage"
                        }`}
                      >
                        {y.isActive && <Star size={10} />}
                        {y.isActive
                          ? t("admin.activeYear")
                          : y.archivedAt
                            ? t("admin.yearArchive.archivedOn", {
                                date: new Date(y.archivedAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" }),
                              })
                            : t("admin.yearArchive.open")}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(y);
                        setOpen(true);
                      }}
                      title={t("admin.edit")}
                      aria-label={t("admin.edit")}
                      className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoving(y)}
                      disabled={!!blocked}
                      title={blocked ?? t("admin.delete")}
                      aria-label={blocked ?? t("admin.delete")}
                      className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-clay disabled:opacity-45"
                    >
                      {blocked ? <Lock size={14} /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                  {(
                    [
                      [Users, y.counts.students, t("admin.struct.students")],
                      [BookOpen, y.counts.topics, t("admin.struct.topics")],
                      [CalendarCheck, y.counts.defended, t("admin.yearArchive.count.defended")],
                    ] as const
                  ).map(([Icon, v, label]) => (
                    <div key={label} className="rounded-xl bg-cream-card/70 px-1 py-2">
                      <Icon size={12} className="mx-auto mb-0.5 text-gold" />
                      <b className="block font-serif text-[16px] leading-none text-forest tabular-nums">{v}</b>
                      <span className="mt-0.5 block truncate text-[10px] text-clay">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-forest/8 pt-3">
                  {!y.isActive && !y.archivedAt ? (
                    <button
                      type="button"
                      onClick={() => activateYear.mutate(y.id)}
                      disabled={activateYear.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-forest/8 px-2.5 py-1.5 text-[11.5px] font-semibold text-forest transition hover:bg-gold/15"
                    >
                      <Star size={12} className="text-gold" />
                      {t("admin.struct.years.makeCurrent")}
                    </button>
                  ) : (
                    <span />
                  )}
                  <Link
                    to={`/${lang}/admin/academic-years?year=${y.id}`}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-gold transition hover:text-forest"
                  >
                    {y.archivedAt ? t("admin.struct.years.openRecord") : t("admin.struct.years.viewRecord")}
                    <ChevronLeft size={13} className="ltr:rotate-180" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AcademicYearFormDialog open={open} onClose={() => setOpen(false)} year={editing} />
      <DeleteNodeDialog
        target={removing ? { name: removing.title } : null}
        title={t("admin.struct.deleteTitle.year")}
        loading={deleteYear.isPending}
        onConfirm={() => removing && deleteYear.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}
