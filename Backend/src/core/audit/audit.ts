import type { NextFunction, Request, Response } from "express";

import { prisma } from "../prisma/client";
import { Prisma } from "../../generated/prisma";
import { deviceOf, type SessionDevice } from "../auth/device";
import { config } from "../config/app.config";
import { geoOf } from "../geo/geo";
import {
  SITE_PAGES,
  changesOf,
  countsOf,
  createdId,
  filled,
  isSubject,
  readSubject,
  refsOf,
  type Snapshot,
} from "./subjects";

/**
 * ============================================================
 * THE AUDIT LOG
 * ============================================================
 *
 * Who did what, to what, when, and from where — the address placed on the map
 * by the server itself (core/geo). Every change made through the platform —
 * by the administration, by a professor, by a student, by anyone in their own
 * account — and every event that touches the safety of an account: signing in
 * (or failing to) and out, passwords changed, two-step verification turned on
 * or off, devices signed out, a sign-in from a new device. Messages are not
 * written here: what people write to each other is theirs.
 *
 * A change is written as the route that made it, with what it was made to
 * (by name, kept after the item is gone) and how: each field that changed,
 * from what to what — the item is read before the change and after it
 * (./subjects).
 *
 * Written after the fact and never in the way: a row that cannot be written
 * is reported in the server log, and the request it describes still succeeds.
 * No route edits or deletes a row. Two kinds expire: a refused sign-in names
 * whatever was typed as the account (a student's registration number, an
 * email) and the address it came from, so it is kept for
 * `FAILED_SIGNIN_RETENTION_DAYS` (`pruneFailedSignIns`); students and
 * professors signing in and out are many rows a day, kept for
 * `SIGNIN_RETENTION_DAYS` (`pruneSignIns`).
 */

export interface AuditActor {
  id?: string | null;
  role?: string | null;
  /** Who it was, readable after the account is gone (email, name…). */
  label?: string | null;
}

export interface AuditInput {
  action: string;
  actor?: AuditActor;
  targetType?: string | null;
  targetId?: string | null;
  /** What it was done to, as a person would name it. Read from the target when left out. */
  targetLabel?: string | null;
  /** What was sent: secrets hidden by their names (`sanitize`). */
  details?: unknown;
  /**
   * What the platform itself read — the fields that changed, what was
   * created or deleted. Chosen field by field (./subjects), so nothing is
   * hidden by its name: a faculty's `code` is a code, not a secret.
   */
  facts?: Record<string, unknown>;
  success?: boolean;
  /** Where it came from: a request, or a device already read from one. */
  req?: Request;
  device?: SessionDevice | null;
}

/** Keys whose values never reach the log: passwords, codes, keys, tokens. */
const SECRET_KEY = /pass(word)?|secret|token|challenge|recovery|otp|cookie|authorization/i;
const CODE_KEY = /^(code|totp)$/i;

const MAX_STRING = 300;
const MAX_ITEMS = 20;
const MAX_KEYS = 40;
const MAX_DEPTH = 3;

/**
 * What may be written about a request body: secrets replaced by a mark (that
 * a password was set is worth knowing — the password is not), long text and
 * long lists cut. `hide` false keeps every key (for what the platform read
 * itself) and only cuts — and goes two levels deeper, where a change's list
 * of members sits (`changes[0].from[1]`).
 */
