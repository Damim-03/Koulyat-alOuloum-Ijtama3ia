import { prisma } from "../prisma/client";

/**
 * ============================================================
 * WHAT A CHANGE WAS ABOUT
 * ============================================================
 *
 * The audit log writes a change as the route that made it (core/audit). That
 * says what kind of thing was changed, not which one, nor how. Here each kind
 * has a reader that takes one item as a person would describe it: its name
 * (the row's `targetLabel`, kept after the item is gone) and its fields, with
 * the items it points to by name instead of by id — the student's
 * specialization, the topic's professor, the members of a project.
 *
 * Read before a change and after it, two readings give what changed, field by
 * field (`changesOf`). Only what a person may read goes in: no password, no
 * two-step secret, no token, no private photo file.
 */

export type Fields = Record<string, unknown>;
export interface Snapshot {
  label: string | null;
  fields: Fields;
}
export interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

type Named = {
  firstName?: string | null;
  lastName?: string | null;
  firstNameLatin?: string | null;
  lastNameLatin?: string | null;
};

const NAME = { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } as const;

/** A person's name: in Arabic, else in Latin letters. */
export const nameOf = (u?: Named | null): string | null =>
  u
    ? [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      [u.firstNameLatin, u.lastNameLatin].filter(Boolean).join(" ") ||
      null
    : null;

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ").slice(0, 191) || null;

const ACCOUNT = {
  ...NAME,
  email: true,
  username: true,
  phone: true,
  gender: true,
  role: true,
  status: true,
  isVerified: true,
  mustChangePassword: true,
  avatarUrl: true,
  totpEnabledAt: true,
} as const;

type Account = Named & {
  email: string | null;
  username: string | null;
  phone: string | null;
  gender: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  mustChangePassword: boolean;
  avatarUrl: string | null;
  totpEnabledAt: Date | null;
};

const accountFields = (u: Account): Fields => ({
  firstName: u.firstName ?? null,
  lastName: u.lastName ?? null,
  firstNameLatin: u.firstNameLatin ?? null,
  lastNameLatin: u.lastNameLatin ?? null,
  email: u.email,
  username: u.username,
  phone: u.phone,
  gender: u.gender,
  role: u.role,
  status: u.status,
  isVerified: u.isVerified,
  mustChangePassword: u.mustChangePassword,
  avatarUrl: u.avatarUrl,
  twoFactor: !!u.totpEnabledAt,
});

/** Names in a stable order: a list read twice compares equal when nothing changed. */
const names = (list: (string | null)[]) => list.filter((n): n is string => !!n).sort((a, b) => a.localeCompare(b));

const PERSON = { select: { registrationNumber: true, user: { select: NAME } } } as const;
const personName = (s: { registrationNumber: string; user: Named }) => nameOf(s.user) ?? s.registrationNumber;
const PROFESSOR = { select: { user: { select: NAME } } } as const;

/** Reads one item of each kind, by the first segment of the route that changes it. */
const READERS: Record<string, (id: string) => Promise<Snapshot | null>> = {
  users: async (id) => {
    const u = await prisma.user.findUnique({
      where: { id },
      select: {
        ...ACCOUNT,
        student: { select: { registrationNumber: true } },
        professor: { select: { universityEmail: true } },
      },
    });
    if (!u) return null;
    return {
      label: join(nameOf(u), u.email ?? u.professor?.universityEmail ?? u.student?.registrationNumber ?? u.username),
      fields: accountFields(u),
    };
  },

  students: async (id) => {
    const s = await prisma.student.findUnique({
      where: { id },
      select: {
        registrationNumber: true,
        user: { select: ACCOUNT },
        specialization: { select: { name: true } },
        academicYear: { select: { title: true } },
      },
    });
    if (!s) return null;
    return {
      label: join(nameOf(s.user), s.registrationNumber),
      fields: {
        ...accountFields(s.user),
        registrationNumber: s.registrationNumber,
        specialization: s.specialization.name,
        academicYear: s.academicYear.title,
      },
    };
  },

  professors: async (id) => {
    const p = await prisma.professor.findUnique({
      where: { id },
      select: {
        employeeNumber: true,
        universityEmail: true,
        grade: true,
        tags: true,
        user: { select: ACCOUNT },
        department: { select: { name: true } },
      },
    });
    if (!p) return null;
    return {
      label: join(nameOf(p.user), p.universityEmail),
      fields: {
        ...accountFields(p.user),
        employeeNumber: p.employeeNumber,
        universityEmail: p.universityEmail,
        department: p.department.name,
        rank: p.grade ?? null,
        tags: p.tags ?? null,
      },
    };
  },

  faculties: async (id) => {
    const f = await prisma.faculty.findUnique({
      where: { id },
      select: { name: true, nameLatin: true, code: true, coverUrl: true, iconUrl: true },
    });
    return f && { label: f.name, fields: { ...f } };
  },

  departments: async (id) => {
    const d = await prisma.department.findUnique({
      where: { id },
      select: { name: true, nameLatin: true, code: true, coverUrl: true, faculty: { select: { name: true } } },
    });
    return (
      d && {
        label: d.name,
        fields: { name: d.name, nameLatin: d.nameLatin, code: d.code, coverUrl: d.coverUrl, faculty: d.faculty.name },
      }
    );
  },

  "topic-types": async (id) => {
    const t = await prisma.topicType.findUnique({
      where: { id },
      select: { name: true, code: true, color: true, sortOrder: true, department: { select: { name: true } } },
    });
    return (
      t && {
        label: join(t.code, t.name),
        fields: { name: t.name, code: t.code, color: t.color, sortOrder: t.sortOrder, department: t.department.name },
      }
    );
  },

  domains: async (id) => {
    const d = await prisma.domain.findUnique({
      where: { id },
      select: { name: true, code: true, coverUrl: true, department: { select: { name: true } } },
    });
    return d && { label: d.name, fields: { name: d.name, code: d.code, coverUrl: d.coverUrl, department: d.department.name } };
  },

  filieres: async (id) => {
    const f = await prisma.filiere.findUnique({
      where: { id },
      select: {
        name: true,
        code: true,
        coverUrl: true,
        department: { select: { name: true } },
        domain: { select: { name: true } },
      },
    });
    return (
      f && {
        label: f.name,
        fields: { name: f.name, code: f.code, coverUrl: f.coverUrl, department: f.department.name, domain: f.domain?.name ?? null },
      }
    );
  },

  specializations: async (id) => {
    const s = await prisma.specialization.findUnique({
      where: { id },
      select: { name: true, level: true, coverUrl: true, filiere: { select: { name: true } } },
    });
    return s && { label: s.name, fields: { name: s.name, level: s.level, coverUrl: s.coverUrl, filiere: s.filiere.name } };
  },

  "academic-years": async (id) => {
    const y = await prisma.academicYear.findUnique({
      where: { id },
      select: {
        title: true,
        isActive: true,
        archivedAt: true,
        proposalsOpenAt: true,
        proposalsCloseAt: true,
        selectionOpenAt: true,
        selectionCloseAt: true,
        teamSizes: true,
        maxTopicsPerProfessor: true,
      },
    });
    return y && { label: y.title, fields: { ...y } };
  },

  topics: async (id) => {
    const t = await prisma.graduationTopic.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        status: true,
        maxStudents: true,
        maxRequests: true,
        rejectionReason: true,
        publishedAt: true,
        requirements: true,
        objectives: true,
        references: true,
        summary: true,
        professor: PROFESSOR,
        coSupervisor: PROFESSOR,
        type: { select: { code: true, name: true } },
        specialization: { select: { name: true } },
        academicYear: { select: { title: true } },
        projectGroup: { select: { members: { select: { student: PERSON } } } },
      },
    });
    if (!t) return null;
    return {
      label: t.title,
      fields: {
        title: t.title,
        description: t.description,
        status: t.status,
        maxStudents: t.maxStudents,
        maxRequests: t.maxRequests,
        rejectionReason: t.rejectionReason,
        publishedAt: t.publishedAt,
        requirements: t.requirements ?? null,
        objectives: t.objectives ?? null,
        references: t.references ?? null,
        summary: t.summary ?? null,
        professor: nameOf(t.professor.user),
        coSupervisor: t.coSupervisor ? nameOf(t.coSupervisor.user) : null,
        type: t.type ? join(t.type.code, t.type.name) : null,
        specialization: t.specialization.name,
        academicYear: t.academicYear.title,
        students: t.projectGroup ? names(t.projectGroup.members.map((m) => personName(m.student))) : null,
      },
    };
  },

  "group-requests": async (id) => {
    const r = await prisma.groupRequest.findUnique({
      where: { id },
      select: {
        status: true,
        priority: true,
        rejectionReason: true,
        topic: { select: { title: true } },
        leader: PERSON,
        members: { select: { student: PERSON } },
      },
    });
    if (!r) return null;
    const leader = personName(r.leader);
    return {
      label: join(r.topic.title, leader),
      fields: {
        topic: r.topic.title,
        leader,
        members: names(r.members.map((m) => personName(m.student))),
        status: r.status,
        priority: r.priority,
        rejectionReason: r.rejectionReason,
      },
    };
  },

  projects: async (id) => {
    const g = await prisma.projectGroup.findUnique({
      where: { id },
      select: {
        topic: { select: { title: true, professor: PROFESSOR } },
        members: { select: { isLeader: true, student: PERSON } },
      },
    });
    if (!g) return null;
    const leader = g.members.find((m) => m.isLeader);
    return {
      label: g.topic.title,
      fields: {
        topic: g.topic.title,
        supervisor: nameOf(g.topic.professor.user),
        members: names(g.members.map((m) => personName(m.student))),
        leader: leader ? personName(leader.student) : null,
      },
    };
  },

  milestones: async (id) => {
    const m = await prisma.milestone.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        deadline: true,
        status: true,
        order: true,
        group: { select: { topic: { select: { title: true } } } },
      },
    });
    if (!m) return null;
    const { group, ...rest } = m;
    return { label: m.title, fields: { ...rest, project: group.topic.title } };
  },

  defenses: async (id) => {
    const d = await prisma.defense.findUnique({
      where: { id },
      select: {
        date: true,
        durationMinutes: true,
        room: true,
        grade: true,
        status: true,
        notes: true,
        group: { select: { topic: { select: { title: true } } } },
        committee: { select: { role: true, professor: PROFESSOR } },
      },
    });
    if (!d) return null;
    const { group, committee, ...rest } = d;
    return {
      label: group.topic.title,
      fields: {
        ...rest,
        project: group.topic.title,
        committee: names(committee.map((c) => `${nameOf(c.professor.user) ?? "?"} (${c.role})`)),
      },
    };
  },

  "home-slides": async (id) => {
    const s = await prisma.homeSlide.findUnique({
      where: { id },
      select: { placement: true, imageUrl: true, caption: true, isActive: true, sortOrder: true },
    });
    return s && { label: s.caption, fields: { ...s } };
  },

  news: async (id) => {
    const n = await prisma.newsItem.findUnique({
      where: { id },
      select: { text: true, textFr: true, textEn: true, date: true, linkUrl: true, isActive: true },
    });
    return n && { label: n.text.slice(0, 120), fields: { ...n } };
  },

  "university-domains": async (id) => {
    const d = await prisma.universityDomain.findUnique({ where: { id }, select: { domain: true, isDefault: true } });
    return d && { label: d.domain, fields: { ...d } };
  },

  // A request is the student's, found by their account — and read through it:
  // an approved request is deleted, the account stays, verified.
  activation: async (userId) => {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...NAME,
        isVerified: true,
        student: { select: { registrationNumber: true } },
        activationRequest: { select: { status: true, rejectionReason: true } },
      },
    });
    if (!u) return null;
    return {
      label: join(nameOf(u), u.student?.registrationNumber),
      fields: {
        request: u.activationRequest?.status ?? null,
        rejectionReason: u.activationRequest?.rejectionReason ?? null,
        isVerified: u.isVerified,
      },
    };
  },

  // «نسيت كلمة المرور» عبر الإدارة: الطلب بالطالب (Student.id)، يُقرأ من حسابه. وكلمة
  // المرور لا تُقرأ أبداً — يكفي أن يُعرف أنّها تُستبدل عند أوّل دخول.
  "password-requests": async (studentId) => {
    const s = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        registrationNumber: true,
        user: { select: { ...NAME, mustChangePassword: true, passwordRequest: { select: { status: true, rejectionReason: true } } } },
      },
    });
    if (!s) return null;
    return {
      label: join(nameOf(s.user), s.registrationNumber),
      fields: {
        request: s.user.passwordRequest?.status ?? null,
        rejectionReason: s.user.passwordRequest?.rejectionReason ?? null,
        mustChangePassword: s.user.mustChangePassword,
      },
    };
  },

  "supervision-documents": async (id) => {
    const d = await prisma.supervisionDocument.findUnique({
      where: { id },
      select: {
        documentNumber: true,
        status: true,
        revokedAt: true,
        printedAt: true,
        printCount: true,
        topic: { select: { title: true } },
      },
    });
    if (!d) return null;
    return {
      label: join(d.documentNumber, d.topic.title),
      fields: {
        documentNumber: d.documentNumber,
        status: d.status,
        revokedAt: d.revokedAt,
        printedAt: d.printedAt,
        printCount: d.printCount,
        topic: d.topic.title,
      },
    };
  },
};

