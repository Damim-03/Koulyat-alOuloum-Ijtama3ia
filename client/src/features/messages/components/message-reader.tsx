import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  Mail,
  MailX,
  MessagesSquare,
  Pencil,
  RotateCcw,
  SendHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "../../../components/ui/user-avatar";
import { ConfirmDialog } from "../../admin/components/form/confirm-dialog.form";
import { useAuthStore } from "../../../store/auth.store";
import { useNow } from "../../../hooks/use-now";
import { useEscapeToClose } from "../../../hooks/use-escape";
import {
  discardPending,
  useDeleteForEveryoneMessage,
  useDeleteInboxMessage,
  useEditMessage,
  useMarkMessageRead,
  useMarkMessageUnread,
  useReplyMessage,
  useThread,
} from "../hooks/messages-hook";
import type { MessageAttachment, ThreadMessage } from "../api/messages.api";
import { MAX_FILES, fullWhen, personName, relativeWhen, setOpenThread, stillEditable } from "../messages-utils";
import { forgetDrafts, useAttachmentDrafts } from "../hooks/use-attachments";
import { AttachButton, AttachmentList, DraftTray } from "./attachments";
import { BroadcastChip, EmptyPane, RoleChip } from "./messages-ui";

/**
 * One conversation: the first message and every reply the reader may see, in
 * order, with who read what — and a reply box that sends the instant it is
 * asked to. A reply from the other side appears here by itself.
 */
