import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  GitBranch,
  GraduationCap,
  Layers,
  Network,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Department, Domain, Faculty, Filiere, Specialization } from "../../../../types/admin";
import { matchesQuery, type StructureReach } from "../../lib/structure-stats";

/**
 * The whole structure at once: faculty → department → domain → filiere →
 * specialization, each with its figures and a door to its page.
 *
 * A search shows the branches that lead to a match and opens them; when an
 * entry itself matches, everything under it is shown. Filieres that belong to
 * a department but to no domain are listed apart — they are reachable from no
 * domain page, which is exactly what an administrator should see.
 */

type Kind = "faculty" | "department" | "domain" | "filiere" | "spec";

const KIND: Record<Kind, { icon: LucideIcon; tile: string }> = {
  faculty: { icon: Building2, tile: "bg-linear-to-br from-forest to-forest-deep text-gold-soft border-gold/25" },
  department: { icon: Network, tile: "bg-sky-500/12 text-sky-600 dark:text-sky-300 border-sky-400/25" },
  domain: { icon: Layers, tile: "bg-violet-500/12 text-violet-600 dark:text-violet-300 border-violet-400/25" },
  filiere: { icon: GitBranch, tile: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border-emerald-400/25" },
  spec: { icon: GraduationCap, tile: "bg-gold/15 text-gold border-gold/30" },
};

function groupBy<T>(items: T[], key: (x: T) => string | null | undefined) {
  const m = new Map<string, T[]>();
  for (const x of items) {
    const k = key(x);
    if (!k) continue;
    const arr = m.get(k) ?? [];
    arr.push(x);
    m.set(k, arr);
  }
  return m;
}

export function StructureTree({
  faculties,
  departments,
  domains,
  filieres,
  specs,
  reach,
  query,
}: {
  faculties: Faculty[];
  departments: Department[];
  domains: Domain[];
  filieres: Filiere[];
  specs: Specialization[];
  reach: StructureReach;
  query: string;
}) {
  const { t } = useTranslation();
  const { lang } = useParams();
  const idx = useMemo(
    () => ({
      depts: groupBy(departments, (d) => d.facultyId ?? d.faculty?.id),
      domains: groupBy(domains, (d) => d.departmentId),
      filsByDomain: groupBy(filieres, (f) => f.domainId ?? null),
      filsLoose: groupBy(
        filieres.filter((f) => !f.domainId),
        (f) => f.departmentId,
      ),
      specs: groupBy(specs, (s) => s.filiereId ?? s.filiere?.id),
    }),
    [departments, domains, filieres, specs],
  );

  const [open, setOpen] = useState<Set<string>>(() => new Set(faculties.map((f) => `faculty:${f.id}`)));
  const searching = query.trim().length > 0;
  const isOpen = (k: string) => searching || open.has(k);
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const allKeys = useMemo(
    () => [
      ...faculties.map((f) => `faculty:${f.id}`),
      ...departments.map((d) => `department:${d.id}`),
      ...domains.map((d) => `domain:${d.id}`),
      ...filieres.map((f) => `filiere:${f.id}`),
      ...departments.map((d) => `loose:${d.id}`),
    ],
    [faculties, departments, domains, filieres],
  );

  const href = (p: string) => `/${lang}${p}`;

  // Each level returns null when neither it nor anything below it matches.
  // A match on an entry hands an empty query down: its whole subtree shows.
  const specNode = (s: Specialization, q: string) => {
    if (q && !matchesQuery(q, s.name)) return null;
    return (
      <Row
        key={s.id}
        kind="spec"
        name={s.name}
        badge={<span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-bold text-gold">{t(`admin.proj.level.${s.level}`)}</span>}
        meta={t("admin.struct.tree.students", { count: s._count?.students ?? 0 })}
        to={href(`/admin/specializations/${s.id}`)}
      />
    );
  };

  const filiereNode = (fl: Filiere, base: string | null, q: string) => {
    const self = !q || matchesQuery(q, fl.name, fl.code);
    const kids = (idx.specs.get(fl.id) ?? []).map((s) => specNode(s, self ? "" : q)).filter(Boolean);
    if (!self && kids.length === 0) return null;
    const r = reach.filiere(fl.id);
    const k = `filiere:${fl.id}`;
    return (
      <Row
        key={fl.id}
        kind="filiere"
        name={fl.name}
        code={fl.code}
        meta={t("admin.struct.tree.specsStudents", { specs: r.specializations, students: r.students })}
        warn={r.specializations === 0 ? t("admin.struct.health.filiereEmpty") : undefined}
        to={base ? href(`${base}/filieres/${fl.id}`) : undefined}
        open={isOpen(k)}
        onToggle={kids.length ? () => toggle(k) : undefined}
      >
        {kids}
      </Row>
    );
  };

  const domainNode = (dm: Domain, base: string, q: string) => {
    const self = !q || matchesQuery(q, dm.name, dm.code);
    const url = `${base}/domains/${dm.id}`;
    const kids = (idx.filsByDomain.get(dm.id) ?? []).map((fl) => filiereNode(fl, url, self ? "" : q)).filter(Boolean);
    if (!self && kids.length === 0) return null;
    const r = reach.domain(dm.id);
    const k = `domain:${dm.id}`;
    return (
      <Row
        key={dm.id}
        kind="domain"
        name={dm.name}
        code={dm.code}
        meta={t("admin.struct.tree.filieresSpecs", { filieres: dm._count?.filieres ?? 0, specs: r.specializations })}
        warn={(dm._count?.filieres ?? 0) === 0 ? t("admin.struct.health.domainEmpty") : undefined}
        to={href(url)}
        open={isOpen(k)}
        onToggle={kids.length ? () => toggle(k) : undefined}
      >
        {kids}
      </Row>
    );
  };

  const deptNode = (d: Department, facultyId: string, q: string) => {
    const self = !q || matchesQuery(q, d.name, d.code);
    const base = `/admin/faculties/${facultyId}/departments/${d.id}`;
    const doms = (idx.domains.get(d.id) ?? []).map((dm) => domainNode(dm, base, self ? "" : q)).filter(Boolean);
    const loose = (idx.filsLoose.get(d.id) ?? []).map((fl) => filiereNode(fl, null, self ? "" : q)).filter(Boolean);
    if (!self && doms.length === 0 && loose.length === 0) return null;
    const r = reach.department(d.id);
    const k = `department:${d.id}`;
    const lk = `loose:${d.id}`;
    return (
      <Row
        key={d.id}
        kind="department"
        name={d.name}
        code={d.code}
        meta={t("admin.struct.tree.deptMeta", { domains: d._count?.domains ?? 0, specs: r.specializations, professors: d._count?.professors ?? 0 })}
        warn={(d._count?.filieres ?? 0) === 0 ? t("admin.struct.health.deptEmpty") : undefined}
        to={href(base)}
        open={isOpen(k)}
        onToggle={doms.length || loose.length ? () => toggle(k) : undefined}
      >
        {doms}
        {loose.length > 0 && (
          <li>
            <button
              type="button"
              onClick={() => toggle(lk)}
              className="my-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200"
            >
              <TriangleAlert size={12} />
              {t("admin.struct.tree.loose", { count: loose.length })}
              <ChevronDown size={12} className={`transition ${isOpen(lk) ? "rotate-180" : ""}`} />
            </button>
            {isOpen(lk) && <ul className="ms-4 border-s border-dashed border-amber-400/40 ps-3">{loose}</ul>}
          </li>
        )}
      </Row>
    );
  };

  const tree = faculties
    .map((f) => {
      const self = !query || matchesQuery(query, f.name, f.code);
      const kids = (idx.depts.get(f.id) ?? []).map((d) => deptNode(d, f.id, self ? "" : query)).filter(Boolean);
      if (!self && kids.length === 0) return null;
      const r = reach.faculty(f.id);
      const k = `faculty:${f.id}`;
      return (
        <Row
          key={f.id}
          kind="faculty"
          iconUrl={f.iconUrl}
          name={f.name}
          code={f.code}
          meta={t("admin.struct.tree.facultyMeta", { departments: f._count?.departments ?? 0, specs: r.specializations, students: r.students })}
          warn={(f._count?.departments ?? 0) === 0 ? t("admin.gapNoDepartments") : undefined}
          to={href(`/admin/faculties/${f.id}`)}
          open={isOpen(k)}
          onToggle={kids.length ? () => toggle(k) : undefined}
          top
        >
          {kids}
        </Row>
      );
    })
    .filter(Boolean);

  return (
    <section className="rounded-3xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)] lg:p-5" data-testid="structure-tree">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-clay">
          {(Object.keys(KIND) as Kind[]).map((k) => {
            const K = KIND[k];
            return (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-forest/10 bg-cream-2/50 px-2 py-0.5">
                <span className={`grid size-4 place-items-center rounded border ${K.tile}`}>
                  <K.icon size={10} />
                </span>
                {t(`admin.struct.kind.${k}`)}
              </span>
            );
          })}
        </div>
        {!searching && (
          <div className="flex gap-1.5">
            <TreeBtn icon={ChevronsUpDown} onClick={() => setOpen(new Set(allKeys))}>
              {t("admin.yearArchive.expandAll")}
            </TreeBtn>
            <TreeBtn icon={ChevronsDownUp} onClick={() => setOpen(new Set())}>
              {t("admin.yearArchive.collapseAll")}
            </TreeBtn>
          </div>
        )}
      </div>
      {tree.length === 0 ? (
        <p className="rounded-2xl bg-forest/5 py-10 text-center text-sm text-clay">{t("admin.noFilterResults")}</p>
      ) : (
        <ul className="space-y-1.5">{tree}</ul>
      )}
    </section>
  );
}

function TreeBtn({ icon: Icon, onClick, children }: { icon: LucideIcon; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-forest/12 px-3 py-1 text-[11.5px] font-semibold text-clay transition hover:border-gold/40 hover:text-forest"
    >
      <Icon size={13} className="text-gold" />
      {children}
    </button>
  );
}

function Row({
  kind,
  name,
  code,
  iconUrl,
  badge,
  meta,
  warn,
  to,
  open,
  onToggle,
  top,
  children,
}: {
  kind: Kind;
  name: string;
  code?: string | null;
  iconUrl?: string | null;
  badge?: ReactNode;
  meta?: string;
  warn?: string;
  to?: string;
  open?: boolean;
  onToggle?: () => void;
  top?: boolean;
  children?: ReactNode;
}) {
  const K = KIND[kind];
  return (
    <li>
      <div
        className={`group flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition hover:bg-gold/[0.06] ${
          top ? "border border-forest/10 bg-cream-2/40 py-2.5" : ""
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          aria-expanded={onToggle ? !!open : undefined}
          className="grid size-6 shrink-0 place-items-center rounded-md text-clay transition hover:bg-forest/8 hover:text-forest disabled:opacity-0"
        >
          <ChevronDown size={15} className={`transition-transform duration-300 ${open ? "" : "ltr:-rotate-90 rtl:rotate-90"}`} />
        </button>
        <span className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border ${top ? "size-9" : "size-7"} ${iconUrl ? "border-forest/10 bg-cream-card" : K.tile}`}>
          {iconUrl ? <img src={iconUrl} alt="" className="size-full object-contain" /> : <K.icon size={top ? 17 : 14} />}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          {to ? (
            <Link to={to} className={`truncate font-semibold text-forest transition hover:text-gold ${top ? "font-serif text-[15px]" : "text-[13px]"}`}>
              {name}
            </Link>
          ) : (
            <span className="truncate text-[13px] font-semibold text-forest">{name}</span>
          )}
          {code && (
            <span dir="ltr" className="font-mono text-[10px] font-bold tracking-wider text-gold">
              {code}
            </span>
          )}
          {badge}
          {warn && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">
              <TriangleAlert size={11} />
              {warn}
            </span>
          )}
        </div>
        {meta && (
          <span className="hidden shrink-0 items-center gap-1 text-[11px] text-clay md:inline-flex">
            {kind === "spec" && <Users size={11} />}
            {meta}
          </span>
        )}
        {to && (
          <Link to={to} aria-label={name} className="grid size-7 shrink-0 place-items-center rounded-lg text-clay opacity-0 transition group-hover:opacity-100 hover:bg-gold/15 hover:text-gold focus:opacity-100">
            <ExternalLink size={13} />
          </Link>
        )}
      </div>
      {/* `onToggle` exists only when there is something below to open. */}
      {open && onToggle && <ul className="ms-5 mt-0.5 space-y-0.5 border-s border-forest/10 ps-3">{children}</ul>}
    </li>
  );
}
