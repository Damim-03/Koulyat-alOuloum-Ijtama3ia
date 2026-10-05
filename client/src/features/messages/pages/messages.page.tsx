import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Megaphone, MessagesSquare, PenLine } from "lucide-react";

import { useAuthStore } from "../../../store/auth.store";
import { useMessagesSummary, useThread } from "../hooks/messages-hook";
import { ChatSidebar } from "../components/chat-sidebar";
import { ChatView } from "../components/chat-view";
import { MessageReader } from "../components/message-reader";
import { ComposeDialog, type ComposeMode } from "../components/compose-dialog";
import { EmptyPane, LiveBadge } from "../components/messages-ui";

const SIDEBAR_KEY = "messages.sidebar";

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/**
 * Messages — one page for every role, drawn as a messenger: chats on the side,
 * one person's conversation in front. The administration also keeps its
 * broadcasts here, each with who read it.
 *
 * The open chat lives in the address (`?c=<person>`; `?b=<broadcast>` for a
 * broadcast), so a toast opens it directly and a conversation can be linked.
 * Older links to a single message (`?m=`) are resolved to their chat.
 */
export function MessagesPage() {
  const { t } = useTranslation();
  const role = String(useAuthStore((s) => s.user?.role) ?? "student");
  const isAdmin = role === "admin";
  const [sp, setSp] = useSearchParams();
  const chatId = sp.get("c");
  const broadcastId = sp.get("b");
  const legacyId = sp.get("m");
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { data: summary } = useMessagesSummary();

  function open(next: { c?: string | null; b?: string | null }) {
    const p = new URLSearchParams();
    if (next.c) p.set("c", next.c);
    if (next.b) p.set("b", next.b);
    setSp(p);
  }

  function toggle() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, v ? "open" : "collapsed");
      } catch {
        /* the choice just won't be remembered */
      }
      return !v;
    });
  }

  // `?m=<message>` → the chat (or broadcast) it belongs to.
  const legacy = useThread(legacyId);
  useEffect(() => {
    const m = legacy.data?.message;
    if (!legacyId || !m) return;
    const p = new URLSearchParams();
    if (!m.mine) p.set("c", m.sender.id);
    else if (m.broadcast) p.set("b", m.id);
    else if (m.recipients?.[0]) p.set("c", m.recipients[0].user.id);
    setSp(p, { replace: true });
  }, [legacyId, legacy.data, setSp]);

  const hasPane = !!(chatId || broadcastId);

  return (
    <div className="font-body">
      {/* ── header ───────────────────────────────────────── */}
      <section className="forest-glow relative mb-4 overflow-hidden rounded-3xl px-5 py-4 text-cream shadow-[0_14px_40px_-20px_rgba(22,36,31,0.6)] lg:px-6">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-cream/10 text-gold-soft">
            <Mail size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-3 font-serif text-xl font-bold text-cream lg:text-2xl">
              {t("messages.title")}
              <LiveBadge />
            </h1>
            <p className="mt-0.5 truncate text-[12.5px] text-cream/70">{t(`msg.subtitle.${isAdmin ? "admin" : role}`)}</p>
          </div>
          <div className="flex items-center gap-2">
            {(summary?.unread ?? 0) > 0 && (
              <span className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1.5 text-[12px] font-bold text-gold-soft tabular-nums">
                {t("msg.chat.unreadCount", { count: summary!.unread })}
              </span>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setCompose("audience")}
                data-testid="open-broadcast"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-cream/10 px-3.5 py-2 text-[13px] font-semibold text-cream transition hover:bg-cream/20"
              >
                <Megaphone size={15} />
                {t("msg.broadcastNew")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCompose("direct")}
              data-testid="open-compose"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-3.5 py-2 text-[13px] font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
            >
              <PenLine size={15} />
              {t("messages.newMessage")}
            </button>
          </div>
        </div>
      </section>

      {/* ── messenger ────────────────────────────────────── */}
      {/* The list's width is what animates; the chat takes whatever is left. */}
      <div className="flex h-[calc(100svh-12.5rem)] min-h-[520px] flex-col gap-4 lg:flex-row">
        <aside
          className={`chat-fold min-h-0 flex-1 overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)] lg:flex-none ${
            collapsed ? "lg:w-[88px]" : "lg:w-[360px]"
          } ${hasPane ? "hidden lg:block" : ""}`}
          data-testid="chat-aside"
        >
          <ChatSidebar
            activeUserId={chatId}
            activeBroadcastId={broadcastId}
            onOpenChat={(id) => open({ c: id })}
            onOpenBroadcast={(id) => open({ b: id })}
            collapsed={collapsed}
            onToggle={toggle}
            isAdmin={isAdmin}
            onCompose={setCompose}
          />
        </aside>

        <section
          className={`min-h-0 min-w-0 flex-1 overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)] ${
            hasPane ? "" : "hidden lg:block"
          }`}
        >
          {chatId ? (
            <ChatView
              key={chatId}
              userId={chatId}
              onBack={() => open({})}
              sidebarCollapsed={collapsed}
              onExpandSidebar={toggle}
            />
          ) : broadcastId ? (
            <MessageReader key={broadcastId} id={broadcastId} onBack={() => open({})} onGone={() => open({})} />
          ) : (
            <EmptyPane
              icon={MessagesSquare}
              title={t("msg.chat.pickOne")}
              hint={t("msg.chat.pickOneHint")}
              action={
                <button
                  type="button"
                  onClick={() => setCompose("direct")}
                  className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream transition hover:bg-forest-deep"
                >
                  <PenLine size={15} />
                  {t("messages.newMessage")}
                </button>
              }
            />
          )}
        </section>
      </div>

      <ComposeDialog
        open={compose !== null}
        onClose={() => setCompose(null)}
        canBroadcast={isAdmin}
        initialMode={compose ?? "direct"}
        onSent={(r) => {
          setCompose(null);
          if (r.kind === "broadcast") open({ b: r.id });
          else open({ c: r.recipientIds[0] });
        }}
      />
    </div>
  );
}
