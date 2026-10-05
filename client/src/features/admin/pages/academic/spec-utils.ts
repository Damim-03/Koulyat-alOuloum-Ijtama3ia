import type { Faculty, Specialization } from "../../../../types/admin";

/**
 * Where a specialization sits — faculty › department › domain › filiere —
 * with the page of each level, so every mention of the chain can open it.
 *
 * The filiere page lives under its domain; a filiere with no domain has no
 * page of its own, and its link is left out rather than pointing nowhere.
 */
export function specChain(s: Specialization, facultyById: Map<string, Faculty>) {
  const filiere = s.filiere as (Specialization["filiere"] & { domainId?: string | null }) | undefined;
  const dept = filiere?.department;
  const faculty = dept ? facultyById.get(dept.facultyId) : undefined;
  const facultyUrl = faculty ? `/admin/faculties/${faculty.id}` : undefined;
  const deptUrl = facultyUrl && dept ? `${facultyUrl}/departments/${dept.id}` : undefined;
  const domainUrl = deptUrl && filiere?.domainId ? `${deptUrl}/domains/${filiere.domainId}` : undefined;
  const filiereUrl = domainUrl && filiere ? `${domainUrl}/filieres/${filiere.id}` : undefined;
  return { faculty, dept, filiere, facultyUrl, deptUrl, domainUrl, filiereUrl, domainId: filiere?.domainId ?? null };
}

export const SPEC_LEVELS = ["licence", "master", "doctorate"] as const;

/** Each level's colour, in both themes — tile, chip and bar. */
export const LEVEL_STYLE: Record<string, { tile: string; chip: string; bar: string }> = {
  licence: {
    tile: "border-sky-400/30 bg-sky-500/12 text-sky-600 dark:text-sky-300",
    chip: "border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  master: {
    tile: "border-gold/35 bg-gold/15 text-gold",
    chip: "border-gold/35 bg-gold/12 text-gold",
    bar: "bg-gold",
  },
  doctorate: {
    tile: "border-violet-400/30 bg-violet-500/12 text-violet-600 dark:text-violet-300",
    chip: "border-violet-400/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
  },
};
