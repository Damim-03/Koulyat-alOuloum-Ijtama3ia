import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  Lock,
  Megaphone,
  MessagesSquare,
  MoreHorizontal,
  PanelLeftOpen,
  Pencil,
  RotateCcw,
  SendHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { UserAvatar } from "../../../components/ui/user-avatar";
import {
  useChat,
  useDeleteForEveryone,
  useDiscardFailed,
  useEditChatMessage,
  useMarkChatRead,
  useSendChat,
  useTyping,
} from "../hooks/chat-hooks";
import { useAuthStore } from "../../../store/auth.store";
import { useNow } from "../../../hooks/use-now";
import { useEscapeToClose } from "../../../hooks/use-escape";
import { ConfirmDialog } from "../../admin/components/form/confirm-dialog.form";
import type { ChatMessage, MessageAttachment } from "../api/messages.api";
import {
  MAX_FILE_MB,
  MAX_FILES,
  broadcastLabel,
  clockTime,
  dayLabel,
  fullWhen,
  personName,
  previewOf,
  relativeWhen,
  sameDayIso,
  setOpenChat,
  stillEditable,
} from "../messages-utils";
import { forgetDrafts, useAttachmentDrafts, type AttachmentDrafts } from "../hooks/use-attachments";
import { AttachButton, AttachmentList, DraftTray } from "./attachments";
import { EmptyPane, RoleChip } from "./messages-ui";

const GROUP_GAP = 5 * 60_000;

/**
 * One chat, as Telegram or Instagram draw it: my messages on one side in the
 * accent colour, theirs on the other, grouped when they follow each other,
 * the time and the ticks inside the bubble, a pill between days. What they
 * send appears by itself; what I send appears before the server has answered.
 */
