import i18n from "../../i18n/i18n";
import type { TFunction } from "i18next";
import type { MessageUserLite } from "./api/messages.api";
import { personName as nameByLang } from "../../lib/person-name";

/**
 * Helpers shared by the messages screens. No components here, so fast refresh
 * keeps working in the files that do export them.
 */

export function personName(u?: Pick<MessageUserLite, "firstName" | "lastName" | "firstNameLatin" | "lastNameLatin" | "email"> | null) {
  return nameByLang(u) || u?.email || "—";
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Today → the time; this week → the weekday; otherwise the date. */
export function shortWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return d.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString(i18n.language, { weekday: "short" });
  return d.toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export function fullWhen(iso: string) {
  return new Date(iso).toLocaleString(i18n.language, { dateStyle: "full", timeStyle: "short" });
}

export function relativeWhen(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 30 * 86_400) return rtf.format(Math.round(diff / 86_400), "day");
  return rtf.format(Math.round(diff / (30 * 86_400)), "month");
}

export type BroadcastTarget = "all" | "students" | "professors" | "admins";

/**
 * Reads a broadcast tag. New tags are `target|names · …`; older ones were
 * `target` or `students:<specializationId>`. Level and project markers are
 * `@level` / `@project-with` tokens, translated on display.
 */
export function parseBroadcast(tag: string | null | undefined) {
  if (!tag) return null;
  const [head, rest = ""] = tag.split("|");
  const [target, legacy] = head.split(":");
  const parts = rest ? rest.split(" · ").filter(Boolean) : [];
  return {
    target: (["all", "students", "professors", "admins"].includes(target) ? target : "students") as BroadcastTarget,
    names: parts.filter((p) => !p.startsWith("@")),
    tokens: parts.filter((p) => p.startsWith("@")).map((p) => p.slice(1)),
    legacySpecialization: !!legacy,
  };
}

/** "Students · Master · Clinical psychology" in the reader's language. */
export function broadcastLabel(tag: string | null | undefined, t: (k: string) => string) {
  const b = parseBroadcast(tag);
  if (!b) return "";
  const tokenLabel = (tok: string) =>
    tok.startsWith("project-") ? t(`msg.audience.${tok}`) : t(`msg.level.${tok}`);
  return [
    t(`msg.audience.target.${b.target}`),
    ...b.tokens.map(tokenLabel),
    ...b.names,
    ...(b.legacySpecialization ? [t("msg.audience.oneSpecialization")] : []),
  ].join(" · ");
}

/* ── which conversation is on screen ─────────────────────────
   A toast for a message that is already open in front of the reader is noise;
   the reader marks its conversation here, the alert checks it. */
let openThread: string | null = null;
export const setOpenThread = (id: string | null) => {
  openThread = id;
};
export const isThreadOpen = (id: string | null | undefined) => !!id && openThread === id;

/* The chat on screen, by the other person's id — same purpose as above. */
let openChat: string | null = null;
export const setOpenChat = (userId: string | null) => {
  openChat = userId;
};
export const isChatOpen = (userId: string | null | undefined) => !!userId && openChat === userId;

/* The message bell in the dashboards' header (components/layout/Dashboard/
   message-bell): where it is on screen, a new message comes out of it, so the
   corner toast (use-message-alerts) stands aside — one message, told once. */
let bells = 0;
/** The bell is on screen; the function returned says it is gone. */
export const holdBell = () => {
  bells++;
  return () => {
    bells--;
  };
};
export const bellShown = () => bells > 0;

/** Whether a new message is to be announced at all: not when its conversation is open in front of the reader. */
export const worthTelling = (payload: { threadId: string | null; id: string; sender: { id: string } }) =>
  !isThreadOpen(payload.threadId ?? payload.id) && !isChatOpen(payload.sender.id);

/** "10:24" — the time inside a bubble. */
export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
}

/** The pill between days: today / yesterday / weekday + date. */
export function dayLabel(iso: string, t: (k: string) => string) {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return t("msg.chat.today");
  if (sameDay(d, y)) return t("msg.chat.yesterday");
  return d.toLocaleDateString(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export const sameDayIso = (a: string, b: string) => sameDay(new Date(a), new Date(b));

/** Local draft of the compose form — a convenience, never the source of truth. */
const DRAFT_KEY = "messages.draft";
export function readDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function writeDraft(value: unknown) {
  try {
    if (value === null) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
  } catch {
    /* the draft just won't survive a reload */
  }
}

/* ── files sent with messages ─────────────────────────────── */

/** What the server accepts (Backend modules/messages/attachments) — checked here first, to say so at once. */
export const FILE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt", ".txt"];
export const MAX_FILE_MB = 25;
export const MAX_FILES = 5;

export type FileKind = "image" | "pdf" | "word" | "excel" | "slides" | "text" | "file";

/** The family a file belongs to — by its type when known, else by its name. */
export function fileKind(mimeOrName: string): FileKind {
  const v = mimeOrName.toLowerCase();
  if (v.startsWith("image/") || /\.(png|jpe?g|webp)$/.test(v)) return "image";
  if (v.includes("pdf")) return "pdf";
  if (v.includes("word") || /\.docx?$/.test(v)) return "word";
  if (v.includes("excel") || v.includes("spreadsheet") || /\.xlsx?$/.test(v)) return "excel";
  if (v.includes("powerpoint") || v.includes("presentation") || /\.pptx?$/.test(v)) return "slides";
  if (v.startsWith("text/") || v.endsWith(".txt")) return "text";
  return "file";
}

/** «340 KB», «2.4 MB» — in the reader's language. */
export function fileSize(bytes: number, t: TFunction) {
  const nf = (n: number, digits: number) => n.toLocaleString(i18n.language, { maximumFractionDigits: digits });
  if (bytes < 1024 * 1024) return t("msg.files.kb", { n: nf(Math.max(1, Math.round(bytes / 1024)), 0) });
  return t("msg.files.mb", { n: nf(bytes / (1024 * 1024), 1) });
}

/**
 * The line a list shows for a message: its text, or — for a file sent alone —
 * the file's name, and how many came with it.
 */
export function previewOf(
  text: string | null | undefined,
  files: { fileName: string; count?: number }[] | { fileName: string; count?: number } | null | undefined,
  t: TFunction,
) {
  if (text) return text;
  const list = Array.isArray(files) ? files : files ? [files] : [];
  const first = list[0];
  if (!first) return "";
  const count = Array.isArray(files) ? list.length : (first.count ?? 1);
  return count > 1 ? t("msg.files.previewMany", { name: first.fileName, more: count - 1 }) : t("msg.files.preview", { name: first.fileName });
}

/* ── changing a message after sending it ──────────────────── */

/** As the server allows (Backend messages.service: EDIT_WINDOW_MS). */
export const EDIT_WINDOW_MS = 15 * 60_000;

/** Whether I may still change this message's text, at `now`. */
export const stillEditable = (m: { mine: boolean; createdAt: string; pending?: unknown }, now: number) =>
  m.mine && !m.pending && now - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;
