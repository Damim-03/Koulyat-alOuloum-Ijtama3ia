import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  GitBranch,
  GraduationCap,
  Inbox,
  LayoutGrid,
  Lock,
  Pencil,
  Plus,
  Rows3,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useSpecializations, useFaculties, useFilieres, useDeleteSpecialization } from "../../hooks/admin-hook";
import type { Faculty, Specialization } from "../../../../types/admin";
import { SpecializationFormDialog } from "../../components/dialog/faculty/specialization.form-dialog.form";
import { FormDialog } from "../../components/form/form-dialog";
import { DeleteNodeDialog, EmptyLevel, NodeCard, NodeToolbar } from "../../components/ui/structure-kit";
import { Select } from "../../../../components/ui/select";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { matchesQuery } from "../../lib/structure-stats";
import i18n from "../../../../i18n/i18n";
import { LEVEL_STYLE, SPEC_LEVELS, specChain } from "./spec-utils";
import { ErrorRetry } from "../../../../components/ui/error-retry";

/**
 * Every specialization of the platform, wherever it sits.
 *
 * The figures of the whole set — by level, by who is in them — each one a
 * filter; the specializations as cards or as a table, each with the chain it
 * belongs to and a door to every level of it; and adding one from here, by
 * choosing its filiere first. Filters live in the address, so a view can be
 * shared or come back to.
 */

const PAGE_SIZE = 12;
type Flag = "" | "empty" | "noTopics";

