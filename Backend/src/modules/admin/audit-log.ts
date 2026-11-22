import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../core/prisma/client";
import { Prisma } from "../../generated/prisma";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage } from "../../core/i18n";

/**
 * `GET /admin/audit-logs` — the audit log, newest first (core/audit), and
 * what its filters offer: who appears in it (`/actors`) and a count of the
 * last day (`/summary`).
 *
 * Read-only: no route edits or deletes a row, so a mistake — or a misdeed —
 * made from an administrator's account cannot be wiped from here afterwards.
 */

const WRITE_VERBS = ["POST ", "PATCH ", "PUT ", "DELETE "] as const;
const writes = (): Prisma.AuditLogWhereInput[] => WRITE_VERBS.map((v) => ({ action: { startsWith: v } }));

/** A change made in one's own account: `PATCH /account`, `POST /account/email`… */
const OWN_ACCOUNT: Prisma.AuditLogWhereInput = { action: { contains: " /account" } };

/**
 * The parts of the platform a row can be about. A change by the kind of item
 * it was made to (its route's first segment), an event by its name.
 */
export const AREAS = {
  accounts: {
    OR: [
      { AND: [{ targetType: { in: ["users", "students", "professors", "activation"] } }, { NOT: OWN_ACCOUNT }] },
      { action: { startsWith: "cli." } },
    ],
  },
  structure: {
    targetType: {
      in: [
        "faculties",
        "departments",
        "topic-types",
        "domains",
        "filieres",
        "specializations",
        "academic-years",
        "archive",
        "academic-structure",
        "university-domains",
      ],
    },
  },
  topics: { targetType: { in: ["topics", "group-requests", "supervision-documents"] } },
  projects: { targetType: { in: ["projects", "milestones", "defenses"] } },
  site: { targetType: { in: ["home-slides", "news", "director-message", "about-page", "login-page", "site-texts", "supervision-sheet", "mail-templates", "uploads"] } },
  signin: { OR: [{ action: { startsWith: "auth." } }, { action: "session.ended" }] },
  credentials: {
    OR: [{ action: { startsWith: "password." } }, { action: { startsWith: "twoFactor." } }, { action: { startsWith: "email." } }],
  },
  account: { OR: [OWN_ACCOUNT, { action: { startsWith: "activation." } }] },
  messages: { action: { startsWith: "message." } },
} satisfies Record<string, Prisma.AuditLogWhereInput>;
export type AuditArea = keyof typeof AREAS;

const VERBS: Record<string, Prisma.AuditLogWhereInput> = {
  create: { action: { startsWith: "POST " } },
  update: { OR: [{ action: { startsWith: "PATCH " } }, { action: { startsWith: "PUT " } }] },
  delete: { action: { startsWith: "DELETE " } },
};