export function MessageReader({
  id,
  onBack,
  onGone,
}: {
  id: string;
  onBack: () => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useThread(id);
  const markRead = useMarkMessageRead();
  const markUnread = useMarkMessageUnread();
  const del = useDeleteInboxMessage();
  // The optimistic reply is drawn with my own face and name.
  const reply = useReplyMessage(
    id,
    me
      ? {
          id: me.id,
          firstName: me.firstName ?? null,
          lastName: me.lastName ?? null,
          firstNameLatin: me.firstNameLatin ?? null,
          lastNameLatin: me.lastNameLatin ?? null,
          avatarUrl: me.avatarUrl ?? null,
          gender: me.gender ?? null,
          role: String(me.role),
        }
      : undefined,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Changing what I sent, briefly; withdrawing it, for the administration.
  const isAdmin = String(me?.role) === "admin";
  const now = useNow(true, 30_000);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toRetract, setToRetract] = useState<ThreadMessage | null>(null);
  const edit = useEditMessage();
  const retract = useDeleteForEveryoneMessage();

  const thread = useMemo(() => data?.thread ?? [], [data]);
  const selected = data?.message;
  const rootId = data?.rootId ?? null;

  // The conversation is on screen: new messages in it need no toast.
  useEffect(() => {
    setOpenThread(rootId);
    return () => setOpenThread(null);
  }, [rootId]);

  // Opening reads it — and whatever else in the conversation was waiting.
  const unreadHere = thread.some((m) => !m.mine && !m.readAt && !m.pending);
  const readFor = useRef<string | null>(null);
  useEffect(() => {
    if (!unreadHere || !selected || selected.mine) return;
    const key = `${id}:${thread.length}`;
    if (readFor.current === key) return;
    readFor.current = key;
    markRead.mutate(selected.id);
  }, [unreadHere, selected, id, thread.length, markRead]);

  // Follow the conversation as it grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [thread.length]);

  if (isLoading)
    return (
      <div className="grid h-full place-items-center">
        <Loader2 size={24} className="animate-spin text-gold" />
      </div>
    );
  if (isError || !selected)
    return <EmptyPane icon={MailX} title={t("msg.gone")} hint={t("msg.goneHint")} />;

  const root = thread[0] ?? selected;
  const received = !selected.mine;
  const ownBroadcast = root.mine && !!root.broadcast;
  // Answer the latest message that is really stored.
  const target = [...thread].reverse().find((m) => !m.pending) ?? selected;
  const others = !target.mine && !target.broadcast ? (target.recipients?.length ?? 0) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="message-reader">
      {/* header */}
      <header className="border-b border-forest/10 bg-linear-to-l from-gold/[0.06] to-transparent px-5 py-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("msg.back")}
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/10 hover:text-forest lg:hidden"
          >
            <ArrowRight size={17} className="ltr:rotate-180" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg leading-snug font-bold break-words text-forest lg:text-xl" data-testid="reader-subject">
              {data?.subject || t("messages.noSubject")}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-clay">
              {root.broadcast && <BroadcastChip tag={root.broadcast} full />}
              {thread.length > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-forest/5 px-2 py-0.5 font-semibold">
                  <MessagesSquare size={12} />
                  {t("msg.inConversation", { n: thread.length })}
                </span>
              )}
              <span title={fullWhen(root.createdAt)}>{fullWhen(root.createdAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn
              icon={Copy}
              label={t("msg.copy")}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(thread.map((m) => `${personName(m.sender)}: ${m.body}`).join("\n\n"));
                  toast.success(t("msg.copied"));
                } catch {
                  /* nothing to copy into */
                }
              }}
            />
            {received && (
              <>
                <IconBtn icon={Mail} label={t("msg.markUnread")} onClick={() => markUnread.mutate(selected.id, { onSuccess: onBack })} testId="reader-unread" />
                <IconBtn icon={Trash2} label={t("messages.deleteFromInbox")} onClick={() => setConfirmDelete(true)} danger testId="reader-delete" />
              </>
            )}
          </div>
        </div>
      </header>

      {/* conversation */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-cream-2/30 px-4 py-5 lg:px-6" data-testid="thread">
        {thread.map((m) => (
          <Bubble
            key={m.id}
            m={m}
            highlighted={m.id === id && thread.length > 1}
            editing={editingId === m.id}
            saving={edit.isPending}
            onEdit={stillEditable(m, now) ? () => setEditingId(m.id) : undefined}
            onCancelEdit={() => setEditingId(null)}
            onSave={(body) => edit.mutate({ id: m.id, body }, { onSuccess: () => setEditingId(null) })}
            onDelete={isAdmin && m.mine && !m.pending ? () => setToRetract(m) : undefined}
            onRetry={() => {
              discardPending(qc, id, m.id);
              reply.mutate({ parentId: target.id, body: m.body, attachments: m.attachments, tempId: `tmp-${Date.now()}` });
            }}
            onDiscard={() => {
              forgetDrafts(m.attachments);
              discardPending(qc, id, m.id);
            }}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* reply */}
      <ReplyBox
        disabled={ownBroadcast}
        disabledHint={t("msg.cannotReplyOwnBroadcast")}
        others={others}
        toName={target.mine ? t("msg.replyToRecipients") : personName(target.sender)}
        onSend={(body, all, attachments) => reply.mutate({ parentId: target.id, body, all, attachments, tempId: `tmp-${Date.now()}` })}
      />

      <ConfirmDialog
        icon={Trash2}
        open={confirmDelete}
        tone="danger"
        title={t("messages.deleteMessage")}
        message={t("messages.deleteConfirm")}
        confirmLabel={t("messages.yesDelete")}
        cancelLabel={t("pro.cancel")}
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(selected.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onGone();
            },
            onSettled: () => setConfirmDelete(false),
          })
        }
        onClose={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        icon={Trash2}
        open={!!toRetract}
        tone="danger"
        title={t("msg.actions.confirmTitle")}
        message={toRetract?.broadcast ? t("msg.actions.confirmBroadcast") : t("msg.actions.confirmBody")}
        confirmLabel={t("msg.actions.confirm")}
        cancelLabel={t("admin.cancel")}
        loading={retract.isPending}
        onConfirm={() =>
          toRetract &&
          retract.mutate(toRetract.id, {
            // The message this view was opened on is gone: so is the view.
            onSuccess: () => (toRetract.id === selected.id || toRetract.id === rootId) && onGone(),
            onSettled: () => setToRetract(null),
          })
        }
        onClose={() => setToRetract(null)}
      />
    </div>
  );
}