export function AdminAcademicStructurePage() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";
  const level = get("level");
  const facultyId = get("faculty");
  const filiereId = get("filiere");
  const flag = get("flag") as Flag;
  const sort = get("sort") || "name";
  const view = get("view") === "table" ? "table" : "cards";
  const page = Math.max(1, Number(get("page")) || 1);

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setSp(next, { replace: true });
  }

  const [search, setSearch] = useState(get("q"));
  useEffect(() => {
    const id = setTimeout(() => {
      if (search.trim() !== get("q")) update({ q: search.trim() });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: specs, isLoading, isError, refetch } = useSpecializations();
  const { data: faculties } = useFaculties();
  const deleteSpec = useDeleteSpecialization();

  const [editing, setEditing] = useState<Specialization | null>(null);
  const [removing, setRemoving] = useState<Specialization | null>(null);
  const [picking, setPicking] = useState(false);
  const [createFor, setCreateFor] = useState("");

  const all = useMemo(() => specs ?? [], [specs]);
  const facultyById = useMemo(() => new Map((faculties ?? []).map((f) => [f.id, f] as [string, Faculty])), [faculties]);
  const chainOf = (s: Specialization) => specChain(s, facultyById);

  // The options name where each one sits and how many specializations it holds.
  const facultyOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number; depts: Set<string> }>();
    for (const s of all) {
      const c = specChain(s, facultyById);
      if (!c.faculty) continue;
      const row = seen.get(c.faculty.id) ?? { id: c.faculty.id, name: c.faculty.name, count: 0, depts: new Set<string>() };
      row.count += 1;
      if (c.dept) row.depts.add(c.dept.id);
      seen.set(c.faculty.id, row);
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  }, [all, facultyById]);
  const filiereOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; hint: string; count: number }>();
    for (const s of all) {
      const c = specChain(s, facultyById);
      if (!c.filiere || (facultyId && c.faculty?.id !== facultyId)) continue;
      const row = seen.get(c.filiere.id) ?? {
        id: c.filiere.id,
        name: c.filiere.name,
        hint: [c.dept?.name, facultyId ? null : c.faculty?.name].filter(Boolean).join(" · "),
        count: 0,
      };
      row.count += 1;
      seen.set(c.filiere.id, row);
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  }, [all, facultyById, facultyId]);

  const students = (s: Specialization) => s._count?.students ?? 0;
  const topics = (s: Specialization) => s._count?.topics ?? 0;

  // Everything but the level, so the level chips can count what they would show.
  const q = get("q");
  const scoped = useMemo(() => {
    return all.filter((s) => {
      const c = specChain(s, facultyById);
      if (facultyId && c.faculty?.id !== facultyId) return false;
      if (filiereId && c.filiere?.id !== filiereId) return false;
      if (flag === "empty" && (s._count?.students ?? 0) > 0) return false;
      if (flag === "noTopics" && (s._count?.topics ?? 0) > 0) return false;
      return matchesQuery(q, s.name, c.filiere?.name, c.dept?.name, c.faculty?.name);
    });
  }, [all, facultyById, facultyId, filiereId, flag, q]);

  const filtered = useMemo(
    () =>
      scoped
        .filter((s) => !level || s.level === level)
        .sort((a, b) =>
          sort === "students"
            ? (b._count?.students ?? 0) - (a._count?.students ?? 0)
            : sort === "topics"
              ? (b._count?.topics ?? 0) - (a._count?.topics ?? 0)
              : a.name.localeCompare(b.name, i18n.language),
        ),
    [scoped, level, sort],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const items = filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);

  const totals = useMemo(() => {
    const c = { licence: 0, master: 0, doctorate: 0, students: 0, topics: 0, empty: 0, noTopics: 0 } as Record<string, number>;
    for (const s of all) {
      c[s.level] = (c[s.level] ?? 0) + 1;
      c.students += s._count?.students ?? 0;
      c.topics += s._count?.topics ?? 0;
      if ((s._count?.students ?? 0) === 0) c.empty += 1;
      if ((s._count?.topics ?? 0) === 0) c.noTopics += 1;
    }
    return c;
  }, [all]);

  const active = ["q", "level", "faculty", "filiere", "flag"].filter((k) => !!sp.get(k));
  function clearAll() {
    setSearch("");
    const next = new URLSearchParams();
    if (sp.get("view")) next.set("view", sp.get("view")!);
    setSp(next, { replace: true });
  }

  const blockedOf = (s: Specialization) => {
    const parts = [
      students(s) > 0 && t("admin.struct.n.students", { count: students(s) }),
      topics(s) > 0 && t("admin.struct.n.topics", { count: topics(s) }),
    ].filter(Boolean);
    return parts.length ? t("admin.struct.blocked", { what: parts.join("، ") }) : null;
  };

  const tiles: { icon: LucideIcon; label: string; value: number; tone?: "warn"; on?: boolean; onClick?: () => void }[] = [
    { icon: GraduationCap, label: t("admin.statSpecializations"), value: all.length, on: !level && !flag, onClick: () => update({ level: "", flag: "" }) },
    ...SPEC_LEVELS.map((l) => ({
      icon: GraduationCap,
      label: t(`admin.proj.level.${l}`),
      value: totals[l] ?? 0,
      on: level === l,
      onClick: () => update({ level: level === l ? "" : l }),
    })),
    { icon: Users, label: t("admin.struct.students"), value: totals.students },
    { icon: BookOpen, label: t("admin.struct.topics"), value: totals.topics },
    { icon: TriangleAlert, label: t("admin.struct.health.noStudents"), value: totals.empty, tone: "warn", on: flag === "empty", onClick: () => update({ flag: flag === "empty" ? "" : "empty" }) },
    { icon: Inbox, label: t("admin.struct.health.noTopics"), value: totals.noTopics, tone: "warn", on: flag === "noTopics", onClick: () => update({ flag: flag === "noTopics" ? "" : "noTopics" }) },
  ];

  return (
    <div className="font-body">
      {/* ── hero ── */}
      <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl px-6 py-7 text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)] lg:px-8">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -end-16 size-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
                <GraduationCap size={26} />
              </span>
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                  <Sparkles size={12} />
                  {t("admin.struct.eyebrow")}
                </p>
                <h1 className="font-serif text-2xl font-bold text-cream lg:text-3xl">{t("admin.specializationsTitle")}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/70">{t("admin.struct.specs.subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPicking(true)}
              data-testid="spec-add"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
            >
              <Plus size={17} />
              {t("admin.addSpecialization")}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
            {tiles.map((x) => {
              const lit = x.tone === "warn" ? x.value > 0 : true;
              const body = (
                <>
                  <span className="mb-2 flex items-center gap-1.5 text-[11px] text-cream/70">
                    <x.icon size={14} className={`shrink-0 ${x.tone === "warn" && lit ? "text-amber-200" : "text-gold-soft"}`} />
                    <span className="leading-tight">{x.label}</span>
                  </span>
                  <b className={`block font-serif text-2xl leading-none tabular-nums ${x.tone === "warn" && lit ? "text-amber-200" : "text-cream"}`}>{x.value}</b>
                </>
              );
              const cls = `rounded-2xl border p-3.5 text-start backdrop-blur-sm transition ${
                x.on ? "border-gold/60 bg-cream/15 shadow-[0_0_0_1px_rgba(193,150,90,0.35)]" : "border-white/10 bg-cream/5"
              }`;
              return x.onClick ? (
                <button key={x.label} type="button" onClick={x.onClick} aria-pressed={x.on} className={`${cls} hover:border-white/25 hover:bg-cream/10`}>
                  {body}
                </button>
              ) : (
                <div key={x.label} className={cls}>
                  {body}
                </div>
              );
            })}
          </div>

          {/* The set by level, at a glance. */}
          {all.length > 0 && (
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-cream/10" role="img" aria-label={t("admin.struct.specs.byLevel")}>
              {SPEC_LEVELS.map((l) =>
                totals[l] ? <span key={l} className={`${LEVEL_STYLE[l].bar} h-full`} style={{ width: `${(totals[l] / all.length) * 100}%` }} title={`${t(`admin.proj.level.${l}`)}: ${totals[l]}`} /> : null,
              )}
            </div>
          )}
        </div>
      </section>

      <NodeToolbar
        query={search}
        onQuery={setSearch}
        placeholder={t("admin.searchSpecialization")}
        sort={sort}
        onSort={(v) => update({ sort: v === "name" ? "" : v })}
        sortOptions={[
          { value: "name", label: t("admin.sortNameAsc") },
          { value: "students", label: t("admin.struct.sortStudents") },
          { value: "topics", label: t("admin.struct.sortTopics") },
        ]}
        chips={[
          { value: "", label: t("admin.struct.all"), count: scoped.length },
          ...SPEC_LEVELS.map((l) => ({ value: l, label: t(`admin.proj.level.${l}`), count: scoped.filter((s) => s.level === l).length })),
        ]}
        chip={level}
        onChip={(v) => update({ level: v })}
        shown={filtered.length}
        total={all.length}
        extra={
          <>
            <div className="w-full sm:w-52">
              <Select
                value={facultyId}
                icon={Building2}
                filter
                aria-label={t("admin.faculty")}
                onChange={(v) => update({ faculty: v, filiere: "" })}
                options={[
                  { value: "", label: t("admin.allFaculties"), count: all.length },
                  ...facultyOptions.map((f) => ({
                    value: f.id,
                    label: f.name,
                    hint: t("admin.struct.n.departments", { count: f.depts.size }),
                    count: f.count,
                  })),
                ]}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                value={filiereId}
                icon={GitBranch}
                filter
                aria-label={t("admin.filiere")}
                onChange={(v) => update({ filiere: v })}
                options={[
                  { value: "", label: t("admin.allFilieres"), count: filiereOptions.reduce((n, f) => n + f.count, 0) },
                  ...filiereOptions.map((f) => ({ value: f.id, label: f.name, hint: f.hint || undefined, count: f.count })),
                ]}
              />
            </div>
            <div className="flex h-11 items-center rounded-xl border border-forest/15 p-1" role="group" aria-label={t("admin.struct.view")}>
              <ViewBtn on={view === "cards"} onClick={() => update({ view: "", page: page > 1 ? String(page) : "" })} icon={LayoutGrid} label={t("admin.struct.viewCards")} />
              <ViewBtn on={view === "table"} onClick={() => update({ view: "table", page: page > 1 ? String(page) : "" })} icon={Rows3} label={t("admin.struct.viewTable")} />
            </div>
          </>
        }
      />
      {active.length > 0 && (
        <div className="-mt-3 mb-4 flex justify-end">
          <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-gold transition hover:bg-gold/10">
            <FilterX size={13} />
            {t("admin.proj.clearAll")}
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingArea className="py-16" />
      ) : isError ? (
        <ErrorRetry title={t("admin.specsLoadFailed")} onRetry={() => refetch()} />
      ) : all.length === 0 ? (
        <EmptyLevel icon={GraduationCap} title={t("admin.noSpecializations")} hint={t("admin.struct.emptyHint.spec")} actionLabel={t("admin.addSpecialization")} onAction={() => setPicking(true)} />
      ) : items.length === 0 ? (
        <EmptyLevel icon={FilterX} title={t("admin.noFilterResults")} />
      ) : view === "table" ? (
        <SpecTable
          items={items}
          offset={(Math.min(page, pages) - 1) * PAGE_SIZE}
          chainOf={chainOf}
          lang={lang}
          onEdit={setEditing}
          onDelete={setRemoving}
          blockedOf={blockedOf}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5" data-testid="spec-grid">
          {items.map((s) => {
            const c = chainOf(s);
            return (
              <NodeCard
                key={s.id}
                testId="spec-card"
                to={`/admin/specializations/${s.id}`}
                icon={GraduationCap}
                iconTint={LEVEL_STYLE[s.level]?.tile}
                coverUrl={s.coverUrl}
                title={s.name}
                badge={<LevelChip level={s.level} />}
                meta={<Chain c={c} lang={lang} />}
                stats={[
                  { icon: Users, label: t("admin.struct.students"), value: students(s) },
                  { icon: BookOpen, label: t("admin.struct.topics"), value: topics(s) },
                ]}
                health={
                  students(s) === 0
                    ? { tone: "info", label: t("admin.struct.health.noStudents"), detail: t("admin.struct.health.noStudentsHint") }
                    : topics(s) === 0
                      ? { tone: "info", label: t("admin.struct.health.noTopics"), detail: t("admin.struct.health.noTopicsHint") }
                      : null
                }
                onEdit={() => setEditing(s)}
                onDelete={() => setRemoving(s)}
                deleteBlocked={blockedOf(s)}
              />
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <PageBtn disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} label={t("admin.proj.prev")}>
            <ChevronRight size={16} className="ltr:rotate-180" />
          </PageBtn>
          {pageWindow(page, pages).map((n, i) =>
            n === 0 ? (
              <span key={`gap-${i}`} className="px-1 text-clay">
                …
              </span>
            ) : (
            <button
              key={n}
              type="button"
              onClick={() => update({ page: n === 1 ? "" : String(n) })}
              aria-current={n === page ? "page" : undefined}
              className={`grid size-9 place-items-center rounded-xl text-sm font-semibold tabular-nums transition ${
                n === page ? "bg-gold text-forest-deep shadow-sm" : "border border-forest/12 text-forest hover:bg-forest/5"
              }`}
            >
              {n}
            </button>
            ),
          )}
          <PageBtn disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} label={t("admin.proj.next")}>
            <ChevronLeft size={16} className="ltr:rotate-180" />
          </PageBtn>
        </div>
      )}

      <FilierePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          setPicking(false);
          setCreateFor(id);
        }}
      />
      <SpecializationFormDialog open={!!createFor} onClose={() => setCreateFor("")} specialization={null} filiereId={createFor} />
      <SpecializationFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        specialization={editing}
        filiereId={editing?.filiereId ?? editing?.filiere?.id ?? ""}
      />
      <DeleteNodeDialog
        target={removing}
        title={t("admin.struct.deleteTitle.spec")}
        loading={deleteSpec.isPending}
        onConfirm={() => removing && deleteSpec.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────── */

/** The pages to offer: the first, the last, and those around the current one (0 = a gap). */
function pageWindow(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: number[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(0);
    out.push(n);
  });
  return out;
}