export function sanitize(value: unknown, depth = 0, hide = true): unknown {
  const deepest = hide ? MAX_DEPTH : MAX_DEPTH + 2;
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[${value.length} bytes]`;
  if (depth >= deepest) return "[…]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => sanitize(v, depth + 1, hide) ?? null);
    return value.length > MAX_ITEMS ? [...items, `… +${value.length - MAX_ITEMS}`] : items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      if (hide && (SECRET_KEY.test(k) || CODE_KEY.test(k))) {
        if (v !== undefined && v !== null && v !== "") out[k] = "[hidden]";
        continue;
      }
      const clean = sanitize(v, depth + 1, hide);
      if (clean !== undefined) out[k] = clean;
      else if (!hide && v === null) out[k] = null;
    }
    return out;
  }
  return undefined;
}

/** A readable name for an account, kept with the row. */
const labelOf = async (userId: string) => (await readSubject("users", userId))?.label ?? null;

/** What the row says it was done to: given, or read from the target itself. */
async function targetLabelOf(input: AuditInput): Promise<string | null> {
  if (input.targetLabel !== undefined) return input.targetLabel;
  if (!isSubject(input.targetType) || !input.targetId) return null;
  return (await readSubject(input.targetType, input.targetId).catch(() => null))?.label ?? null;
}

async function write(input: AuditInput) {
  const device = input.device ?? (input.req ? deviceOf(input.req) : null);
  const actorId = input.actor?.id ?? input.req?.user?.userId ?? null;
  const label = input.actor?.label ?? (actorId ? await labelOf(actorId) : null);
  const sent = sanitize(input.details);
  const read = input.facts ? (sanitize(input.facts, 0, false) as Record<string, unknown>) : {};
  // What was sent and what was read, side by side in one object.
  const merged = sent === undefined || (typeof sent === "object" && !Array.isArray(sent)) ? { ...(sent as object), ...read } : { value: sent, ...read };
  const details = Object.keys(merged).length ? merged : undefined;
  const targetLabel = await targetLabelOf(input);
  // Where the address is, as known today: an address changes hands, the row keeps where it was.
  const geo = await geoOf(device?.ip).catch(() => null);
  await prisma.auditLog.create({
    data: {
      action: input.action.slice(0, 120),
      actorId,
      actorRole: input.actor?.role ?? input.req?.user?.role ?? null,
      actorLabel: label?.slice(0, 191) ?? null,
      targetType: input.targetType?.slice(0, 40) ?? null,
      targetId: input.targetId?.slice(0, 64) ?? null,
      targetLabel: targetLabel?.slice(0, 191) ?? null,
      details: details === undefined ? Prisma.DbNull : (details as Prisma.InputJsonValue),
      success: input.success ?? true,
      ip: device?.ip ?? null,
      userAgent: device?.userAgent ?? null,
      country: geo?.country ?? null,
      region: geo?.region?.slice(0, 100) ?? null,
      city: geo?.city?.slice(0, 100) ?? null,
      isp: geo?.isp?.slice(0, 120) ?? null,
    },
  });
}

/** Records an event. Never throws and never delays the caller. */
export function audit(input: AuditInput): void {
  void write(input).catch((error: unknown) => {
    console.error(
      JSON.stringify({ level: "error", scope: "audit", action: input.action, message: (error as Error)?.message }),
    );
  });
}

/** Records and waits — for scripts that exit right after (src/cli). */
export const auditNow = (input: AuditInput) => write(input);

/**
 * The refused sign-ins: what was typed as the account, and from where.
 * `auth.activationFailed` (a wrong code from the activation desk, now gone) is
 * no longer written; it stays so the rows already in the log are listed and
 * deleted with the others.
 */
export const FAILED_SIGN_IN_ACTIONS = ["auth.loginFailed", "auth.twoFactorFailed", "auth.activationFailed"] as const;

/** Signing in and out: for students and professors, many rows a day. */
export const SIGN_IN_ACTIONS = ["auth.login", "auth.logout"] as const;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function prune(what: string, where: Prisma.AuditLogWhereInput): Promise<number> {
  try {
    return (await prisma.auditLog.deleteMany({ where })).count;
  } catch (error) {
    console.error(JSON.stringify({ level: "error", scope: "audit", action: what, message: (error as Error)?.message }));
    return 0;
  }
}

/**
 * Deletes refused sign-ins older than the retention. Run now and then from
 * the sign-in path instead of on a schedule; never throws.
 */
export const pruneFailedSignIns = (days = config.FAILED_SIGNIN_RETENTION_DAYS) =>
  prune("pruneFailedSignIns", { action: { in: [...FAILED_SIGN_IN_ACTIONS] }, createdAt: { lt: daysAgo(days) } });

/**
 * Deletes students and professors signing in and out, older than the
 * retention. An administrator's are kept. Run now and then from the sign-in
 * path; never throws.
 */
export const pruneSignIns = (days = config.SIGNIN_RETENTION_DAYS) =>
  prune("pruneSignIns", {
    action: { in: [...SIGN_IN_ACTIONS] },
    actorRole: { in: ["student", "professor"] },
    createdAt: { lt: daysAgo(days) },
  });

//
// ─── CHANGES MADE THROUGH A ROUTER ──────────────────────────────
//

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);
/** Writes that change nothing worth recording: one's own bell, an import preview. */
const NOT_A_CHANGE = /^\/notifications(\/|$)|\/preview$/;

/** Where the router sits: `/professor`, `/account`… — and nothing for the administration's, as its rows always read. */
const scopeOf = (req: Request) => (req.baseUrl ?? "").replace(/^\/api/, "").replace(/^\/admin$/, "");

/**
 * What a change is about, read from its route:
 * - `existing` — `/students/:id`: that item, read before and after;
 * - `created` — a POST with no id: the item its answer returns;
 * - `page` — a page of the site, kept as one document (`PUT /about-page`);
 * - `self` — one's own account (`/account`);
 * - `none` — anything else (a reordering, an upload): what was sent, and the counts answered.
 */
export interface Located {
  action: string;
  kind: string | null;
  id: string | null;
  mode: "existing" | "created" | "page" | "self" | "none";
}

export function locate(req: Request): Located {
  const scope = scopeOf(req);
  const pattern: string = (req.route?.path as string | undefined) ?? req.path;
  const action = `${req.method} ${pattern === "/" && scope ? scope : `${scope}${pattern}`}`;
  const segs = pattern.split("/").filter(Boolean);
  const statics = segs.filter((s) => !s.startsWith(":"));
  // The supervision documents' router is named after them; the others after nothing in particular.
  const base = scope === "/supervision-documents" ? "supervision-documents" : (statics[0] ?? null);

  if (scope === "/account") return { action, kind: "users", id: req.user?.userId ?? null, mode: "self" };
  if (segs.includes(":id")) {
    const id = req.params?.id;
    return { action, kind: base, id: typeof id === "string" ? id : null, mode: "existing" };
  }
  if (base && SITE_PAGES.has(base)) return { action, kind: base, id: base, mode: "page" };
  if (req.method === "POST") {
    // What is created is what the route ends with — `/projects/:groupId/milestones` — when that is a kind.
    const last = scope === "/supervision-documents" ? null : statics[statics.length - 1];
    return { action, kind: isSubject(last) ? last : base, id: null, mode: "created" };
  }
  return { action, kind: base, id: null, mode: "none" };
}

interface Pending {
  before: Snapshot | null;
  /** The answer sent: a create's id, an import's counts. */
  body?: unknown;
}

const pendingOf = (res: Response) => res.locals.audit as Pending | undefined;

/** Reads the item as it is now, before the change. Never fails: an unreadable item is written without it. */
async function readBefore(state: Pending, at: Located) {
  if (at.mode !== "existing" && at.mode !== "page" && at.mode !== "self") return;
  state.before = await readSubject(at.kind, at.id).catch(() => null);
}

async function record(req: Request, state: Pending) {
  const at = locate(req);
  const id = at.id ?? (at.mode === "created" ? createdId(state.body) : null);
  const after = id ? await readSubject(at.kind, id).catch(() => null) : null;
  const before = state.before;
  const file = (req as Request & { file?: Express.Multer.File }).file;
  const body: unknown = req.body;
  const sent = Array.isArray(body) ? body.length > 0 : !!body && typeof body === "object" && Object.keys(body).length > 0;
  const refs = await refsOf(req.params).catch(() => undefined);
  const counts = countsOf(state.body);
  const facts: Record<string, unknown> = {
    ...(before && after ? { changes: changesOf(before.fields, after.fields) } : {}),
    ...(!before && after && at.mode === "created" ? { created: filled(after.fields) } : {}),
    ...(before && !after ? { deleted: filled(before.fields) } : {}),
    ...(refs ? { refs } : {}),
    ...(counts ? { result: counts } : {}),
  };
  audit({
    action: at.action,
    targetType: at.kind,
    targetId: id,
    targetLabel: after?.label ?? before?.label ?? null,
    details: {
      ...(sent ? { body } : {}),
      ...(file ? { file: { name: file.originalname, size: file.size } } : {}),
    },
    facts,
    req,
  });
}

/**
 * Every successful change made through the router (or the route) it sits on,
 * recorded as the route that made it — `PATCH /students/:id` — with the item
 * it was made to and each field that changed. On a router, the item is read
 * before the change by `auditBefore` (`router.param("id", auditBefore)`), the
 * one moment its id is known and the change not yet made. Sitting on the
 * router, a route added later is recorded the day it is written.
 */
export function auditWrites(req: Request, res: Response, next: NextFunction) {
  if (READ_ONLY.has(req.method) || NOT_A_CHANGE.test(req.path)) return next();
  const state: Pending = { before: null };
  res.locals.audit = state;
  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    state.body = body;
    return json(body);
  };
  res.on("finish", () => {
    if (res.statusCode >= 400) return; // a refused change changed nothing
    void record(req, state).catch((error: unknown) => {
      console.error(JSON.stringify({ level: "error", scope: "audit", action: req.method, message: (error as Error)?.message }));
    });
  });
  // Mounted on one route, or a page of the site (no id to wait for): what
  // the change will be made to is known now.
  const at = locate(req);
  if (req.route || at.mode === "page") return void readBefore(state, at).finally(() => next());
  next();
}

/** `router.param("id", auditBefore)`: the item a change is about, read before the change. */
export function auditBefore(req: Request, res: Response, next: NextFunction) {
  const state = pendingOf(res);
  if (!state || READ_ONLY.has(req.method)) return next();
  void readBefore(state, locate(req)).finally(() => next());
}
