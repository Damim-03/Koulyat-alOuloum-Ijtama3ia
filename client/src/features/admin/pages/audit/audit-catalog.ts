import type { TFunction } from "i18next";
import {
  Activity,
  BookOpen,
  ListChecks,
  Building2,
  CalendarClock,
  FilePlus2,
  Globe2,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquareX,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { AuditArea, AuditLogEntry, AuditLogKind, AuditVerb } from "../../../../types/admin";

/**
 * What the audit log knows how to say.
 *
 * Each row is an operation: a change, written as the route that made it
 * (`PATCH /students/:id`), or an event, by its name (`auth.login`). Here each
 * operation has its area of the platform, and its words in each language —
 * `admin.audit.op.<key>`, the key being the operation with every run of
 * other characters made `_` (`PATCH_students_id`). An operation the platform
 * learns later and this list does not know yet still reads: as its verb and
 * the kind of thing it changed.
 */

/** The four kinds, as tabs. */
export const KINDS: { kind: AuditLogKind; icon: LucideIcon }[] = [
  { kind: "all", icon: ListChecks },
  { kind: "changes", icon: PencilLine },
  { kind: "security", icon: ShieldCheck },
  { kind: "failed", icon: ShieldAlert },
];

export const PAGE_SIZES = [25, 50, 100];

/** The filters folded under «advanced»: one of them set opens the fold. */
export const ADVANCED = ["area", "role", "actor", "op", "verb", "country", "ip"] as const;

/** A country's name in the page's language, from its code: `DZ` → «الجزائر». */
export function countryName(lang: string, code: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Where an address was, in a few words: «Remchi · الجزائر». */
export function placeOf(lang: string, e: { city?: string | null; country?: string | null }): string | null {
  return [e.city, e.country ? countryName(lang, e.country) : null].filter(Boolean).join(" · ") || null;
}

/** A day as the date inputs write it, in this computer's own calendar: today, or so many days from it. */
export const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
};

/**
 * What an address is, when it is not the internet's: this very machine (a
 * trial on the server itself, or a request the proxy did not pass on), or a
 * private network (the university's own).
 */
export function ipKind(ip: string | null | undefined): "local" | "private" | null {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/i, "");
  if (v4 === "::1" || v4.startsWith("127.")) return "local";
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v4) || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return "private";
  return null;
}

/** How long a session lasted, from when it began to the row that ended it. */
export function sessionLength(t: TFunction, startedAt: unknown, endedAt: string): string | null {
  const start = typeof startedAt === "string" ? new Date(startedAt).getTime() : NaN;
  const minutes = Math.floor((new Date(endedAt).getTime() - start) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 1) return t("admin.audit.lessThanMinute");
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? t("admin.audit.hoursMinutes", { h, m }) : t("admin.audit.minutes", { m });
}

/** How long ago, in words: «منذ 3 ساعات». */
export function ago(lang: string, iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return rtf.format(seconds, "second");
}

/** A field's name — a page's text by where it sits: «العربية › الاسم الكامل». */
export const fieldLabel = (t: TFunction, field: string) =>
  field
    .split(".")
    .map((part) => t(`admin.audit.field.${part}`, { defaultValue: part }))
    .join(" › ");

export const AREAS: AuditArea[] = ["accounts", "structure", "topics", "projects", "site", "signin", "credentials", "account", "messages"];