/** The pages of the site kept as one document each, under their route's name. */
export const SITE_PAGES = new Set(["director-message", "about-page", "login-page", "site-texts", "supervision-sheet", "mail-templates"]);

const MAX_DEPTH = 3;
/** A site page's document, one field per text: `ar.title`, `hero.subtitle`… */
function flatten(value: unknown, prefix = "", out: Fields = {}, depth = 0): Fields {
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && depth < MAX_DEPTH) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
  } else if (prefix) out[prefix] = value ?? null;
  return out;
}

for (const slug of SITE_PAGES) {
  READERS[slug] = async () => {
    const row = await prisma.siteContent.findUnique({ where: { slug } });
    return { label: null, fields: row ? flatten(row.value) : {} };
  };
}

/** The archive closes and reopens academic years: it reads them. */
READERS.archive = READERS["academic-years"]!;

export const isSubject = (kind: string | null | undefined): kind is string => !!kind && kind in READERS;

/** One item as a person would describe it — or null: unknown kind, gone, or unreadable. */
export async function readSubject(kind: string | null | undefined, id: string | null | undefined): Promise<Snapshot | null> {
  if (!isSubject(kind) || !id) return null;
  return (await READERS[kind]!(id)) ?? null;
}

/** A route's other ids (`/projects/:id/members/:studentId`), by the kind they name. */
const PARAM_KINDS: Record<string, { kind: string; as: string }> = {
  studentId: { kind: "students", as: "student" },
  groupId: { kind: "projects", as: "project" },
  topicId: { kind: "topics", as: "topic" },
  userId: { kind: "users", as: "user" },
};