function Bubble({
  m,
  highlighted,
  editing,
  saving,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onRetry,
  onDiscard,
}: {
  m: ThreadMessage;
  highlighted: boolean;
  editing: boolean;
  saving: boolean;
  /** Present while it may still be edited. */
  onEdit?: () => void;
  onCancelEdit: () => void;
  onSave: (body: string) => void;
  /** Present for an administrator's own message. */
  onDelete?: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const [showRecipients, setShowRecipients] = useState(false);
  const recips = m.recipients ?? [];
  const read = m.readCount ?? 0;
  const total = m.recipientsCount;

  return (
    <article
      className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
      data-testid="bubble"
      data-mine={m.mine || undefined}
    >
      <div
        className={`w-full max-w-[min(100%,46rem)] rounded-2xl border p-4 shadow-[0_6px_22px_-14px_rgba(38,66,61,0.35)] transition ${
          m.mine ? "border-forest/15 bg-forest/[0.06]" : "border-forest/10 bg-cream-card"
        } ${highlighted ? "ring-2 ring-gold/50" : ""} ${m.pending === "failed" ? "border-red-400/60" : ""}`}
      >
        <header className="mb-2.5 flex items-center gap-2.5">
          <UserAvatar user={m.sender} size={36} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-bold text-forest">
                {m.mine ? t("msg.you") : personName(m.sender)}
              </span>
              <RoleChip role={m.sender.role} />
            </p>
            <p className="text-[11px] text-clay" title={fullWhen(m.createdAt)}>
              {relativeWhen(m.createdAt)}
              {m.editedAt && (
                <span className="italic" title={fullWhen(m.editedAt)} data-testid="edited">
                  {" · "}
                  {t("msg.edited")}
                </span>
              )}
            </p>
          </div>
          {!editing && (onEdit || onDelete) && (
            <div className="flex shrink-0 items-center gap-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  data-testid="reader-edit"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-forest transition hover:bg-forest/8"
                >
                  <Pencil size={12} />
                  {t("msg.actions.edit")}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  data-testid="reader-delete-everyone"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                >
                  <Trash2 size={12} />
                  {t("msg.actions.deleteForEveryone")}
                </button>
              )}
            </div>
          )}
        </header>

        {editing ? (
          <InlineEditor m={m} saving={saving} onCancel={onCancelEdit} onSave={onSave} />
        ) : (
          m.body && (
            <p className="text-[14px] leading-7 break-words whitespace-pre-wrap text-forest" dir="auto">
              {m.body}
            </p>
          )
        )}
        {m.attachments && m.attachments.length > 0 && (
          <div className={`max-w-md ${m.body ? "mt-3" : ""}`}>
            <AttachmentList items={m.attachments} />
          </div>
        )}

        {/* footer: delivery and receipts */}
        {m.pending === "sending" ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-clay">
            <Clock size={12} className="animate-pulse" />
            {t("msg.sending")}
          </p>
        ) : m.pending === "failed" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
            <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle size={12} />
              {t("msg.failed")}
            </span>
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-lg bg-forest px-2.5 py-1 font-semibold text-cream">
              <RotateCcw size={12} />
              {t("msg.retry")}
            </button>
            <button type="button" onClick={onDiscard} className="rounded-lg px-2 py-1 text-clay hover:bg-forest/10">
              {t("msg.discard")}
            </button>
          </div>
        ) : m.mine ? (
          <div className="mt-3 border-t border-forest/10 pt-2.5">
            <button
              type="button"
              onClick={() => setShowRecipients((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-forest"
              aria-expanded={showRecipients}
              data-testid="receipts"
            >
              {read >= total && total > 0 ? (
                <CheckCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              ) : read > 0 ? (
                <CheckCheck size={14} className="text-clay" />
              ) : (
                <Check size={14} className="text-clay" />
              )}
              {total === 1
                ? read
                  ? t("msg.readAt", { when: relativeWhen(recips[0]?.readAt ?? m.createdAt) })
                  : t("msg.delivered")
                : t("msg.readOf", { read, total })}
              {total > 1 && <ChevronDown size={13} className={`transition-transform ${showRecipients ? "rotate-180" : ""}`} />}
            </button>
            {total > 1 && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-forest/10">
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${total ? (read / total) * 100 : 0}%` }} />
              </div>
            )}
            {showRecipients && (
              <ul className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2" data-testid="recipient-list">
                {recips.map((r) => (
                  <li key={r.user.id} className="flex items-center gap-2 rounded-lg bg-cream-card/80 px-2 py-1.5">
                    <UserAvatar user={r.user} size={24} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-forest">{personName(r.user)}</span>
                    {r.readAt ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[10.5px] text-emerald-700 dark:text-emerald-300" title={fullWhen(r.readAt)}>
                        <CheckCheck size={11} />
                        {relativeWhen(r.readAt)}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10.5px] text-clay">{t("msg.notYet")}</span>
                    )}
                  </li>
                ))}
                {total > recips.length && (
                  <li className="px-2 py-1 text-[11px] text-clay">{t("messages.othersCount", { count: total - recips.length })}</li>
                )}
              </ul>
            )}
          </div>
        ) : recips.length > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 border-t border-forest/10 pt-2.5 text-[11.5px] text-clay">
            <Users size={12} />
            {t("msg.alsoTo", { names: recips.slice(0, 3).map((r) => personName(r.user)).join("، ") })}
            {recips.length > 3 && ` ${t("messages.othersCount", { count: recips.length - 3 })}`}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** The text of a sent message, changed in place: Ctrl+Enter or ✓ saves, Escape or ✕ leaves it. */
function InlineEditor({
  m,
  saving,
  onCancel,
  onSave,
}: {
  m: ThreadMessage;
  saving: boolean;
  onCancel: () => void;
  onSave: (body: string) => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState(m.body);
  useEscapeToClose(onCancel);
  const next = body.trim();
  const canSave = !saving && next !== m.body.trim() && (next.length > 0 || (m.attachments?.length ?? 0) > 0);
  return (
    <div data-testid="inline-editor">
      <textarea
        value={body}
        autoFocus
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSave) {
            e.preventDefault();
            onSave(next);
          }
        }}
        rows={Math.min(10, Math.max(3, body.split("\n").length))}
        maxLength={5000}
        dir="auto"
        data-testid="inline-edit-input"
        className="w-full resize-y rounded-xl border border-gold bg-cream p-3 text-[14px] leading-7 text-forest outline-none ring-2 ring-gold/25"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-clay transition hover:bg-forest/8"
        >
          <X size={13} />
          {t("admin.cancel")}
        </button>
        <button
          type="button"
          onClick={() => onSave(next)}
          disabled={!canSave}
          data-testid="inline-edit-save"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-1.5 text-[12.5px] font-bold text-forest-deep transition hover:bg-gold-soft disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {t("msg.actions.save")}
        </button>
      </div>
    </div>
  );
}

function ReplyBox({
  disabled,
  disabledHint,
  others,
  toName,
  onSend,
}: {
  disabled: boolean;
  disabledHint: string;
  others: number;
  toName: string;
  onSend: (body: string, all: boolean, attachments: MessageAttachment[]) => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [all, setAll] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const drafts = useAttachmentDrafts();
  const canSend = (body.trim().length > 0 || drafts.ready > 0) && !drafts.uploading && !drafts.failed;

  function send() {
    if (!canSend) return;
    onSend(body.trim(), all && others > 0, drafts.take());
    setBody("");
    ref.current?.focus();
  }

  if (disabled)
    return (
      <p className="border-t border-forest/10 bg-cream-card px-5 py-3 text-center text-[12px] text-clay">{disabledHint}</p>
    );

  return (
    <div className="border-t border-forest/10 bg-cream-card px-4 py-3 lg:px-5" data-testid="reply-box">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-clay">
        <span>
          {t("msg.replyingTo")} <span className="font-semibold text-forest">{toName}</span>
          {all && others > 0 && ` ${t("messages.othersCount", { count: others })}`}
        </span>
        {others > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="size-3.5 accent-gold" />
            {t("msg.replyAll")}
          </label>
        )}
      </div>
      <DraftTray drafts={drafts.drafts} onRemove={drafts.remove} onRetry={drafts.retry} />
      <div className="flex items-end gap-2 rounded-2xl border border-forest/15 bg-cream p-2 transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
        <AttachButton drafts={drafts} disabled={drafts.drafts.length >= MAX_FILES} className="size-11" />
        <textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={(e) => {
            if (!e.clipboardData.files.length) return;
            e.preventDefault();
            drafts.add(e.clipboardData.files);
          }}
          rows={Math.min(6, Math.max(2, body.split("\n").length))}
          maxLength={5000}
          placeholder={t("msg.replyPlaceholder")}
          data-testid="reply-input"
          className="max-h-48 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-6 text-forest outline-none placeholder:text-clay/70"
          dir="auto"
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label={t("messages.send")}
          data-testid="reply-send"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold text-forest-deep shadow-sm transition hover:bg-gold-soft active:scale-95 disabled:opacity-40"
        >
          <SendHorizontal size={18} className="ltr:-scale-x-100 rtl:rotate-180" />
        </button>
      </div>
      <p className="mt-1.5 flex justify-between text-[10.5px] text-clay/80">
        <span>{t("msg.sendShortcut")}</span>
        <span dir="ltr" className="tabular-nums">
          {body.length}/5000
        </span>
      </p>
    </div>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  danger,
  testId,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={`grid size-9 place-items-center rounded-xl text-clay transition ${
        danger ? "hover:bg-red-500/10 hover:text-red-500" : "hover:bg-forest/10 hover:text-forest"
      }`}
    >
      <Icon size={16} />
    </button>
  );
}