function LevelChip({ level }: { level: string }) {
  const { t } = useTranslation();
  return <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${LEVEL_STYLE[level]?.chip ?? ""}`}>{t(`admin.proj.level.${level}`)}</span>;
}

/** Faculty › department › filiere, each one a link when it has a page. */
function Chain({ c, lang }: { c: ReturnType<typeof specChain>; lang?: string }) {
  const part = (label: string | undefined, url: string | undefined, strong?: boolean): ReactNode =>
    label ? (
      url ? (
        <Link to={`/${lang}${url}`} className={`transition hover:text-gold ${strong ? "font-semibold text-forest" : ""}`}>
          {label}
        </Link>
      ) : (
        <span className={strong ? "font-semibold text-forest" : ""}>{label}</span>
      )
    ) : (
      <span>—</span>
    );
  return (
    <span className="flex flex-wrap items-center gap-1">
      {part(c.faculty?.name, c.facultyUrl)}
      <ChevronLeft size={10} className="text-clay/40 ltr:rotate-180" />
      {part(c.dept?.name, c.deptUrl)}
      <ChevronLeft size={10} className="text-clay/40 ltr:rotate-180" />
      {part(c.filiere?.name, c.filiereUrl, true)}
    </span>
  );
}

function SpecTable({
  items,
  offset,
  chainOf,
  lang,
  onEdit,
  onDelete,
  blockedOf,
}: {
  items: Specialization[];
  offset: number;
  chainOf: (s: Specialization) => ReturnType<typeof specChain>;
  lang?: string;
  onEdit: (s: Specialization) => void;
  onDelete: (s: Specialization) => void;
  blockedOf: (s: Specialization) => string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[12.5px]" data-testid="spec-table">
          <thead className="border-b border-forest/10 bg-cream-2/60">
            <tr className="text-start text-[11px] font-bold tracking-wide text-clay">
              <th className="w-12 px-4 py-3 text-center">#</th>
              <th className="px-4 py-3 text-start">{t("admin.specialization")}</th>
              <th className="px-4 py-3 text-start">{t("admin.struct.specs.chain")}</th>
              <th className="px-4 py-3 text-center">{t("admin.struct.students")}</th>
              <th className="px-4 py-3 text-center">{t("admin.struct.topics")}</th>
              <th className="w-32 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/6">
            {items.map((s, i) => {
              const blocked = blockedOf(s);
              return (
                <tr key={s.id} className="transition hover:bg-gold/[0.04]">
                  <td className="px-4 py-3 text-center text-[11px] text-clay tabular-nums">{offset + i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${LEVEL_STYLE[s.level]?.tile ?? ""}`}>
                        <GraduationCap size={16} />
                      </span>
                      <div className="min-w-0">
                        <Link to={`/${lang}/admin/specializations/${s.id}`} className="block truncate font-semibold text-forest transition hover:text-gold">
                          {s.name}
                        </Link>
                        <LevelChip level={s.level} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11.5px] text-clay">
                    <Chain c={chainOf(s)} lang={lang} />
                  </td>
                  <td className={`px-4 py-3 text-center font-serif text-[15px] font-bold tabular-nums ${(s._count?.students ?? 0) === 0 ? "text-amber-600 dark:text-amber-300" : "text-forest"}`}>
                    {s._count?.students ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center font-serif text-[15px] font-bold text-forest tabular-nums">{s._count?.topics ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/${lang}/admin/specializations/${s.id}`}
                        title={t("admin.viewDetails")}
                        aria-label={t("admin.viewDetails")}
                        className="grid size-8 place-items-center rounded-lg bg-gold/12 text-gold transition hover:bg-gold/25"
                      >
                        <Eye size={15} />
                      </Link>
                      <button type="button" onClick={() => onEdit(s)} title={t("admin.edit")} aria-label={t("admin.edit")} className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest">
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(s)}
                        disabled={!!blocked}
                        title={blocked ?? t("admin.delete")}
                        aria-label={blocked ?? t("admin.delete")}
                        className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-clay disabled:opacity-45"
                      >
                        {blocked ? <Lock size={14} /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A specialization belongs to a filiere, so adding one from this page starts
 * by choosing where it goes — the filieres listed with their chain.
 */
function FilierePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (filiereId: string) => void }) {
  const { t } = useTranslation();
  const { data: filieres } = useFilieres();
  const { data: faculties } = useFaculties();
  const [id, setId] = useState("");
  const facultyName = useMemo(() => new Map((faculties ?? []).map((f) => [f.id, f.name])), [faculties]);
  const options = useMemo(
    () =>
      (filieres ?? [])
        .map((f) => ({
          value: f.id,
          label: f.name,
          hint: [f.department?.name, f.department ? facultyName.get(f.department.facultyId) : undefined].filter(Boolean).join(" · ") || undefined,
          count: f._count?.specializations ?? 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, i18n.language)),
    [filieres, facultyName],
  );

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t("admin.addSpecialization")}
      subtitle={t("admin.struct.specs.pickFiliere")}
      icon={GitBranch}
      size="md"
      footer={
        <>
          <button
            type="button"
            disabled={!id}
            onClick={() => onPick(id)}
            data-testid="spec-pick-continue"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t("admin.yearArchive.close.continue")}
            <ChevronLeft size={16} className="ltr:rotate-180" />
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5">
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      {options.length === 0 ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-4 text-[12.5px] text-forest">{t("admin.struct.specs.noFilieres")}</p>
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-forest">{t("admin.filiere")}</span>
          <Select value={id} icon={GitBranch} onChange={setId} placeholder={t("admin.struct.specs.chooseFiliere")} options={[{ value: "", label: t("admin.struct.specs.chooseFiliere") }, ...options]} />
        </label>
      )}
    </FormDialog>
  );
}

function ViewBtn({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      className={`inline-flex h-full items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition ${
        on ? "bg-forest text-cream dark:bg-gold/15 dark:text-gold" : "text-clay hover:bg-forest/5 hover:text-forest"
      }`}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function PageBtn({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="grid size-9 place-items-center rounded-xl border border-forest/12 text-forest transition hover:bg-forest/5 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