const text = (max: number) => z.string().trim().max(max).optional();

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: text(120),
  /** changes: what was changed · security: sign-ins, passwords, 2FA, devices · failed: refused attempts. */
  kind: z.enum(["all", "changes", "security", "failed"]).optional().default("all"),
  area: z.enum(Object.keys(AREAS) as [AuditArea, ...AuditArea[]]).optional(),
  /** Who did it: by role — `none` for what no account did (the server console, an alert, a sign-in to no account). */
  role: z.enum(["admin", "professor", "student", "none"]).optional(),
  verb: z.enum(["create", "update", "delete"]).optional(),
  /** One operation exactly: `PATCH /students/:id`, `auth.login`. */
  action: text(120),
  actorId: text(64),
  /** One item's history: its kind, and its id. */
  targetType: text(40),
  targetId: text(64),
  ip: text(64),
  /** Where from: an ISO country code (`DZ`). */
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((c) => c.toUpperCase())
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  order: z.enum(["desc", "asc"]).optional().default("desc"),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export function auditLogWhere(q: AuditLogQuery): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (q.kind === "changes") and.push({ OR: writes() });
  if (q.kind === "security") and.push({ NOT: writes() });
  if (q.kind === "failed") and.push({ success: false });
  if (q.area) and.push(AREAS[q.area]);
  if (q.role === "none") and.push({ actorId: null, actorRole: null });
  else if (q.role) and.push({ actorRole: q.role });
  if (q.verb) and.push(VERBS[q.verb]!);
  if (q.action) and.push({ action: q.action });
  if (q.actorId) and.push({ actorId: q.actorId });
  if (q.targetType) and.push({ targetType: q.targetType });
  if (q.targetId) and.push({ targetId: q.targetId });
  if (q.ip) and.push({ ip: q.ip });
  if (q.country) and.push({ country: q.country });
  if (q.from) and.push({ createdAt: { gte: q.from } });
  if (q.to) {
    // A date alone means the whole of that day.
    const end = new Date(q.to);
    if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0) end.setUTCDate(end.getUTCDate() + 1);
    and.push({ createdAt: { lt: end } });
  }
  if (q.search) {
    const s = q.search;
    and.push({
      OR: [
        { action: { contains: s } },
        { actorLabel: { contains: s } },
        { targetLabel: { contains: s } },
        { targetId: { contains: s } },
        { targetType: { contains: s } },
        { ip: { contains: s } },
        { city: { contains: s } },
        { region: { contains: s } },
        { isp: { contains: s } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export async function listAuditLogsService(q: AuditLogQuery) {
  const where = auditLogWhere(q);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: q.order }, { id: q.order }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

//
// ─── WHO APPEARS IN THE LOG ───────────────────────────────────
//

export const auditActorsQuerySchema = z.object({
  search: text(120),
  role: z.enum(["admin", "professor", "student"]).optional(),
});

/**
 * The fifty people who appear most in the log, the most active first: for the filter
 * «who». Each with the name the log last gave them, how many rows, and when
 * the last one was.
 */
export async function listAuditActorsService(q: z.infer<typeof auditActorsQuerySchema>) {
  const where: Prisma.AuditLogWhereInput = {
    actorId: { not: null },
    ...(q.role ? { actorRole: q.role } : {}),
    ...(q.search ? { OR: [{ actorLabel: { contains: q.search } }, { actorId: q.search }] } : {}),
  };
  const groups = await prisma.auditLog.groupBy({
    by: ["actorId"],
    where,
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { actorId: "desc" } },
    take: 50,
  });
  const ids = groups.map((g) => g.actorId!).filter(Boolean);
  const latest = ids.length
    ? await prisma.auditLog.findMany({
        // Within the role asked for: someone who acted under another role since is still listed under this one.
        where: { actorId: { in: ids }, ...(q.role ? { actorRole: q.role } : {}) },
        orderBy: { createdAt: "desc" },
        distinct: ["actorId"],
        select: { actorId: true, actorLabel: true, actorRole: true },
      })
    : [];
  const byId = new Map(latest.map((r) => [r.actorId, r]));
  return {
    actors: groups.map((g) => ({
      id: g.actorId!,
      label: byId.get(g.actorId)?.actorLabel ?? null,
      role: byId.get(g.actorId)?.actorRole ?? null,
      count: g._count._all,
      lastAt: g._max.createdAt,
    })),
  };
}

//
// ─── WHERE FROM ───────────────────────────────────────────────
//

/** The countries the log's addresses are in, the most frequent first: for the filter «where from». */
export async function listAuditCountriesService() {
  const groups = await prisma.auditLog.groupBy({
    by: ["country"],
    where: { country: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { country: "desc" } },
  });
  return { countries: groups.map((g) => ({ country: g.country!, count: g._count._all })) };
}

//
// ─── THE LAST DAY ─────────────────────────────────────────────
//

/** The last 24 hours at a glance: everything, the changes, the refusals, and how many people. */
export async function auditSummaryService(now = new Date()) {
  const since = { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
  const [total, changes, failed, people] = await Promise.all([
    prisma.auditLog.count({ where: since }),
    prisma.auditLog.count({ where: { ...since, OR: writes() } }),
    prisma.auditLog.count({ where: { ...since, success: false } }),
    prisma.auditLog.groupBy({ by: ["actorId"], where: { ...since, actorId: { not: null } } }),
  ]);
  return { total, changes, failed, people: people.length };
}

//
// ─── CONTROLLERS ──────────────────────────────────────────────
//

const handle =
  <T>(schema: z.ZodType<T>, run: (q: T) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestException(issuesMessage(parsed.error.issues), ErrorCodeEnum.VALIDATION_ERROR);
      }
      return res.status(HTTPSTATUS.OK).json(await run(parsed.data));
    } catch (error) {
      next(error);
    }
  };

export const listAuditLogsController = handle(auditLogQuerySchema, listAuditLogsService);
export const listAuditActorsController = handle(auditActorsQuerySchema, listAuditActorsService);
export const auditSummaryController = handle(z.object({}), () => auditSummaryService());
export const listAuditCountriesController = handle(z.object({}), () => listAuditCountriesService());