/** Every operation, by area: the order of the «operation» filter. */
export const OPERATIONS: Record<AuditArea, string[]> = {
  accounts: [
    "POST /users",
    "PATCH /users/:id",
    "PATCH /users/:id/status",
    "PATCH /users/:id/verification",
    "POST /users/:id/reset-password",
    "DELETE /users/:id",
    "POST /students",
    "POST /students/import",
    "PATCH /students/:id",
    "DELETE /students/:id",
    "POST /professors",
    "POST /professors/import",
    "PATCH /professors/:id",
    "DELETE /professors/:id",
    "POST /activation/requests/:id/approve",
    "POST /activation/requests/:id/reject",
    "POST /password-requests/:id/approve",
    "POST /password-requests/:id/reject",
    "cli.adminCreated",
    "cli.twoFactorReset",
  ],
  structure: [
    "POST /academic-structure",
    "POST /faculties",
    "PATCH /faculties/:id",
    "DELETE /faculties/:id",
    "POST /departments",
    "PATCH /departments/:id",
    "DELETE /departments/:id",
    "POST /topic-types",
    "PATCH /topic-types/:id",
    "DELETE /topic-types/:id",
    "POST /domains",
    "PATCH /domains/:id",
    "DELETE /domains/:id",
    "POST /filieres",
    "PATCH /filieres/:id",
    "DELETE /filieres/:id",
    "POST /specializations",
    "PATCH /specializations/:id",
    "DELETE /specializations/:id",
    "POST /academic-years",
    "PATCH /academic-years/:id",
    "PATCH /academic-years/:id/activate",
    "DELETE /academic-years/:id",
    "PUT /academic-years/:id/proposal-window",
    "DELETE /academic-years/:id/proposal-window",
    "PUT /academic-years/:id/selection-window",
    "DELETE /academic-years/:id/selection-window",
    "PUT /academic-years/:id/team-size",
    "DELETE /academic-years/:id/team-size",
    "PUT /academic-years/:id/topic-quota",
    "DELETE /academic-years/:id/topic-quota",
    "POST /archive/years/:id/close",
    "POST /archive/years/:id/reopen",
    "POST /university-domains",
    "PATCH /university-domains/:id/default",
    "DELETE /university-domains/:id",
  ],
  topics: [
    "POST /professor/topics",
    "POST /professor/topics/with-group",
    "PUT /professor/topics/:id",
    "DELETE /professor/topics/:id",
    "POST /topics",
    "POST /topics/import",
    "POST /topics/assigned",
    "POST /topics/assigned/import",
    "PATCH /topics/:id/assignment",
    "PATCH /topics/:id/approve",
    "PATCH /topics/:id/reject",
    "PATCH /topics/:id/publish",
    "PATCH /topics/:id/unpublish",
    "PATCH /topics/:id/archive",
    "PATCH /topics/:id/unarchive",
    "DELETE /topics/:id",
    "POST /student/group-requests",
    "DELETE /student/group-requests/:id",
    "PATCH /group-requests/:id/accept",
    "PATCH /group-requests/:id/reject",
    "DELETE /group-requests/:id",
    "DELETE /group-requests/:id/members/:studentId",
    "PATCH /group-requests/:id/leader/:studentId",
    "POST /supervision-documents/topics/:topicId",
    "POST /supervision-documents/:id/print",
    "PATCH /supervision-documents/:id/revoke",
  ],
  projects: [
    "PATCH /projects/:id/supervisor",
    "POST /projects/:id/assign",
    "DELETE /projects/:id/members/:studentId",
    "PATCH /projects/:id/leader/:studentId",
    "DELETE /projects/:id",
    "POST /projects/:groupId/milestones",
    "PATCH /milestones/:id",
    "DELETE /milestones/:id",
    "POST /professor/groups/:groupId/milestones",
    "PUT /professor/milestones/:id",
    "DELETE /professor/milestones/:id",
    "POST /defenses",
    "PATCH /defenses/:id",
    "DELETE /defenses/:id",
  ],
  site: [
    "POST /home-slides",
    "POST /home-slides/batch",
    "PATCH /home-slides/order",
    "PATCH /home-slides/:id",
    "DELETE /home-slides/:id",
    "POST /news",
    "PATCH /news/:id",
    "DELETE /news/:id",
    "PUT /director-message",
    "PUT /about-page",
    "PUT /login-page",
    "PUT /supervision-sheet",
    "DELETE /supervision-sheet",
    "PUT /site-texts",
    "PUT /mail-templates",
    "POST /mail-templates/test",
    "POST /uploads/image",
  ],
  signin: [
    "auth.login",
    "auth.logout",
    "auth.loginFailed",
    "auth.twoFactorFailed",
    "auth.newDevice",
    "auth.logoutAll",
    "session.ended",
    "auth.failureSpike",
  ],
  credentials: [
    "password.changed",
    "password.resetRequested",
    "password.reset",
    "password.adminRequested",
    "password.pickedUp",
    "email.verified",
    "twoFactor.enabled",
    "twoFactor.disabled",
    "twoFactor.recoveryCodesRenewed",
  ],
  account: ["PATCH /account", "POST /account/avatar", "POST /account/email", "activation.requested"],
  messages: ["message.deletedForEveryone"],
};