export function ChatView({
  userId,
  onBack,
  sidebarCollapsed,
  onExpandSidebar,
}: {
  userId: string;
  onBack: () => void;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
}) {
  const { t } = useTranslation();
  const q = useChat(userId);
  const send = useSendChat(userId);
  const discard = useDiscardFailed(userId);
  const { mutate: markChatRead } = useMarkChatRead();
  const typing = useTyping(userId);
  // The files of the message being written. The page keys this view by the
  // person, so they never follow the writer into another chat.
  const drafts = useAttachmentDrafts();
  const [dropping, setDropping] = useState(false);
  // The text being written lives here, so editing a sent message — which
  // takes the composer's place — does not lose it.
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [toDelete, setToDelete] = useState<ChatMessage | null>(null);
  const edit = useEditChatMessage(userId);
  const retract = useDeleteForEveryone(userId);
  // Only the administration withdraws what it sent.
  const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
  // A message stops being editable after a few minutes: looked at again every half minute.
  const now = useNow(true, 30_000);

  const pages = useMemo(() => q.data?.pages ?? [], [q.data]);
  const user = pages[0]?.user;
  const canWrite = pages[0]?.canWrite ?? false;
  const items = useMemo(() => [...pages].reverse().flatMap((p) => p.items), [pages]);

  // This chat is on screen: its messages need no toast.
  useEffect(() => {
    setOpenChat(userId);
    return () => setOpenChat(null);
  }, [userId]);

  // Reading is opening: whatever they sent is marked read, and they see it.
  const unreadFromThem = items.filter((m) => !m.mine && !m.readAt && !m.pending).length;
  useEffect(() => {
    if (unreadFromThem > 0) markChatRead(userId);
  }, [unreadFromThem, userId, markChatRead]);

  // Their new message ends their "typing…".
  const lastTheirs = [...items].reverse().find((m) => !m.mine)?.id;
  const { clearTheirs } = typing;
  useEffect(() => {
    if (lastTheirs) clearTheirs();
  }, [lastTheirs, clearTheirs]);

  /* ── scrolling ── */
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const heightBefore = useRef<number | null>(null);
  const [seen, setSeen] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const lastMine = items.at(-1)?.mine;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (heightBefore.current !== null) {
      // Older messages were added above: keep the reader where they were.
      el.scrollTop += el.scrollHeight - heightBefore.current;
      heightBefore.current = null;
      return;
    }
    if (atBottom.current || lastMine) el.scrollTop = el.scrollHeight;
  }, [items.length, lastMine]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottom.current = bottom;
    setShowJump(!bottom);
    if (bottom) setSeen(items.length);
    if (el.scrollTop < 120 && q.hasNextPage && !q.isFetchingNextPage) {
      heightBefore.current = el.scrollHeight;
      q.fetchNextPage();
    }
  }
  const unseen = showJump && seen > 0 ? Math.max(0, items.length - seen) : 0;

  function jump() {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  if (q.isLoading)
    return (
      <div className="grid h-full place-items-center">
        <Loader2 size={24} className="animate-spin text-gold" />
      </div>
    );
  if (q.isError || !user) return <EmptyPane icon={MessagesSquare} title={t("msg.gone")} hint={t("msg.chat.unknownPerson")} />;

  const carriesFiles = (e: React.DragEvent) => canWrite && Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      data-testid="chat-view"
      // Files dropped anywhere on the chat join the message being written.
      onDragEnter={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragOver={(e) => carriesFiles(e) && e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        if (!canWrite) return;
        e.preventDefault();
        setDropping(false);
        if (e.dataTransfer.files.length) drafts.add(e.dataTransfer.files);
      }}
    >
      {dropping && (
        <div
          className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-gold bg-cream/85 backdrop-blur-sm"
          data-testid="drop-overlay"
        >
          <div className="text-center">
            <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Upload size={26} />
            </span>
            <p className="text-[15px] font-bold text-forest">{t("msg.files.dropHere")}</p>
            <p className="mt-1 text-[12px] text-clay">{t("msg.files.hint", { max: MAX_FILES, mb: MAX_FILE_MB })}</p>
          </div>
        </div>
      )}
      {/* header */}
      <header className="flex items-center gap-3 border-b border-forest/10 bg-cream-card px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t("msg.back")} className="grid size-9 shrink-0 place-items-center rounded-xl text-clay transition hover:bg-forest/10 lg:hidden">
          <ArrowRight size={18} className="ltr:rotate-180" />
        </button>
        {sidebarCollapsed && (
          <button type="button" onClick={onExpandSidebar} aria-label={t("msg.chat.expand")} className="hidden size-9 shrink-0 place-items-center rounded-xl text-clay transition hover:bg-forest/10 lg:grid">
            <PanelLeftOpen size={18} className="rtl:-scale-x-100" />
          </button>
        )}
        <span className="relative shrink-0">
          <UserAvatar user={user} size={44} />
          {user.online && <span className="absolute end-0 bottom-0 size-3 rounded-full border-2 border-cream-card bg-emerald-500" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-forest" data-testid="chat-name">{personName(user)}</span>
            <RoleChip role={user.role} />
          </p>
          <p className="truncate text-[12px]" data-testid="chat-status">
            {typing.theirs ? (
              <span className="inline-flex items-center gap-1 font-semibold text-gold">
                {t("msg.chat.typing")}
                <TypingDots />
              </span>
            ) : user.online ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t("msg.chat.online")}</span>
            ) : (
              <span className="text-clay">
                {[user.detail, user.handle, user.lastLoginAt ? t("msg.chat.lastSeen", { when: relativeWhen(user.lastLoginAt) }) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </p>
        </div>
      </header>

      {/* messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="chat-wallpaper h-full overflow-y-auto px-3 py-4 sm:px-6"
          data-testid="chat-scroll"
        >
          {q.isFetchingNextPage && (
            <div className="mb-3 flex justify-center">
              <Loader2 size={16} className="animate-spin text-clay" />
            </div>
          )}
          {!q.hasNextPage && items.length > 0 && (
            <p className="mb-4 text-center text-[11px] text-clay/80">{t("msg.chat.beginning")}</p>
          )}
          {items.length === 0 && (
            <div className="grid h-full place-items-center">
              <div className="max-w-xs rounded-3xl border border-forest/10 bg-cream-card/90 px-6 py-7 text-center shadow-sm">
                <UserAvatar user={user} size={64} className="mx-auto" />
                <p className="mt-3 text-[14px] font-bold text-forest">{t("msg.chat.startWith", { name: personName(user) })}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-clay">{canWrite ? t("msg.chat.startHint") : t("msg.chat.cannotWrite")}</p>
              </div>
            </div>
          )}
          {items.map((m, i) => {
            const prev = items[i - 1];
            const next = items[i + 1];
            const newDay = !prev || !sameDayIso(prev.createdAt, m.createdAt);
            const joinsPrev =
              !!prev && !newDay && prev.mine === m.mine && !prev.broadcast && !m.broadcast &&
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP;
            const joinsNext =
              !!next && sameDayIso(next.createdAt, m.createdAt) && next.mine === m.mine && !next.broadcast && !m.broadcast &&
              new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() < GROUP_GAP;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="sticky top-1 z-10 my-3 flex justify-center">
                    <span className="rounded-full border border-forest/10 bg-cream-card/90 px-3 py-1 text-[11.5px] font-semibold text-forest shadow-sm backdrop-blur-sm">
                      {dayLabel(m.createdAt, t)}
                    </span>
                  </div>
                )}
                <Bubble
                  m={m}
                  tight={joinsPrev}
                  tail={!joinsNext}
                  editing={editing?.id === m.id}
                  onEdit={stillEditable(m, now) ? () => setEditing(m) : undefined}
                  onDelete={isAdmin && m.mine && !m.pending ? () => setToDelete(m) : undefined}
                  onRetry={() => {
                    discard(m.id);
                    send.mutate({ body: m.body, attachments: m.attachments, tempId: `tmp-${Date.now()}` });
                  }}
                  onDiscard={() => {
                    // Never sent: its files are drafts nobody will send now.
                    forgetDrafts(m.attachments);
                    discard(m.id);
                  }}
                />
              </div>
            );
          })}
          {typing.theirs && (
            <div className="mt-2 flex justify-start">
              <span className="inline-flex items-center gap-1 rounded-2xl rounded-es-md border border-forest/10 bg-cream-card px-4 py-3 shadow-sm">
                <TypingDots />
              </span>
            </div>
          )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={jump}
            aria-label={t("msg.chat.toLatest")}
            className="absolute end-4 bottom-4 grid size-11 place-items-center rounded-full border border-forest/15 bg-cream-card text-forest shadow-lg transition hover:bg-cream"
          >
            <ArrowDown size={18} />
            {unseen > 0 && (
              <span className="absolute -top-2 -end-1 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-[10.5px] font-bold text-forest-deep">
                {unseen}
              </span>
            )}
          </button>
        )}
      </div>

      {/* composer — or, while a sent message is being changed, its editor */}
      {editing ? (
        <EditComposer
          key={editing.id}
          m={editing}
          onCancel={() => setEditing(null)}
          onSave={(body) => {
            edit.mutate({ id: editing.id, body, before: editing.body });
            setEditing(null);
          }}
        />
      ) : canWrite ? (
        <Composer
          drafts={drafts}
          body={text}
          setBody={setText}
          onSend={(body, attachments) => {
            atBottom.current = true;
            send.mutate({ body, attachments, tempId: `tmp-${Date.now()}` });
          }}
          onTyping={typing.notify}
        />
      ) : (
        <p className="flex items-center justify-center gap-2 border-t border-forest/10 bg-cream-card px-4 py-4 text-center text-[12.5px] text-clay" data-testid="chat-locked">
          <Lock size={14} />
          {user.active ? t("msg.chat.cannotWrite") : t("msg.chat.inactive")}
        </p>
      )}

      <ConfirmDialog
        icon={Trash2}
        open={!!toDelete}
        tone="danger"
        title={t("msg.actions.confirmTitle")}
        message={t("msg.actions.confirmBody")}
        confirmLabel={t("msg.actions.confirm")}
        cancelLabel={t("admin.cancel")}
        loading={retract.isPending}
        onConfirm={() => toDelete && retract.mutate(toDelete.id, { onSettled: () => setToDelete(null) })}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function Bubble({
  m,
  tight,
  tail,
  editing,
  onEdit,
  onDelete,
  onRetry,
  onDiscard,
}: {
  m: ChatMessage;
  tight: boolean;
  tail: boolean;
  /** Being changed in the editor below. */
  editing: boolean;
  /** Present while the message may still be edited. */
  onEdit?: () => void;
  /** Present for an administrator's own message. */
  onDelete?: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const mine = m.mine;
  const shape = mine
    ? `bg-gold text-forest-deep ${tail ? "rounded-2xl rounded-ee-md" : "rounded-2xl"}`
    : `border border-forest/10 bg-cream-card text-forest ${tail ? "rounded-2xl rounded-es-md" : "rounded-2xl"}`;
  // The ink of the time and ticks: fixed on gold, which stays light in both themes.
  const metaInk = mine ? "text-[rgba(22,36,31,0.62)]" : "text-clay";

  return (
    <div
      className={`group flex items-center gap-1 ${mine ? "justify-end" : "justify-start"} ${tight ? "mt-0.5" : "mt-2.5"}`}
      data-testid="chat-bubble"
      data-mine={mine || undefined}
    >
      {(onEdit || onDelete) && <BubbleActions onEdit={onEdit} onDelete={onDelete} />}
      <div className={`max-w-[min(80%,36rem)] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`px-3.5 pt-2 pb-1.5 shadow-[0_1px_2px_rgba(22,36,31,0.12)] transition ${shape} ${m.pending === "failed" ? "opacity-80 ring-2 ring-red-500/60" : ""} ${
            editing ? "ring-2 ring-forest/40 ring-offset-2 ring-offset-cream" : ""
          }`}
        >
          {m.broadcast && (
            <p className={`mb-1 flex items-center gap-1 text-[11px] font-bold ${mine ? "text-[rgba(22,36,31,0.72)]" : "text-gold"}`}>
              <Megaphone size={12} />
              <span className="truncate">{broadcastLabel(m.broadcast, t)}</span>
            </p>
          )}
          {m.subject && <p className="mb-0.5 text-[13.5px] font-bold">{m.subject}</p>}
          {m.attachments && m.attachments.length > 0 && (
            <div className="mt-0.5 mb-1.5">
              <AttachmentList items={m.attachments} mine={mine} />
            </div>
          )}
          <p className="text-[14.5px] leading-6 break-words whitespace-pre-wrap" dir="auto">
            {m.body}
            {/* the meta sits at the end of the last line, as in a messenger */}
            <span
              className={`float-end ms-3 mt-1.5 inline-flex items-center gap-1 text-[10.5px] leading-none tabular-nums ${metaInk}`}
              title={m.editedAt ? `${fullWhen(m.createdAt)} · ${t("msg.edited")} ${fullWhen(m.editedAt)}` : fullWhen(m.createdAt)}
            >
              {m.editedAt && (
                <span className="italic" data-testid="edited">
                  {t("msg.edited")}
                </span>
              )}
              {clockTime(m.createdAt)}
              {mine &&
                (m.pending === "sending" ? (
                  <Clock size={12} aria-label={t("msg.sending")} />
                ) : m.pending === "failed" ? (
                  <AlertCircle size={12} className="text-red-700" aria-label={t("msg.failed")} />
                ) : m.readAt ? (
                  <CheckCheck size={14} className="text-sky-700" aria-label={t("msg.readAt", { when: relativeWhen(m.readAt) })} data-testid="tick-read" />
                ) : (
                  <Check size={14} aria-label={t("msg.delivered")} data-testid="tick-sent" />
                ))}
            </span>
          </p>
        </div>
        {m.pending === "failed" && (
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-red-600 dark:text-red-400">{t("msg.failed")}</span>
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-lg bg-forest px-2 py-0.5 font-semibold text-cream">
              <RotateCcw size={11} />
              {t("msg.retry")}
            </button>
            <button type="button" onClick={onDiscard} className="rounded-lg px-1.5 py-0.5 text-clay hover:bg-forest/10">
              {t("msg.discard")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The ⋯ beside my message: change it while it may still be, or withdraw it (administration). */
function BubbleActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEscapeToClose(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const item = "flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] font-semibold transition";
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("msg.actions.more")}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="message-actions"
        className={`grid size-8 place-items-center rounded-full text-clay transition hover:bg-forest/10 hover:text-forest focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-70 ${
          open ? "bg-forest/10 opacity-100" : "opacity-0"
        }`}
      >
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-scale-in absolute bottom-full z-20 mb-1 w-48 overflow-hidden rounded-xl border border-forest/10 bg-cream-card py-1 shadow-xl ltr:left-0 rtl:right-0"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              data-testid="message-edit"
              className={`${item} text-forest hover:bg-forest/5`}
            >
              <Pencil size={14} />
              {t("msg.actions.edit")}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              data-testid="message-delete"
              className={`${item} text-red-600 hover:bg-red-500/10 dark:text-red-400`}
            >
              <Trash2 size={14} />
              {t("msg.actions.deleteForEveryone")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Changing a sent message: the composer's place, with the old text in it.
 * Enter saves, Escape or ✕ leaves it as it was. Only the text — its files
 * stay as they were sent.
 */
function EditComposer({ m, onSave, onCancel }: { m: ChatMessage; onSave: (body: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [body, setBody] = useState(m.body);
  useEscapeToClose(onCancel);
  const next = body.trim();
  const canSave = next !== m.body.trim() && (next.length > 0 || (m.attachments?.length ?? 0) > 0);
  const save = () => canSave && onSave(next);
  return (
    <div className="border-t border-forest/10 bg-cream-card px-3 py-3 sm:px-4" data-testid="edit-composer">
      <div className="mb-2 flex items-center gap-2.5 rounded-xl border-s-4 border-gold bg-gold/10 py-2 ps-3 pe-2">
        <Pencil size={15} className="shrink-0 text-gold" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-forest">{t("msg.actions.editing")}</span>
          <span className="block truncate text-[12px] text-clay" dir="auto">
            {m.body || previewOf("", m.attachments, t)}
          </span>
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("admin.cancel")}
          data-testid="edit-cancel"
          className="grid size-8 shrink-0 place-items-center rounded-full text-clay transition hover:bg-forest/10 hover:text-forest"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex min-h-12 flex-1 items-center rounded-3xl border border-gold bg-cream px-4 py-1.5 ring-2 ring-gold/25">
          <textarea
            value={body}
            autoFocus
            onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                save();
              }
            }}
            rows={Math.min(6, Math.max(1, body.split("\n").length))}
            maxLength={5000}
            data-testid="edit-input"
            dir="auto"
            className="max-h-40 w-full resize-none bg-transparent py-1.5 text-[14.5px] leading-6 text-forest outline-none"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          aria-label={t("msg.actions.save")}
          data-testid="edit-save"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-gold text-forest-deep shadow-md transition hover:bg-gold-soft active:scale-90 disabled:opacity-40"
        >
          <Check size={20} />
        </button>
      </div>
      <p className="mt-1 px-2 text-[10.5px] text-clay/70">{t("msg.actions.editHint")}</p>
    </div>
  );
}

function Composer({
  drafts,
  body,
  setBody,
  onSend,
  onTyping,
}: {
  drafts: AttachmentDrafts;
  body: string;
  setBody: (v: string) => void;
  onSend: (body: string, attachments: MessageAttachment[]) => void;
  onTyping: (active: boolean) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  // A file still on its way, or one that failed, holds the message back:
  // sent without it, the reader would never know it was meant to be there.
  const canSend = (body.trim().length > 0 || drafts.ready > 0) && !drafts.uploading && !drafts.failed;

  function submit() {
    if (!canSend) return;
    onSend(body.trim(), drafts.take());
    onTyping(false);
    setBody("");
    ref.current?.focus();
  }

  return (
    <div className="border-t border-forest/10 bg-cream-card px-3 py-3 sm:px-4" data-testid="chat-composer">
      <DraftTray drafts={drafts.drafts} onRemove={drafts.remove} onRetry={drafts.retry} />
      <div className="flex items-end gap-2">
        <div className="flex min-h-12 flex-1 items-center gap-1 rounded-3xl border border-forest/15 bg-cream py-1.5 ps-1.5 pe-4 transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
          <AttachButton drafts={drafts} disabled={drafts.drafts.length >= MAX_FILES} className="size-9" />
          <textarea
            ref={ref}
            value={body}
            autoFocus
            onChange={(e) => {
              setBody(e.target.value);
              onTyping(e.target.value.trim().length > 0);
            }}
            onBlur={() => onTyping(false)}
            // A picture pasted from the clipboard is attached, as in any messenger.
            onPaste={(e) => {
              if (!e.clipboardData.files.length) return;
              e.preventDefault();
              drafts.add(e.clipboardData.files);
            }}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter starts a new line — as in any messenger.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={Math.min(6, Math.max(1, body.split("\n").length))}
            maxLength={5000}
            placeholder={t("msg.chat.placeholder")}
            data-testid="chat-input"
            dir="auto"
            className="max-h-40 w-full resize-none bg-transparent py-1.5 text-[14.5px] leading-6 text-forest outline-none placeholder:text-clay/70"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={t("messages.send")}
          data-testid="chat-send"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-gold text-forest-deep shadow-md transition hover:bg-gold-soft active:scale-90 disabled:opacity-40"
        >
          <SendHorizontal size={19} className="ltr:-scale-x-100 rtl:rotate-180" />
        </button>
      </div>
      <p className="mt-1 px-2 text-[10.5px] text-clay/70">{t("msg.chat.enterHint")}</p>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
