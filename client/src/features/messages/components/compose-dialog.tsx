import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Globe,
  GraduationCap,
  Layers,
  Loader2,
  Megaphone,
  PenLine,
  Search,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { Select } from "../../../components/ui/select";
import {
  useAcademicYears,
  useDepartments,
  useFaculties,
  useFilieres,
  useSpecializations,
} from "../../admin/hooks/admin-hook";
import { useAudience, useBroadcastMessage, useContacts, useSendMessage } from "../hooks/messages-hook";
import type { AudienceInput, Contact, ContactRole } from "../api/messages.api";
import { personName, readDraft, writeDraft } from "../messages-utils";
import { RelationChip } from "./messages-ui";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ComposeMode = "direct" | "audience";

/** What was sent, so the page can open it: the chat, or the broadcast. */
export type SentResult = { kind: "direct"; id: string; recipientIds: string[] } | { kind: "broadcast"; id: string };

interface Draft {
  mode: ComposeMode;
  subject: string;
  body: string;
  picked: Contact[];
  audience: AudienceInput;
}

const EMPTY_AUDIENCE: AudienceInput = { target: "students" };

/**
 * Writing a message: to chosen people, or — for the administration — to an
 * audience described precisely (a faculty, a specialization, a year, Master
 * students still without a project…), with the number it will reach counted
 * live before anything is sent.
 *
 * The draft is kept in this browser, so closing the window by mistake loses
 * nothing.
 */
export function ComposeDialog({
  open,
  onClose,
  canBroadcast,
  initialMode = "direct",
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  canBroadcast: boolean;
  initialMode?: ComposeMode;
  onSent: (result: SentResult) => void;
}) {
  useBodyScrollLock(open);
  if (!open) return null;
  return createPortal(
    <ComposeBody onClose={onClose} canBroadcast={canBroadcast} initialMode={initialMode} onSent={onSent} />,
    document.body,
  );
}

