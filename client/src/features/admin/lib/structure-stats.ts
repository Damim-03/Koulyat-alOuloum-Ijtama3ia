/**
 * What each level of the academic structure reaches.
 *
 * The lists arrive with their own direct counts — a department knows its
 * filieres, a filiere its specializations — but not what lies further down:
 * how many students a faculty holds, how many topics a domain carries. Those
 * live on the specializations, the last level. This index walks them up the
 * chain once, so every card and header can say it without another request.
 *
 * Pure, like `faculty-index`: the rule is tested without a browser.
 */

export interface Reach {
  specializations: number;
  students: number;
  topics: number;
  /** Specializations by level — licence, master, doctorate. */
  levels: Record<string, number>;
}

interface SpecLite {
  id: string;
  level?: string | null;
  filiereId?: string | null;
  filiere?: { id?: string } | null;
  _count?: { students?: number; topics?: number } | null;
}
interface FiliereLite {
  id: string;
  departmentId: string;
  domainId?: string | null;
}
interface DeptLite {
  id: string;
  facultyId: string;
  _count?: { professors?: number } | null;
}

const empty = (): Reach => ({ specializations: 0, students: 0, topics: 0, levels: {} });

export interface StructureReach {
  faculty: (id: string) => Reach & { professors: number };
  department: (id: string) => Reach;
  domain: (id: string) => Reach;
  filiere: (id: string) => Reach;
  /** Everything, across the university. */
  total: Reach & { professors: number };
}

export function buildReach(departments: DeptLite[], filieres: FiliereLite[], specs: SpecLite[]): StructureReach {
  const filById = new Map(filieres.map((f) => [f.id, f]));
  const deptById = new Map(departments.map((d) => [d.id, d]));
  const maps = {
    faculty: new Map<string, Reach>(),
    department: new Map<string, Reach>(),
    domain: new Map<string, Reach>(),
    filiere: new Map<string, Reach>(),
  };
  const total = empty();

  const add = (m: Map<string, Reach>, id: string | null | undefined, s: SpecLite) => {
    if (!id) return;
    const r = m.get(id) ?? empty();
    r.specializations += 1;
    r.students += s._count?.students ?? 0;
    r.topics += s._count?.topics ?? 0;
    if (s.level) r.levels[s.level] = (r.levels[s.level] ?? 0) + 1;
    m.set(id, r);
  };

  for (const s of specs) {
    const filId = s.filiereId ?? s.filiere?.id;
    const fil = filId ? filById.get(filId) : undefined;
    add(maps.filiere, filId, s);
    add(maps.domain, fil?.domainId, s);
    add(maps.department, fil?.departmentId, s);
    add(maps.faculty, fil ? deptById.get(fil.departmentId)?.facultyId : undefined, s);
    total.specializations += 1;
    total.students += s._count?.students ?? 0;
    total.topics += s._count?.topics ?? 0;
    if (s.level) total.levels[s.level] = (total.levels[s.level] ?? 0) + 1;
  }

  const professors = new Map<string, number>();
  let allProfessors = 0;
  for (const d of departments) {
    const n = d._count?.professors ?? 0;
    professors.set(d.facultyId, (professors.get(d.facultyId) ?? 0) + n);
    allProfessors += n;
  }

  return {
    faculty: (id) => ({ ...(maps.faculty.get(id) ?? empty()), professors: professors.get(id) ?? 0 }),
    department: (id) => maps.department.get(id) ?? empty(),
    domain: (id) => maps.domain.get(id) ?? empty(),
    filiere: (id) => maps.filiere.get(id) ?? empty(),
    total: { ...total, professors: allProfessors },
  };
}

/** Case- and diacritic-blind "does any of these contain the query". */
export function matchesQuery(q: string, ...fields: (string | null | undefined)[]) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[ً-ٰٟ̀-ͯ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه");
  const needle = norm(q.trim());
  if (!needle) return true;
  return fields.some((f) => !!f && norm(f).includes(needle));
}
