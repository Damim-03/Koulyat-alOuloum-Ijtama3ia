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
  PanelLeftOpen,
  RotateCcw,
  SendHorizontal,
} from "lucide-react";

import { UserAvatar } from "../../../components/ui/user-avatar";
import { useChat, useDiscardFailed, useMarkChatRead, useSendChat, useTyping } from "../hooks/chat-hooks";
import type { ChatMessage } from "../api/messages.api";
import { broadcastLabel, clockTime, dayLabel, fullWhen, personName, relativeWhen, sameDayIso, setOpenChat } from "../messages-utils";
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

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="chat-view">
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
                  onRetry={() => {
                    discard(m.id);
                    send.mutate({ body: m.body, tempId: `tmp-${Date.now()}` });
                  }}
                  onDiscard={() => discard(m.id)}
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

      {/* composer */}
      {canWrite ? (
        <Composer
          onSend={(body) => {
            atBottom.current = true;
            send.mutate({ body, tempId: `tmp-${Date.now()}` });
          }}
          onTyping={typing.notify}
        />
      ) : (
        <p className="flex items-center justify-center gap-2 border-t border-forest/10 bg-cream-card px-4 py-4 text-center text-[12.5px] text-clay" data-testid="chat-locked">
          <Lock size={14} />
          {user.active ? t("msg.chat.cannotWrite") : t("msg.chat.inactive")}
        </p>
      )}
    </div>
  );
}

function Bubble({
  m,
  tight,
  tail,
  onRetry,
  onDiscard,
}: {
  m: ChatMessage;
  tight: boolean;
  tail: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const mine = m.mine;
  const shape = mine
    ? `bg-gold text-forest-deep ${tail ? "rounded-2xl rounded-ee-md" : "rounded-2xl"}`
    : `border border-forest/10 bg-cream-card text-forest ${tail ? "rounded-2xl rounded-es-md" : "rounded-2xl"}`;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${tight ? "mt-0.5" : "mt-2.5"}`} data-testid="chat-bubble" data-mine={mine || undefined}>
      <div className={`max-w-[min(80%,36rem)] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-3.5 pt-2 pb-1.5 shadow-[0_1px_2px_rgba(22,36,31,0.12)] ${shape} ${m.pending === "failed" ? "opacity-80 ring-2 ring-red-500/60" : ""}`}>
          {m.broadcast && (
            <p className={`mb-1 flex items-center gap-1 text-[11px] font-bold ${mine ? "text-[rgba(22,36,31,0.72)]" : "text-gold"}`}>
              <Megaphone size={12} />
              <span className="truncate">{broadcastLabel(m.broadcast, t)}</span>
            </p>
          )}
          {m.subject && <p className="mb-0.5 text-[13.5px] font-bold">{m.subject}</p>}
          <p className="text-[14.5px] leading-6 break-words whitespace-pre-wrap" dir="auto">
            {m.body}
            {/* the meta sits at the end of the last line, as in a messenger */}
            <span
              className={`float-end ms-3 mt-1.5 inline-flex items-center gap-1 text-[10.5px] leading-none tabular-nums ${
                // Gold stays light in both themes, so its ink is fixed too.
                mine ? "text-[rgba(22,36,31,0.62)]" : "text-clay"
              }`}
              title={fullWhen(m.createdAt)}
            >
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

function Composer({ onSend, onTyping }: { onSend: (body: string) => void; onTyping: (active: boolean) => void }) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = body.trim();
    if (!text) return;
    onSend(text);
    onTyping(false);
    setBody("");
    ref.current?.focus();
  }

  return (
    <div className="border-t border-forest/10 bg-cream-card px-3 py-3 sm:px-4" data-testid="chat-composer">
      <div className="flex items-end gap-2">
        <div className="flex min-h-12 flex-1 items-center rounded-3xl border border-forest/15 bg-cream px-4 py-1.5 transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
          <textarea
            ref={ref}
            value={body}
            autoFocus
            onChange={(e) => {
              setBody(e.target.value);
              onTyping(e.target.value.trim().length > 0);
            }}
            onBlur={() => onTyping(false)}
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
          disabled={!body.trim()}
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