function ComposeBody({
  onClose,
  canBroadcast,
  initialMode,
  onSent,
}: {
  onClose: () => void;
  canBroadcast: boolean;
  initialMode: ComposeMode;
  onSent: (result: SentResult) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readDraft<Draft>();
    const base: Draft = { mode: initialMode, subject: "", body: "", picked: [], audience: EMPTY_AUDIENCE };
    const d = saved ? { ...base, ...saved, mode: initialMode } : base;
    return canBroadcast ? d : { ...d, mode: "direct" };
  });
  const [error, setError] = useState<string | null>(null);
  const send = useSendMessage();
  const broadcast = useBroadcastMessage();
  const busy = send.isPending || broadcast.isPending;

  // Kept as you type; cleared once sent.
  useEffect(() => {
    const id = setTimeout(() => writeDraft(draft.body || draft.subject || draft.picked.length ? draft : null), 400);
    return () => clearTimeout(id);
  }, [draft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // Debounced so the live count does not query on every click.
  const [audienceQuery, setAudienceQuery] = useState(draft.audience);
  useEffect(() => {
    const id = setTimeout(() => setAudienceQuery(draft.audience), 250);
    return () => clearTimeout(id);
  }, [draft.audience]);
  const audience = useAudience(audienceQuery, draft.mode === "audience" && canBroadcast);
  const reach = draft.mode === "audience" ? (audience.data?.count ?? 0) : draft.picked.length;

  const canSend =
    !busy &&
    draft.body.trim().length > 0 &&
    (draft.mode === "direct" ? draft.picked.length > 0 : reach > 0 && !audience.isFetching);

  function submit() {
    if (!canSend) {
      if (!draft.body.trim()) setError(t("msg.compose.needBody"));
      else if (draft.mode === "direct" && !draft.picked.length) setError(t("msg.compose.needRecipient"));
      return;
    }
    const common = { subject: draft.subject.trim() || undefined, body: draft.body.trim() };
    const done = (result: SentResult) => {
      writeDraft(null);
      onSent(result);
    };
    const fail = (e: any) => setError(e?.response?.data?.message ?? t("toast.messageSendFailed"));
    if (draft.mode === "direct") {
      const recipientIds = draft.picked.map((p) => p.id);
      send.mutate({ ...common, recipientIds }, { onSuccess: (m) => done({ kind: "direct", id: m.id, recipientIds }), onError: fail });
    } else {
      broadcast.mutate({ ...common, ...draft.audience }, { onSuccess: (r) => done({ kind: "broadcast", id: r.id }), onError: fail });
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" data-testid="compose-dialog">
      <div className="absolute inset-0 bg-forest-deep/60 backdrop-blur-sm" onMouseDown={() => !busy && onClose()} />
      <div className="animate-scale-in relative z-10 flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-cream-card shadow-2xl">
        {/* header */}
        <div className="forest-glow relative shrink-0 overflow-hidden px-6 py-5 text-cream">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
              {draft.mode === "audience" ? <Megaphone size={22} /> : <PenLine size={22} />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-xl font-bold text-cream">
                {draft.mode === "audience" ? t("msg.compose.broadcastTitle") : t("msg.compose.title")}
              </h2>
              <p className="text-[12px] text-cream/70">
                {draft.mode === "audience" ? t("msg.compose.broadcastSubtitle") : t("msg.compose.subtitle")}
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label={t("msg.close")} className="grid size-9 place-items-center rounded-xl text-cream/80 transition hover:bg-cream/15">
              <X size={18} />
            </button>
          </div>
          {canBroadcast && (
            <div className="relative mt-4 inline-grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-cream/10 p-1" role="tablist">
              {(["direct", "audience"] as ComposeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={draft.mode === m}
                  onClick={() => set("mode", m)}
                  data-testid={`compose-mode-${m}`}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-[12.5px] font-semibold transition ${
                    draft.mode === m ? "bg-gold text-forest-deep" : "text-cream/80 hover:text-cream"
                  }`}
                >
                  {m === "direct" ? <UserRound size={14} /> : <Megaphone size={14} />}
                  {t(`msg.compose.mode.${m}`)}
                </button>
              ))}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* who */}
            <section className="border-b border-forest/10 p-5 lg:border-e lg:border-b-0">
              <p className="mb-3 text-[11.5px] font-bold tracking-wide text-gold">{t("msg.compose.to")}</p>
              {draft.mode === "direct" ? (
                <ContactPicker picked={draft.picked} onChange={(v) => set("picked", v)} />
              ) : (
                <AudienceBuilder
                  value={draft.audience}
                  onChange={(v) => set("audience", v)}
                  count={audience.data?.count}
                  sample={audience.data?.sample ?? []}
                  loading={audience.isFetching}
                />
              )}
            </section>

            {/* what */}
            <section className="flex flex-col p-5">
              <p className="mb-3 text-[11.5px] font-bold tracking-wide text-gold">{t("msg.compose.message")}</p>
              <input
                value={draft.subject}
                onChange={(e) => set("subject", e.target.value)}
                maxLength={200}
                placeholder={t("msg.compose.subjectPlaceholder")}
                data-testid="compose-subject"
                className="mb-3 h-11 w-full rounded-xl border border-forest/15 bg-cream px-3.5 text-[14px] font-semibold text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
              <textarea
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={11}
                maxLength={5000}
                placeholder={t("messages.bodyPlaceholder")}
                data-testid="compose-body"
                dir="auto"
                className="min-h-56 w-full flex-1 resize-y rounded-xl border border-forest/15 bg-cream p-3.5 text-[14px] leading-7 text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
              <p className="mt-1.5 flex justify-between text-[11px] text-clay/80">
                <span>{t("msg.sendShortcut")}</span>
                <span dir="ltr" className="tabular-nums">
                  {draft.body.length}/5000
                </span>
              </p>
            </section>
          </div>
        </div>

        {/* footer */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-forest/10 bg-cream-2 px-5 py-3.5">
          <div className="min-w-0 flex-1 text-[12.5px]">
            {error ? (
              <p className="flex items-start gap-1.5 font-semibold text-red-600 dark:text-red-400" data-testid="compose-error">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {error}
              </p>
            ) : (
              <p className="text-clay" data-testid="compose-reach">
                {draft.mode === "direct"
                  ? t("msg.compose.reachDirect", { count: reach })
                  : audience.isFetching
                    ? t("msg.compose.counting")
                    : t("msg.compose.reachAudience", { count: reach })}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5">
            {t("admin.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            data-testid="compose-send"
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold shadow-md transition active:scale-95 ${
              canSend ? "bg-gold text-forest-deep hover:bg-gold-soft" : "bg-forest/15 text-forest/50"
            }`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} className="ltr:-scale-x-100 rtl:rotate-180" />}
            {draft.mode === "audience" ? t("msg.compose.sendBroadcast", { count: reach }) : t("messages.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── direct: pick people ───────────────────────────────────── */

/** Professors, administration, students — the order the cards are shown in. */
const ROLE_CARDS: { role: ContactRole; icon: LucideIcon }[] = [
  { role: "professor", icon: UserRound },
  { role: "admin", icon: ShieldCheck },
  { role: "student", icon: GraduationCap },
];

const GROUP_TONE: Record<ContactRole, { bar: string; text: string; chip: string; card: string; icon: string }> = {
  admin: {
    bar: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
    card: "hover:border-violet-400/60 hover:bg-violet-500/[0.06]",
    icon: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  },
  professor: {
    bar: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    card: "hover:border-sky-400/60 hover:bg-sky-500/[0.06]",
    icon: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  },
  student: {
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    card: "hover:border-emerald-400/60 hover:bg-emerald-500/[0.06]",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
};

/**
 * Picking recipients in two steps: first the kind of person — professor,
 * administrator or student — then that person, from a list and a search that
 * hold that kind only. Each card says how many are available, so an empty
 * choice is visible before it is made. Recipients of different kinds can be
 * combined: pick one, change the kind, pick another.
 */
function ContactPicker({ picked, onChange }: { picked: Contact[]; onChange: (v: Contact[]) => void }) {
  const { t } = useTranslation();
  const [role, setRole] = useState<ContactRole | null>(null);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(id);
  }, [term]);

  // Step one needs the counts only; step two the chosen role's people.
  const overview = useContacts("", role === null);
  const list = useContacts(debounced, role !== null, role ?? undefined);
  const counts = overview.data?.counts ?? list.data?.counts;
  const results = useMemo(
    () => (list.data?.items ?? []).filter((c) => !picked.some((p) => p.id === c.id)),
    [list.data, picked],
  );

  function choose(r: ContactRole | null) {
    setRole(r);
    setTerm("");
    setDebounced("");
    setActive(0);
    if (r) setTimeout(() => inputRef.current?.focus(), 0);
  }

  function add(c: Contact) {
    if (picked.length >= 200) return;
    onChange([...picked, c]);
    setTerm("");
    setActive(0);
    inputRef.current?.focus();
  }

  return (
    <div>
      {/* who is already on the list */}
      {picked.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" data-testid="picked-list">
          {picked.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 py-0.5 ps-0.5 pe-1.5 text-[12px] font-semibold text-forest"
              data-testid="picked-chip"
            >
              <UserAvatar user={p} size={22} />
              {personName(p)}
              <span className={`size-1.5 rounded-full ${GROUP_TONE[p.role as ContactRole]?.bar ?? "bg-clay"}`} aria-hidden />
              <button
                type="button"
                onClick={() => onChange(picked.filter((x) => x.id !== p.id))}
                aria-label={t("msg.remove")}
                className="grid size-5 place-items-center rounded-full text-clay hover:bg-red-500/15 hover:text-red-500"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {role === null ? (
        /* ── step 1: what kind of person ── */
        <div data-testid="role-step">
          <p className="mb-2.5 text-[13px] font-bold text-forest">{t("msg.compose.pickRole")}</p>
          <div className="grid grid-cols-1 gap-2.5">
            {ROLE_CARDS.map(({ role: r, icon: Icon }) => {
              const n = counts?.[r];
              const none = n === 0;
              const tone = GROUP_TONE[r];
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => choose(r)}
                  disabled={none}
                  data-testid={`role-card-${r}`}
                  className={`group flex items-center gap-3.5 rounded-2xl border border-forest/15 bg-cream p-4 text-start transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    none ? "" : tone.card
                  }`}
                >
                  <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tone.icon}`}>
                    <Icon size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-forest">{t(`msg.compose.roleCard.${r}`)}</span>
                    <span className="block text-[12px] text-clay">{t(`msg.compose.roleHint.${r}`)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold tabular-nums ${tone.chip}`}>
                    {overview.isLoading
                      ? "…"
                      : none
                        ? t("msg.compose.noneAvailable")
                        : t("msg.compose.available", { count: n ?? 0 })}
                  </span>
                  {!none && <ChevronLeft size={18} className="shrink-0 text-clay transition group-hover:text-forest ltr:rotate-180" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── step 2: that person ── */
        <div data-testid="person-step">
          <div className="mb-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => choose(null)}
              data-testid="change-role"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-clay transition hover:bg-forest/10 hover:text-forest"
            >
              <ChevronRight size={15} className="ltr:rotate-180" />
              {t("msg.compose.changeRole")}
            </button>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${GROUP_TONE[role].chip}`}>
              <span className={`size-2 rounded-full ${GROUP_TONE[role].bar}`} />
              {t(`msg.compose.group.${role}`)}
              {counts && <span className="tabular-nums opacity-80">· {counts[role]}</span>}
            </span>
          </div>

          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-clay" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  add(results[active]);
                } else if (e.key === "Escape" && !term) {
                  e.stopPropagation();
                  choose(null);
                }
              }}
              placeholder={t(`msg.compose.searchIn.${role}`)}
              data-testid="contact-search"
              className="h-11 w-full rounded-xl border border-forest/15 bg-cream ps-9 pe-9 text-[13.5px] text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
            />
            {list.isFetching && <Loader2 size={14} className="absolute top-1/2 end-3 -translate-y-1/2 animate-spin text-clay" />}
          </div>

          <p className="mt-3 mb-1.5 text-[11px] font-semibold text-clay">
            {debounced ? t("msg.compose.results") : t("msg.compose.suggested")}
          </p>
          <ul className="max-h-[20rem] space-y-1 overflow-y-auto pe-1" role="listbox" data-testid="contact-results">
            {results.length === 0 && !list.isFetching ? (
              <li className="rounded-xl border border-dashed border-forest/15 px-3 py-6 text-center text-[12px] text-clay">
                {debounced ? t("messages.noMatches") : t("msg.compose.noContacts")}
              </li>
            ) : (
              results.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(c)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition ${
                      i === active ? "bg-gold/10 ring-1 ring-gold/30" : "hover:bg-forest/5"
                    }`}
                  >
                    <UserAvatar user={c} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-semibold text-forest">{personName(c)}</span>
                        {/* the kind is already chosen; only a closer tie is worth a chip */}
                        {(c.relation === "supervisor" || c.relation === "teammate") && <RelationChip relation={c.relation} />}
                        {c.recent && <Sparkles size={12} className="shrink-0 text-gold" aria-label={t("msg.compose.recent")} />}
                      </span>
                      <span className="block truncate text-[11.5px] text-clay" dir="auto">
                        {[c.detail, c.handle].filter(Boolean).join(" · ") || t(`roles.${c.role}`)}
                      </span>
                    </span>
                    <Check size={15} className={`shrink-0 text-gold ${i === active ? "opacity-100" : "opacity-0"}`} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── broadcast: describe the audience ──────────────────────── */
const TARGETS: { v: AudienceInput["target"]; icon: LucideIcon }[] = [
  { v: "students", icon: GraduationCap },
  { v: "professors", icon: UserRound },
  { v: "all", icon: Globe },
  { v: "admins", icon: ShieldCheck },
];

function AudienceBuilder({
  value,
  onChange,
  count,
  sample,
  loading,
}: {
  value: AudienceInput;
  onChange: (v: AudienceInput) => void;
  count?: number;
  sample: { id: string; firstName: string | null; lastName: string | null; avatarUrl: string | null; role: string }[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();

  const students = value.target === "students" || value.target === "all";
  const academic = value.target !== "admins";
  const patch = (p: Partial<AudienceInput>) => onChange({ ...value, ...p });

  const deps = ((departments ?? []) as any[]).filter((d) => !value.facultyId || d.facultyId === value.facultyId);
  const fils = ((filieres ?? []) as any[]).filter(
    (f) =>
      (!value.departmentId || f.departmentId === value.departmentId) &&
      (!value.facultyId || f.department?.facultyId === value.facultyId),
  );
  const sps = ((specs ?? []) as any[]).filter((s) => {
    if (value.filiereId) return s.filiereId === value.filiereId || s.filiere?.id === value.filiereId;
    if (value.departmentId) return s.filiere?.departmentId === value.departmentId;
    if (value.facultyId) return s.filiere?.department?.facultyId === value.facultyId;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {TARGETS.map(({ v, icon: Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() =>
              onChange(
                v === "admins"
                  ? { target: v }
                  : v === "professors"
                    ? { target: v, facultyId: value.facultyId, departmentId: value.departmentId }
                    : { ...value, target: v },
              )
            }
            aria-pressed={value.target === v}
            data-testid={`audience-${v}`}
            className={`flex items-center gap-2.5 rounded-xl border p-3 text-start transition ${
              value.target === v ? "border-gold bg-gold/10 ring-1 ring-gold/40" : "border-forest/15 hover:border-forest/30 hover:bg-forest/[0.03]"
            }`}
          >
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${value.target === v ? "bg-gold/20 text-gold" : "bg-forest/5 text-clay"}`}>
              <Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-forest">{t(`msg.audience.target.${v}`)}</span>
              <span className="block truncate text-[11px] text-clay">{t(`msg.audience.hint.${v}`)}</span>
            </span>
          </button>
        ))}
      </div>

      {academic && (
        <div className="space-y-2.5 rounded-2xl border border-forest/10 bg-cream-2/50 p-3.5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-forest">
            <Building2 size={13} className="text-gold" />
            {t("msg.audience.narrow")}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select
              value={value.facultyId ?? ""}
              onChange={(v) => patch({ facultyId: v || undefined, departmentId: undefined, filiereId: undefined, specializationId: undefined })}
              options={[{ value: "", label: t("admin.proj.allFaculties") }, ...((faculties ?? []) as any[]).map((f) => ({ value: f.id, label: f.name }))]}
            />
            <Select
              value={value.departmentId ?? ""}
              onChange={(v) => patch({ departmentId: v || undefined, filiereId: undefined, specializationId: undefined })}
              options={[{ value: "", label: t("admin.proj.allDepartments") }, ...deps.map((d) => ({ value: d.id, label: d.name }))]}
            />
            {students && (
              <>
                <Select
                  value={value.filiereId ?? ""}
                  onChange={(v) => patch({ filiereId: v || undefined, specializationId: undefined })}
                  options={[{ value: "", label: t("msg.audience.allFilieres") }, ...fils.map((f) => ({ value: f.id, label: f.name }))]}
                />
                <Select
                  value={value.specializationId ?? ""}
                  onChange={(v) => patch({ specializationId: v || undefined })}
                  options={[{ value: "", label: t("messages.allSpecializations") }, ...sps.map((s) => ({ value: s.id, label: s.name }))]}
                />
                <Select
                  value={value.level ?? ""}
                  onChange={(v) => patch({ level: (v || undefined) as AudienceInput["level"] })}
                  options={[
                    { value: "", label: t("msg.audience.allLevels") },
                    { value: "licence", label: t("msg.level.licence") },
                    { value: "master", label: t("msg.level.master") },
                    { value: "doctorate", label: t("msg.level.doctorate") },
                  ]}
                />
                <Select
                  value={value.academicYearId ?? ""}
                  onChange={(v) => patch({ academicYearId: v || undefined })}
                  options={[{ value: "", label: t("admin.allYears") }, ...((years ?? []) as any[]).map((y) => ({ value: y.id, label: y.title }))]}
                />
              </>
            )}
          </div>
          {students && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="me-1 inline-flex items-center gap-1 text-[11.5px] text-clay">
                <FolderKanban size={12} />
                {t("msg.audience.projectLabel")}
              </span>
              {([undefined, "with", "without"] as const).map((p) => (
                <button
                  key={p ?? "any"}
                  type="button"
                  onClick={() => patch({ project: p })}
                  aria-pressed={value.project === p}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${
                    value.project === p ? "bg-forest text-cream" : "bg-forest/5 text-clay hover:bg-forest/10"
                  }`}
                >
                  {t(`msg.audience.project-${p ?? "any"}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* the live count */}
      <div
        className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
          count === 0 ? "border-red-300/60 bg-red-500/5" : "border-gold/30 bg-gold/[0.06]"
        }`}
        data-testid="audience-count"
      >
        <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${count === 0 ? "bg-red-500/10 text-red-600" : "bg-gold/15 text-gold"}`}>
          {loading ? <Loader2 size={22} className="animate-spin" /> : count === 0 ? <AlertTriangle size={22} /> : <Users size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-2xl font-bold text-forest tabular-nums">{count ?? "—"}</p>
          <p className="text-[12px] text-clay">{count === 0 ? t("msg.audience.none") : t("msg.audience.willReach")}</p>
        </div>
        {sample.length > 0 && (
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {sample.slice(0, 5).map((u) => (
              <UserAvatar key={u.id} user={u} size={30} className="border-2 border-cream-card" />
            ))}
          </div>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-clay">
        <Layers size={12} className="mt-0.5 shrink-0" />
        {t("msg.audience.activeOnly")}
      </p>
    </div>
  );
}