/** The names of the other items a route names, each by what it is: `{ student: "…" }`. */
export async function refsOf(params: Record<string, unknown> | undefined): Promise<Record<string, string> | undefined> {
  const out: Record<string, string> = {};
  for (const [param, value] of Object.entries(params ?? {})) {
    const ref = PARAM_KINDS[param];
    if (!ref || typeof value !== "string") continue;
    const found = await readSubject(ref.kind, value).catch(() => null);
    out[ref.as] = found?.label ?? value;
  }
  return Object.keys(out).length ? out : undefined;
}

const MAX_CHANGES = 60;

const comparable = (v: unknown) => JSON.stringify(v instanceof Date ? v.toISOString() : (v ?? null));

/** Field by field, what is not the same in two readings of one item. */
export function changesOf(before: Fields, after: Fields): Change[] {
  const out: Change[] = [];
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (comparable(before[field]) === comparable(after[field])) continue;
    out.push({ field, from: before[field] ?? null, to: after[field] ?? null });
    if (out.length >= MAX_CHANGES) break;
  }
  return out;
}

/** What a reading holds, without its empty fields: what was created, or what was deleted. */
export function filled(fields: Fields): Fields | undefined {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * The counts in an answer — how many rows an import created, how many a year
 * archived — never its text: an answer may carry passwords handed out (the
 * account lists of an import). Numbers and yes/no at three levels at most, and
 * a list by its length.
 */
export function countsOf(body: unknown): Record<string, number | boolean> | undefined {
  const out: Record<string, number | boolean> = {};
  const walk = (v: unknown, path: string, depth: number) => {
    if (Object.keys(out).length >= 12) return;
    if (typeof v === "number" || typeof v === "boolean") {
      if (path) out[path] = v;
    } else if (Array.isArray(v)) {
      if (path) out[path] = v.length;
    } else if (v && typeof v === "object" && depth < 3) {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (k === "id" || k.endsWith("Id")) continue;
        walk(x, path ? `${path}.${k}` : k, depth + 1);
      }
    }
  };
  walk(body, "", 0);
  return Object.keys(out).length ? out : undefined;
}

/**
 * The id of what a create made, from its answer: `{ id }`, or the one item it
 * returns (`{ message, student: { id, … } }`).
 */
export function createdId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  if (typeof o.id === "string") return o.id;
  const items = Object.values(o).filter(
    (v): v is { id: string } => !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as { id?: unknown }).id === "string",
  );
  return items.length === 1 ? items[0]!.id : null;
}
