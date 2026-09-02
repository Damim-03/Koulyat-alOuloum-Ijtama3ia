import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Inbox,
    Send,
    PenSquare,
    Search,
    X,
    Check,
    CheckCheck,
    Trash2,
    Users,
    GraduationCap,
    UserRound,
    Globe,
    Layers,
    Mail,
    MailOpen,
    ChevronDown,
    Loader2,
    Megaphone,
} from "lucide-react";
import {
    useInbox,
    useSentMessages,
    useUnreadMessagesCount,
    useSendMessage,
    useBroadcastMessage,
    useMarkMessageRead,
    useMarkAllMessagesRead,
    useDeleteInboxMessage,
} from "../../hooks/messages-hook";
import type {
    AppMessage,
    InboxItem,
    MessageUserLite,
} from "../../api/messages.api";
import { useUsers, useSpecializations } from "../../hooks/admin-hook";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import i18n from "../../../../i18n/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 10;

function personName(u?: MessageUserLite | null) {
    return (
        [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "\u2014"
    );
}
function initials(u?: MessageUserLite | null) {
    return (u?.firstName?.[0] ?? "") + (u?.lastName?.[0] ?? "") || "\u061f";
}
function fmtDateTime(iso?: string) {
    if (!iso) return "\u2014";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "\u2014"
        : d.toLocaleString(i18n.language, {
            dateStyle: "medium",
            timeStyle: "short",
          } as any);
}

// Keys, not copy: built once at import time.
const ROLE_LABEL_KEY: Record<string, string> = {
  owner: "roles.owner",
  admin: "roles.admin",
  professor: "roles.professor",
  student: "roles.student",
};

type Tab = "inbox" | "sent" | "compose";

export function AdminMessagesPage() {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>("inbox");
    const { data: unread = 0 } = useUnreadMessagesCount();

    return (
        <div className="font-body">
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="font-serif text-2xl font-bold text-forest">
                        {t("admin.messagesTitle", { defaultValue: t("messages.title") })}
                    </h1>
                    <p className="mt-1 text-sm text-clay">
                        {t("admin.messagesSubtitle", {
                            defaultValue: t("messages.subtitle"),
                        })}
                    </p>
                </div>
                <button
                    onClick={() => setTab("compose")}
                    className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep shadow-sm transition hover:bg-gold-soft"
                >
                    <PenSquare size={17} />{t("messages.newMessage")}</button>
            </div>

            {/* Tabs */}
            <div className="mb-5 inline-flex rounded-xl border border-forest/15 bg-cream-2 p-1">
                <TabBtn
                    active={tab === "inbox"}
                    onClick={() => setTab("inbox")}
                    icon={Inbox}
                    label={t("messages.inbox")}
                    badge={unread > 0 ? unread : undefined}
                />
                <TabBtn
                    active={tab === "sent"}
                    onClick={() => setTab("sent")}
                    icon={Send}
                    label={t("messages.sent")}
                />
                <TabBtn
                    active={tab === "compose"}
                    onClick={() => setTab("compose")}
                    icon={PenSquare}
                    label={t("pro.create")}
                />
            </div>

            {tab === "inbox" && <InboxTab />}
            {tab === "sent" && <SentTab />}
            {tab === "compose" && <ComposeTab onSent={() => setTab("sent")} />}
        </div>
    );
}

function TabBtn({
                    active,
                    onClick,
                    icon: Icon,
                    label,
                    badge,
                }: {
    active: boolean;
    onClick: () => void;
    icon: typeof Inbox;
    label: string;
    badge?: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-forest text-cream" : "text-clay hover:text-forest"
            }`}
        >
            <Icon size={15} />
            {label}
            {badge != null && (
                <span
                    className={`grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${
                        active ? "bg-cream/20 text-cream" : "bg-red-100 text-red-600"
                    }`}
                >
          {badge}
        </span>
            )}
        </button>
    );
}

/* ════════════════════════════════════════════════════════════
   INBOX
   ════════════════════════════════════════════════════════════ */
function InboxTab() {
  const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const { data, isLoading } = useInbox({
        page,
        limit: PAGE_SIZE,
        unread: unreadOnly || undefined,
    });
    const markRead = useMarkMessageRead();
    const markAll = useMarkAllMessagesRead();
    const del = useDeleteInboxMessage();

    const items = (data?.items ?? []) as InboxItem[];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function openMessage(item: InboxItem) {
        setOpenId((cur) => (cur === item.id ? null : item.id));
        if (!item.readAt) markRead.mutate(item.message.id);
    }

    return (
        <div>
            {/* toolbar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-clay">
                    <input
                        type="checkbox"
                        checked={unreadOnly}
                        onChange={(e) => {
                            setUnreadOnly(e.target.checked);
                            setPage(1);
                        }}
                        className="size-4 accent-gold"
                    />{t("messages.unreadOnly")}</label>
                <button
                    onClick={() => markAll.mutate()}
                    disabled={markAll.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-50"
                >
                    <CheckCheck size={14} />{t("messages.markAllRead")}</button>
            </div>

            {isLoading ? (
                <div className="py-16 text-center text-sm text-clay">{"\u2026"}</div>
            ) : items.length === 0 ? (
                <EmptyCard icon={Inbox} text={t("messages.noInbox")} />
            ) : (
                <ul className="space-y-2">
                    {items.map((it) => {
                        const m = it.message;
                        const opened = openId === it.id;
                        const isUnread = !it.readAt;
                        return (
                            <li
                                key={it.id}
                                className={`overflow-hidden rounded-2xl border transition ${
                                    isUnread
                                        ? "border-gold/40 bg-gold/5"
                                        : "border-forest/10 bg-cream-card"
                                }`}
                            >
                                <button
                                    onClick={() => openMessage(it)}
                                    className="flex w-full items-center gap-3 p-4 text-start"
                                >
                                    <Avatar u={m.sender} ring={isUnread} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                      <span
                          className={`truncate text-sm ${isUnread ? "font-bold text-forest" : "font-semibold text-forest/90"}`}
                      >
                        {personName(m.sender)}
                      </span>
                                            <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[10px] font-semibold text-forest">
                        {t(ROLE_LABEL_KEY[m.sender.role]) ?? m.sender.role}
                      </span>
                                            {m.broadcast && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-soft-sage/40 px-2 py-0.5 text-[10px] font-semibold text-forest">
                          <Megaphone size={10} />{t("messages.broadcast")}</span>
                                            )}
                                        </div>
                                        <p
                                            className={`mt-0.5 truncate text-sm ${isUnread ? "font-semibold text-forest" : "text-clay"}`}
                                        >
                                            {m.subject || m.body}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-clay">
                      {fmtDateTime(m.createdAt)}
                    </span>
                                        {isUnread ? (
                                            <Mail size={15} className="text-gold" />
                                        ) : (
                                            <MailOpen size={15} className="text-clay/50" />
                                        )}
                                    </div>
                                    <ChevronDown
                                        size={16}
                                        className={`shrink-0 text-clay/50 transition ${opened ? "rotate-180" : ""}`}
                                    />
                                </button>

                                {opened && (
                                    <div className="border-t border-forest/10 px-4 py-4">
                                        {m.subject && (
                                            <h3 className="mb-2 font-serif text-base font-bold text-forest">
                                                {m.subject}
                                            </h3>
                                        )}
                                        <p className="whitespace-pre-line text-sm leading-relaxed text-forest/90">
                                            {m.body}
                                        </p>
                                        <div className="mt-4 flex justify-end">
                                            <button
                                                onClick={() => setDeleteId(m.id)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                                            >
                                                <Trash2 size={13} />{t("messages.deleteFromInbox")}</button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <Pager page={page} totalPages={totalPages} onPage={setPage} />

            <ConfirmDialog
                open={!!deleteId}
                tone="danger"
                title={t("messages.deleteMessage")}
                message={t("messages.deleteConfirm")}
                confirmLabel={t("messages.yesDelete")}
                cancelLabel={t("pro.cancel")}
                loading={del.isPending}
                onConfirm={() =>
                    deleteId &&
                    del.mutate(deleteId, {
                        onSuccess: () => setDeleteId(null),
                    })
                }
                onClose={() => setDeleteId(null)}
            />
        </div>
    );
}

/* ════════════════════════════════════════════════════════════
   SENT
   ════════════════════════════════════════════════════════════ */
function SentTab() {
  const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [openId, setOpenId] = useState<string | null>(null);
    const { data, isLoading } = useSentMessages({ page, limit: PAGE_SIZE });

    const items = (data?.items ?? []) as AppMessage[];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div>
            {isLoading ? (
                <div className="py-16 text-center text-sm text-clay">{"\u2026"}</div>
            ) : items.length === 0 ? (
                <EmptyCard icon={Send} text={t("messages.noneSent")} />
            ) : (
                <ul className="space-y-2">
                    {items.map((m) => {
                        const opened = openId === m.id;
                        const count = m._count?.recipients ?? m.recipients?.length ?? 0;
                        return (
                            <li
                                key={m.id}
                                className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card"
                            >
                                <button
                                    onClick={() => setOpenId((c) => (c === m.id ? null : m.id))}
                                    className="flex w-full items-center gap-3 p-4 text-start"
                                >
                                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-cream">
                                        {m.broadcast ? <Megaphone size={17} /> : <Send size={16} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-forest">
                        {m.subject || t("messages.noSubject")}
                      </span>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-forest/8 px-2 py-0.5 text-[10px] font-semibold text-forest">
                        <Users size={10} />{" "}
                    {t("messages.recipientsCount", { count })}
                      </span>
                                            {m.broadcast && (
                                                <span className="rounded-full bg-soft-sage/40 px-2 py-0.5 text-[10px] font-semibold text-forest">
                          {broadcastLabel(m.broadcast, t)}
                        </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 truncate text-sm text-clay">{m.body}</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-clay">
                    {fmtDateTime(m.createdAt)}
                  </span>
                                    <ChevronDown
                                        size={16}
                                        className={`shrink-0 text-clay/50 transition ${opened ? "rotate-180" : ""}`}
                                    />
                                </button>

                                {opened && (
                                    <div className="border-t border-forest/10 px-4 py-4">
                                        <p className="whitespace-pre-line text-sm leading-relaxed text-forest/90">
                                            {m.body}
                                        </p>
                                        {m.recipients && m.recipients.length > 0 && (
                                            <div className="mt-4">
                                                <p className="mb-2 text-[11px] font-medium text-clay">{t("messages.firstRecipients")}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {m.recipients.map((r) => (
                                                        <span
                                                            key={r.id}
                                                            className="inline-flex items-center gap-1.5 rounded-full bg-cream-2 py-1 pl-3 pr-1 text-xs text-forest"
                                                        >
                              <Avatar u={r.user} size={6} />
                                                            {personName(r.user)}
                                                            {r.readAt && (
                                                                <Check size={12} className="text-emerald-600" />
                                                            )}
                            </span>
                                                    ))}
                                                    {count > (m.recipients?.length ?? 0) && (
                                                        <span className="rounded-full bg-cream-2 px-3 py-1 text-xs text-clay">
                              {t("messages.othersCount", {
                          count: count - (m.recipients?.length ?? 0),
                        })}
                            </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
    );
}

/** `t` is passed in: this helper lives outside any component. */
function broadcastLabel(tag: string, t: (k: string) => string) {
  if (tag === "all") return t("pro.all");
  if (tag === "professors") return t("admin.allProfessors");
  if (tag.startsWith("students:")) return t("admin.specializationStudents");
  return t("admin.allStudentsTab");
}

/* ════════════════════════════════════════════════════════════
   COMPOSE
   ════════════════════════════════════════════════════════════ */
type Mode = "direct" | "all" | "students" | "professors";

function ComposeTab({ onSent }: { onSent: () => void }) {
  const { t } = useTranslation();
    const [mode, setMode] = useState<Mode>("direct");
    const [specializationId, setSpecializationId] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [picked, setPicked] = useState<MessageUserLite[]>([]);

    const send = useSendMessage();
    const broadcast = useBroadcastMessage();
    const { data: specs } = useSpecializations();

    const busy = send.isPending || broadcast.isPending;
    const canSubmit =
        body.trim().length > 0 &&
        !busy &&
        (mode !== "direct" || picked.length > 0);

    function submit() {
        if (!canSubmit) return;
        const common = { subject: subject.trim() || undefined, body: body.trim() };
        const after = () => {
            setSubject("");
            setBody("");
            setPicked([]);
            onSent();
        };
        if (mode === "direct") {
            send.mutate(
                { ...common, recipientIds: picked.map((p) => p.id) },
                { onSuccess: after },
            );
        } else {
            broadcast.mutate(
                {
                    ...common,
                    target: mode,
                    specializationId:
                        mode === "students" && specializationId
                            ? specializationId
                            : undefined,
                },
                { onSuccess: after },
            );
        }
    }

    const MODES: { v: Mode; label: string; icon: typeof Globe }[] = [
        { v: "direct", label: t("messages.selectedRecipients"), icon: UserRound },
        { v: "students", label: t("admin.allStudentsTab"), icon: GraduationCap },
        { v: "professors", label: t("messages.allProfessors"), icon: Users },
        { v: "all", label: t("stu.allLevels"), icon: Globe },
    ];

    return (
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            {/* target mode */}
            <p className="mb-2 text-[11px] font-medium text-clay">{t("messages.to")}</p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODES.map(({ v, label, icon: Icon }) => (
                    <button
                        key={v}
                        onClick={() => setMode(v)}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                            mode === v
                                ? "border-gold bg-gold/10 text-forest"
                                : "border-forest/15 text-clay hover:border-forest/30 hover:text-forest"
                        }`}
                    >
                        <Icon size={15} />
                        {label}
                    </button>
                ))}
            </div>

            {/* specialization narrowing for students broadcast */}
            {mode === "students" && (
                <label className="mb-4 block">
          <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-clay">
            <Layers size={12} />{t("messages.limitToSpecialization")}</span>
                    <select
                        value={specializationId}
                        onChange={(e) => setSpecializationId(e.target.value)}
                        className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 sm:max-w-xs"
                    >
                        <option value="">{t("messages.allSpecializations")}</option>
                        {(specs ?? []).map((s: any) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            {/* direct recipient picker */}
            {mode === "direct" && (
                <RecipientPicker picked={picked} onChange={setPicked} />
            )}

            {/* subject + body */}
            <label className="mb-3 block">
        <span className="mb-1 block text-[11px] font-medium text-clay">{t("messages.subjectOptional")}</span>
                <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                    placeholder={t("messages.subjectPlaceholder")}
                />
            </label>
            <label className="mb-4 block">
        <span className="mb-1 block text-[11px] font-medium text-clay">{t("messages.body")}</span>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    maxLength={5000}
                    className="w-full resize-y rounded-xl border border-forest/15 bg-cream-2 p-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                    placeholder={t("messages.bodyPlaceholder")}
                />
                <span className="mt-1 block text-left text-[10px] text-clay/70" dir="ltr">
          {body.length}/5000
        </span>
            </label>

            {/* submit */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-clay">
                    {mode === "direct"
                        ? t("messages.selectedCount", { count: picked.length })
                        : t("messages.broadcastNote")}
                </p>
                <button
                    onClick={submit}
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-3 text-sm font-bold text-cream shadow-md transition hover:bg-forest-deep active:scale-95 disabled:opacity-50"
                >
                    {busy ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Send size={16} />
                    )}
                    {t("messages.send")}
                </button>
            </div>
        </div>
    );
}

/* ── searchable recipient picker (uses admin users list) ───── */
function RecipientPicker({
                             picked,
                             onChange,
                         }: {
    picked: MessageUserLite[];
    onChange: (v: MessageUserLite[]) => void;
}) {
  const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    useEffect(() => {
        const id = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    const { data, isFetching } = useUsers({
        page: 1,
        limit: 8,
        search: debounced || undefined,
    });
    const results = ((data?.items ?? []) as any[]).filter(
        (u) => !picked.some((p) => p.id === u.id),
    );

    function add(u: any) {
        onChange([...picked, u]);
        setSearch("");
    }
    function remove(id: string) {
        onChange(picked.filter((p) => p.id !== id));
    }

    return (
        <div className="mb-4">
            {/* chips */}
            {picked.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {picked.map((p) => (
                        <span
                            key={p.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-forest/8 py-1 pl-1 pr-3 text-xs font-semibold text-forest"
                        >
              {personName(p)}
                            <button
                                onClick={() => remove(p.id)}
                                className="grid size-5 place-items-center rounded-full text-clay transition hover:bg-red-100 hover:text-red-500"
                            >
                <X size={11} />
              </button>
            </span>
                    ))}
                </div>
            )}

            {/* search */}
            <div className="relative">
                <Search
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
                    size={16}
                />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("messages.searchRecipients")}
                    className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-9 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
                {isFetching && (
                    <Loader2
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-clay"
                    />
                )}
            </div>

            {/* results */}
            {debounced && results.length > 0 && (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-forest/10 bg-cream-card p-2">
                    {results.map((u: any) => (
                        <li key={u.id}>
                            <button
                                onClick={() => add(u)}
                                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition hover:bg-forest/5"
                            >
                                <Avatar u={u} size={8} />
                                <span className="min-w-0 flex-1 truncate text-sm text-forest">
                  {personName(u)}
                </span>
                                <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[10px] text-forest">
                  {t(ROLE_LABEL_KEY[u.role]) ?? u.role}
                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {debounced && !isFetching && results.length === 0 && (
                <p className="mt-2 text-center text-xs text-clay">{t("messages.noMatches")}</p>
            )}
        </div>
    );
}

/* ── small shared bits ─────────────────────────────────────── */
function Avatar({
                    u,
                    size = 10,
                    ring,
                }: {
    u?: MessageUserLite | null;
    size?: 6 | 8 | 10;
    ring?: boolean;
}) {
    const cls =
        size === 6 ? "size-6 text-[9px]" : size === 8 ? "size-8 text-[10px]" : "size-10 text-xs";
    if (u?.avatarUrl)
        return (
            <img
                src={u.avatarUrl}
                alt=""
                className={`${cls} shrink-0 rounded-full object-cover ${ring ? "ring-2 ring-gold/50" : ""}`}
            />
        );
    return (
        <div
            className={`${cls} grid shrink-0 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep font-bold text-cream ${ring ? "ring-2 ring-gold/50" : ""}`}
        >
            {initials(u)}
        </div>
    );
}

function EmptyCard({ icon: Icon, text }: { icon: typeof Inbox; text: string }) {
    return (
        <div className="grid place-items-center gap-2 rounded-2xl border border-forest/10 bg-cream-card py-16 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="grid size-14 place-items-center rounded-full bg-forest/5 text-clay">
                <Icon size={24} />
            </div>
            <p className="text-sm text-clay">{text}</p>
        </div>
    );
}

function Pager({
                   page,
                   totalPages,
                   onPage,
               }: {
    page: number;
    totalPages: number;
    onPage: (p: number) => void;
}) {
    if (totalPages <= 1) return null;
    return (
        <div className="mt-5 flex items-center justify-center gap-1">
            <button
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
                className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
                {"\u2039"}
            </button>
            <span className="px-3 text-sm text-forest">
        {page} / {totalPages}
      </span>
            <button
                disabled={page >= totalPages}
                onClick={() => onPage(page + 1)}
                className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
                {"\u203a"}
            </button>
        </div>
    );
}