const AREA_OF = new Map(AREAS.flatMap((area) => OPERATIONS[area].map((op) => [op, area] as const)));

/** The words of an operation are found under this key. */
export const opKey = (action: string) => action.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const WRITE = /^(POST|PATCH|PUT|DELETE) (\/\S*)$/;

const VERB_OF: Record<string, AuditVerb> = { POST: "create", PATCH: "update", PUT: "update", DELETE: "delete" };

/** The kinds of things whose area is known, for an operation not in the list. */
const KIND_AREA: Record<string, AuditArea> = {
  users: "accounts",
  students: "accounts",
  professors: "accounts",
  activation: "accounts",
  "password-requests": "accounts",
  topics: "topics",
  "group-requests": "topics",
  "supervision-documents": "topics",
  projects: "projects",
  milestones: "projects",
  defenses: "projects",
};

export type Tone = "create" | "update" | "delete" | "signin" | "credentials" | "failed" | "neutral";

export const TONES: Record<Tone, string> = {
  create: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  update: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  delete: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  signin: "bg-gold/15 text-gold",
  credentials: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  failed: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  neutral: "bg-forest/8 text-forest",
};

export interface Described {
  title: string;
  area: AuditArea | null;
  /** A change's verb; an event has none. */
  verb: AuditVerb | null;
  tone: Tone;
  icon: LucideIcon;
}

const AREA_ICON: Record<AuditArea, LucideIcon> = {
  accounts: UserCog,
  structure: Building2,
  topics: BookOpen,
  projects: CalendarClock,
  site: Globe2,
  signin: LogIn,
  credentials: KeyRound,
  account: UserRound,
  messages: MessageSquareX,
};

/** An operation's own words — or, for one this list does not know, its verb and kind. */
export function opTitle(t: TFunction, action: string): string {
  const own = t(`admin.audit.op.${opKey(action)}`, { defaultValue: "" });
  if (own) return own;
  const write = WRITE.exec(action);
  if (!write) return action;
  const [, method, route] = write;
  const kind = route!.split("/").filter(Boolean).find((s) => !s.startsWith(":") && !["professor", "student"].includes(s)) ?? "";
  return `${t(`admin.audit.verb.${method}`)} · ${t(`admin.audit.res.${kind}`, { defaultValue: kind })}`;
}

/** A row in words: what it was, its area, its kind of act, its colour and its sign. */
export function describe(t: TFunction, e: Pick<AuditLogEntry, "action" | "success" | "targetType">): Described {
  const write = WRITE.exec(e.action);
  const verb = write ? VERB_OF[write[1]!]! : null;
  const area = AREA_OF.get(e.action) ?? (e.targetType ? KIND_AREA[e.targetType] : undefined) ?? null;
  let tone: Tone = verb ?? (area === "signin" ? "signin" : area === "credentials" ? "credentials" : "neutral");
  let icon: LucideIcon =
    verb === "create" ? FilePlus2 : verb === "delete" ? Trash2 : verb === "update" ? PencilLine : area ? AREA_ICON[area] : Activity;
  if (e.action === "auth.logout" || e.action === "auth.logoutAll" || e.action === "session.ended") icon = LogOut;
  if (area === "credentials") icon = e.action.startsWith("twoFactor") ? ShieldCheck : KeyRound;
  if (!e.success) {
    tone = "failed";
    icon = ShieldAlert;
  }
  return { title: opTitle(t, e.action), area, verb, tone, icon };
}

/** A professor's or a student's own routes: the same words as the administration's, said apart. */
const BY = /^\w+ \/(professor|student)\//;

/** Every operation as a choice of the filter, with its area — and who does it, when that tells two apart. */
export function operationOptions(t: TFunction) {
  return AREAS.flatMap((area) =>
    OPERATIONS[area].map((op) => {
      const by = BY.exec(op)?.[1];
      return {
        value: op,
        label: opTitle(t, op),
        hint: [t(`admin.audit.area.${area}`), by && t(`admin.audit.role.${by}`)].filter(Boolean).join(" · "),
      };
    }),
  );
}
