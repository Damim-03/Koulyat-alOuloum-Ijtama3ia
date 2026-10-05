import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Check,
  CheckCheck,
  GraduationCap,
  Hash,
  Loader2,
  Megaphone,
  MessageCirclePlus,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { UserAvatar } from "../../../components/ui/user-avatar";
import { useConversations, useTypingPeople } from "../hooks/chat-hooks";
import { useContacts, useSentMessages } from "../hooks/messages-hook";
import type { Conversation } from "../api/messages.api";
import { broadcastLabel, personName, shortWhen } from "../messages-utils";
import { RelationChip, RoleChip } from "./messages-ui";
import { ErrorRetry } from "../../../components/ui/error-retry";

type Tab = "chats" | "broadcasts";
type Filter = "all" | "unread" | "professor" | "student" | "admin";

/** Digits only, long enough to be a registration number. */
const looksLikeReg = (s: string) => /^\d{6,}$/.test(s.replace(/\s/g, ""));

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

/** Each role keeps one colour everywhere in messages. */
const ROLE_LOOK: Record<string, { ring: string; text: string; icon: LucideIcon }> = {
  admin: { ring: "bg-violet-400/45", text: "text-violet-600 dark:text-violet-300", icon: ShieldCheck },
  professor: { ring: "bg-sky-400/45", text: "text-sky-600 dark:text-sky-300", icon: UserRound },
  student: { ring: "bg-emerald-400/45", text: "text-emerald-600 dark:text-emerald-300", icon: GraduationCap },
};

type Bucket = "today" | "yesterday" | "week" | "older";

function bucketOf(iso: string): Bucket {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = (start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000;
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "week";
  return "older";
}

/**
 * The list of chats, as a messenger keeps it: most recent first and grouped by
 * when, unread counted, the last line with its ticks — or "typing…" while the
 * other person is writing — and a green dot for whoever is online.
 *
 * The search box finds people as well as chats — by name, or by typing a
 * student's registration number — so a new conversation starts from the same
 * field. Folded, the list becomes a rail of faces.
 */
export function ChatSidebar({
  activeUserId,
  activeBroadcastId,
  onOpenChat,
  onOpenBroadcast,
  collapsed,
  onToggle,
  isAdmin,
  onCompose,
}: {
  activeUserId: string | null;
  activeBroadcastId: string | null;
  onOpenChat: (userId: string) => void;
  onOpenBroadcast: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  onCompose: (mode: "direct" | "audience") => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>(activeBroadcastId ? "broadcasts" : "chats");
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(id);
  }, [term]);

  const { data, isLoading, isError, refetch } = useConversations();
  const chats = useMemo(() => data?.items ?? [], [data]);
  const typing = useTypingPeople();
  const people = useContacts(debounced, !!debounced && tab === "chats");
  const broadcasts = useSentMessages({ filter: "broadcast", limit: 40 }, isAdmin && tab === "broadcasts");

  const q = norm(debounced);
  const matched = useMemo(
    () =>
      q
        ? chats.filter((c) =>
            [personName(c.user), c.user.handle ?? "", c.user.detail ?? "", c.user.email ?? ""].some((v) =>
              norm(v).includes(q),
            ),
          )
        : chats,
    [chats, q],
  );

  // How many chats each chip would show, from the chats the search left.
  const counts = useMemo(
    () => ({
      all: matched.length,
      unread: matched.filter((c) => c.unread > 0).length,
      professor: matched.filter((c) => c.user.role === "professor").length,
      student: matched.filter((c) => c.user.role === "student").length,
      admin: matched.filter((c) => c.user.role === "admin").length,
    }),
    [matched],
  );
  const shownChats = useMemo(
    () =>
      matched.filter((c) =>
        filter === "all" ? true : filter === "unread" ? c.unread > 0 : c.user.role === filter,
      ),
    [matched, filter],
  );

  // Grouped by when, as long as nothing narrows the list to a search.
  const buckets = useMemo(() => {
    if (q) return [{ key: null as Bucket | null, items: shownChats }];
    const order: Bucket[] = ["today", "yesterday", "week", "older"];
    return order
      .map((key) => ({ key, items: shownChats.filter((c) => c.last && bucketOf(c.last.createdAt) === key) }))
      .filter((b) => b.items.length > 0);
  }, [shownChats, q]);

  const newPeople = (people.data?.items ?? []).filter((p) => !chats.some((c) => c.user.id === p.id));
  const unreadTotal = data?.unread ?? 0;

  function openFirst() {
    const first = shownChats[0]?.user.id ?? newPeople[0]?.id;
    if (first) {
      onOpenChat(first);
      setTerm("");
    }
  }

  // Folding is a desktop layout; on a phone the list is always whole.
  const desktop = useIsDesktop();
  const folded = collapsed && desktop;

  return (
    <div className="relative h-full overflow-hidden" data-testid="chat-sidebar-shell" data-folded={folded || undefined}>
      {/* ── the whole list: fixed width, so the fold clips it rather than squeezing it ── */}
      <div
        inert={folded}
        aria-hidden={folded || undefined}
        className={`absolute inset-y-0 start-0 flex w-full flex-col transition-[opacity,transform] ease-out lg:w-[360px] ${
          folded
            ? "pointer-events-none opacity-0 duration-200 ltr:-translate-x-4 rtl:translate-x-4"
            : "translate-x-0 opacity-100 delay-150 duration-300"
        }`}
        data-testid="chat-sidebar"
      >
      {/* head */}
      <div className="relative space-y-3 border-b border-forest/10 bg-linear-to-b from-gold/[0.08] via-gold/[0.03] to-transparent px-3.5 pt-4 pb-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/15 text-gold shadow-[0_4px_14px_-6px_rgba(193,150,90,0.6)]">
            <MessagesSquare size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[17px] leading-tight font-bold text-forest">{t("msg.chat.title")}</h2>
            <p className="truncate text-[11.5px] text-clay" data-testid="sidebar-summary">
              {t("msg.chat.summary", { count: chats.length })}
              {unreadTotal > 0 && (
                <>
                  {" · "}
                  <span className="font-bold text-gold">{t("msg.chat.unreadCount", { count: unreadTotal })}</span>
                </>
              )}
            </p>
          </div>
          <IconBtn icon={MessageCirclePlus} label={t("messages.newMessage")} onClick={() => onCompose("direct")} testId="sidebar-compose" primary />
          <IconBtn icon={PanelLeftClose} label={t("msg.chat.collapse")} onClick={onToggle} testId="sidebar-collapse" />
        </div>

        <div className="relative">
          {looksLikeReg(term) ? (
            <Hash size={16} className="absolute top-1/2 start-3.5 -translate-y-1/2 text-gold" />
          ) : (
            <Search size={16} className="absolute top-1/2 start-3.5 -translate-y-1/2 text-clay" />
          )}
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                openFirst();
              } else if (e.key === "Escape") setTerm("");
            }}
            placeholder={t("msg.chat.searchPlaceholder")}
            data-testid="chat-search"
            className="h-11 w-full rounded-2xl border border-forest/12 bg-cream/80 ps-10 pe-9 text-[13.5px] text-forest shadow-[inset_0_1px_2px_rgba(22,36,31,0.06)] outline-none transition placeholder:text-clay/70 focus:border-gold/70 focus:bg-cream focus:ring-4 focus:ring-gold/15"
          />
          {term && (
            <button type="button" onClick={() => setTerm("")} aria-label={t("msg.clearSearch")} className="absolute top-1/2 end-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-clay hover:bg-forest/10">
              <X size={14} />
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-forest/8 bg-forest/[0.04] p-1" role="tablist">
            {(["chats", "broadcasts"] as Tab[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                onClick={() => setTab(v)}
                data-testid={`sidebar-tab-${v}`}
                className={`relative inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition ${
                  tab === v ? "bg-cream-card text-forest shadow-sm ring-1 ring-gold/30" : "text-clay hover:text-forest"
                }`}
              >
                {v === "chats" ? <MessagesSquare size={14} className={tab === v ? "text-gold" : ""} /> : <Megaphone size={14} className={tab === v ? "text-gold" : ""} />}
                {t(`msg.chat.tab.${v}`)}
                {v === "chats" && unreadTotal > 0 && tab !== v && <span className="size-1.5 rounded-full bg-gold" />}
              </button>
            ))}
          </div>
        )}

        {tab === "chats" && chats.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="chat-filters">
            {(["all", "unread", "professor", "student", "admin"] as Filter[])
              .filter((f) => f === "all" || counts[f] > 0 || filter === f)
              .map((f) => {
                const on = filter === f;
                const Icon = f === "unread" ? null : f === "all" ? null : ROLE_LOOK[f].icon;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={on}
                    data-testid={`chat-filter-${f}`}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                      on
                        ? "border-gold/60 bg-gold/15 text-forest shadow-[0_2px_10px_-4px_rgba(193,150,90,0.6)]"
                        : "border-forest/10 bg-cream/60 text-clay hover:border-forest/20 hover:text-forest"
                    }`}
                  >
                    {f === "unread" && <span className="size-1.5 rounded-full bg-gold" />}
                    {Icon && <Icon size={12} className={ROLE_LOOK[f].text} />}
                    {t(`msg.chat.filter.${f}`)}
                    <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${on ? "bg-gold/25" : "bg-forest/8"}`}>
                      {counts[f]}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* list */}
      <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-3" data-testid="chat-list">
        {tab === "broadcasts" ? (
          <BroadcastRows
            items={broadcasts.data?.items ?? []}
            loading={broadcasts.isLoading}
            activeId={activeBroadcastId}
            onOpen={onOpenBroadcast}
            onNew={() => onCompose("audience")}
          />
        ) : isError ? (
          <div className="px-3 pt-1">
            <ErrorRetry compact title={t("msg.listFailed")} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 px-3 pt-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="size-12 animate-pulse rounded-full bg-forest/10" />
                <span className="flex-1 space-y-1.5">
                  <span className="block h-3 w-2/3 animate-pulse rounded bg-forest/10" />
                  <span className="block h-2.5 w-1/2 animate-pulse rounded bg-forest/5" />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {buckets.map((b) => (
              <section key={b.key ?? "search"}>
                {b.key && (
                  <p className="flex items-center gap-2 px-4 pt-3 pb-1.5 text-[10.5px] font-bold tracking-wider text-clay/80 uppercase">
                    {t(`msg.chat.when.${b.key}`)}
                    <span className="h-px flex-1 bg-linear-to-l from-transparent to-forest/10" />
                  </p>
                )}
                <div className="space-y-0.5">
                  {b.items.map((c) => (
                    <ChatRow
                      key={c.user.id}
                      c={c}
                      active={activeUserId === c.user.id}
                      typing={typing.has(c.user.id)}
                      onOpen={() => onOpenChat(c.user.id)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {!debounced && chats.length > 0 && shownChats.length === 0 && (
              <p className="px-5 py-8 text-center text-[12px] text-clay">{t("msg.chat.filterEmpty")}</p>
            )}

            {!!debounced && (
              <div className="mt-3 px-3">
                <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold tracking-wide text-gold">
                  <UserPlus size={12} />
                  {looksLikeReg(debounced) ? t("msg.chat.byReg") : t("msg.chat.people")}
                  {people.isFetching && <Loader2 size={12} className="animate-spin text-clay" />}
                </p>
                {newPeople.length === 0 && !people.isFetching ? (
                  <p className="rounded-2xl border border-dashed border-forest/15 px-3 py-4 text-center text-[12px] text-clay" data-testid="people-empty">
                    {looksLikeReg(debounced) ? t("msg.chat.noReg") : t("messages.noMatches")}
                  </p>
                ) : (
                  newPeople.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onOpenChat(p.id);
                        setTerm("");
                      }}
                      data-testid="person-result"
                      className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 text-start transition hover:border-gold/30 hover:bg-gold/[0.07]"
                    >
                      <span className={`rounded-full p-[2px] ${ROLE_LOOK[p.role]?.ring ?? "bg-forest/15"}`}>
                        <span className="block rounded-full bg-cream-card p-[2px]">
                          <UserAvatar user={p} size={40} />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold text-forest">{personName(p)}</span>
                          <RelationChip relation={p.relation} />
                        </span>
                        <span className="block truncate text-[11.5px] text-clay" dir="auto">
                          {[p.handle, p.detail].filter(Boolean).join(" · ") || <RoleChip role={p.role} />}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-xl bg-forest px-3 py-1.5 text-[11px] font-semibold text-cream transition group-hover:bg-forest-deep">
                        {t("msg.chat.start")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {!debounced && chats.length === 0 && (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto mb-3 grid size-16 place-items-center rounded-3xl border border-gold/30 bg-linear-to-br from-gold/20 to-gold/5 text-gold shadow-[0_8px_24px_-12px_rgba(193,150,90,0.7)]">
                  <MessagesSquare size={26} />
                </span>
                <p className="text-[14.5px] font-bold text-forest">{t("msg.chat.emptyTitle")}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-clay">{t("msg.chat.emptyHint")}</p>
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* ── folded: a rail of faces ── */}
      {desktop && (
        <div
          inert={!folded}
          aria-hidden={!folded || undefined}
          className={`absolute inset-y-0 start-0 w-[88px] transition-opacity ease-out ${
            folded ? "opacity-100 delay-200 duration-300" : "pointer-events-none opacity-0 duration-150"
          }`}
        >
          {/* remounted on each fold, so the faces arrive one after another */}
          <Rail
            key={folded ? "on" : "off"}
            chats={chats}
            typing={typing}
            unreadTotal={unreadTotal}
            activeUserId={activeUserId}
            isAdmin={isAdmin}
            onOpenChat={onOpenChat}
            onCompose={onCompose}
            onToggle={onToggle}
          />
        </div>
      )}
    </div>
  );
}

const DESKTOP = "(min-width: 1024px)";

/** Whether the desktop layout (and so the fold) is in effect. */
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

type Hover = { c: Conversation; top: number; x: number; rtl: boolean } | null;

/**
 * The folded list: the same chats as faces. Hovering one shows a card with
 * the name, the role and the last line — or "typing…" — beside the rail, so
 * the chat can be found without unfolding.
 */
function Rail({
  chats,
  typing,
  unreadTotal,
  activeUserId,
  isAdmin,
  onOpenChat,
  onCompose,
  onToggle,
}: {
  chats: Conversation[];
  typing: ReadonlySet<string>;
  unreadTotal: number;
  activeUserId: string | null;
  isAdmin: boolean;
  onOpenChat: (userId: string) => void;
  onCompose: (mode: "direct" | "audience") => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<Hover>(null);
  const online = chats.filter((c) => c.user.online).length;

  function show(e: { currentTarget: HTMLElement }, c: Conversation) {
    const r = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    setHover({ c, top: r.top + r.height / 2, x: rtl ? r.left - 14 : r.right + 14, rtl });
  }

  return (
    <div className="relative flex h-full flex-col items-center py-3.5" data-testid="chat-rail">
      {/* the rail's own light: warm at the top, fading down */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-gold/[0.13] via-gold/[0.03] to-transparent" />
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative flex flex-col items-center gap-2.5">
        <span className="relative">
          <RailButton icon={PanelLeftOpen} label={t("msg.chat.expand")} onClick={onToggle} testId="sidebar-expand" />
          {unreadTotal > 0 && (
            <span className="absolute -top-1.5 -end-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-linear-to-br from-gold to-gold-soft px-1 text-[10px] font-extrabold text-forest-deep shadow-[0_2px_10px_rgba(193,150,90,0.65)] tabular-nums">
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
          )}
        </span>
        <RailButton icon={MessageCirclePlus} label={t("messages.newMessage")} onClick={() => onCompose("direct")} gold />
        {isAdmin && <RailButton icon={Megaphone} label={t("msg.broadcastNew")} onClick={() => onCompose("audience")} />}
      </div>

      <span className="relative my-3 h-px w-10 bg-linear-to-r from-transparent via-gold/50 to-transparent" />

      <div className="rail-fade relative min-h-0 w-full flex-1 overflow-y-auto [scrollbar-width:none]" onScroll={() => setHover(null)}>
        <div className="flex flex-col items-center gap-3 py-2">
          {chats.map((c, i) => {
            const active = activeUserId === c.user.id;
            return (
              <div key={c.user.id} className="rail-in relative flex w-full justify-center" style={{ animationDelay: `${180 + i * 45}ms` }}>
                {/* the open chat is marked at the rail's edge, as in the main menu */}
                <span
                  className={`absolute top-1/2 start-0 w-1 -translate-y-1/2 rounded-e-full bg-gold shadow-[0_0_12px_rgba(193,150,90,0.8)] transition-all duration-300 ${
                    active ? "h-9 opacity-100" : "h-0 opacity-0"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onOpenChat(c.user.id)}
                  onMouseEnter={(e) => show(e, c)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={(e) => show(e, c)}
                  onBlur={() => setHover(null)}
                  aria-label={personName(c.user)}
                  data-testid="rail-avatar"
                  className={`relative rounded-full transition duration-300 ease-out hover:scale-110 focus-visible:outline-none ${
                    active ? "scale-105" : ""
                  }`}
                >
                  <RingedAvatar c={c} size={46} active={active} />
                  {typing.has(c.user.id) ? (
                    <span className="absolute -bottom-1 start-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-gold/40 bg-cream-card px-1.5 py-1 shadow-md rtl:translate-x-1/2">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="size-1 animate-bounce rounded-full bg-gold" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  ) : (
                    c.unread > 0 && (
                      <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-linear-to-br from-gold to-gold-soft px-1 text-[10px] font-extrabold text-forest-deep shadow-[0_2px_10px_rgba(193,150,90,0.65)] tabular-nums">
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    )
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {online > 0 && (
        <span
          className="relative mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 tabular-nums dark:text-emerald-300"
          title={t("msg.chat.onlineNow", { count: online })}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          {online}
        </span>
      )}

      {hover &&
        createPortal(
          <div
            className="animate-scale-in pointer-events-none fixed z-[90] w-64 -translate-y-1/2"
            style={{ top: hover.top, [hover.rtl ? "right" : "left"]: hover.rtl ? window.innerWidth - hover.x : hover.x }}
            role="tooltip"
            data-testid="rail-card"
          >
            <div className="relative rounded-2xl border border-gold/30 bg-cream-card p-3 font-body shadow-[0_18px_40px_-14px_rgba(22,36,31,0.6)]">
              <span
                className={`absolute top-1/2 size-3 -translate-y-1/2 rotate-45 border-gold/30 bg-cream-card ${
                  hover.rtl ? "-right-1.5 border-t border-r" : "-left-1.5 border-b border-l"
                }`}
              />
              <p className="flex items-center gap-1.5">
                <span className="truncate text-[13.5px] font-bold text-forest">{personName(hover.c.user)}</span>
                {ROLE_LOOK[hover.c.user.role] && (
                  <span className={`shrink-0 text-[10.5px] font-semibold ${ROLE_LOOK[hover.c.user.role].text}`}>
                    {t(`roles.${hover.c.user.role}`)}
                  </span>
                )}
                {hover.c.last && <span className="ms-auto shrink-0 text-[10.5px] text-clay">{shortWhen(hover.c.last.createdAt)}</span>}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-clay" dir="auto">
                {typing.has(hover.c.user.id) ? (
                  <span className="font-semibold text-gold">{t("msg.chat.typing")}…</span>
                ) : (
                  <>
                    {hover.c.last?.mine && <span className="font-medium text-gold/90">{t("msg.chat.youPrefix")} </span>}
                    {hover.c.last?.preview ?? ""}
                  </>
                )}
              </p>
              <p className="mt-2 flex items-center gap-2 text-[10.5px]">
                {hover.c.user.online ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {t("msg.chat.online")}
                  </span>
                ) : (
                  <span className="text-clay/80">{hover.c.user.detail ?? ""}</span>
                )}
                {hover.c.unread > 0 && (
                  <span className="ms-auto rounded-full bg-gold/20 px-2 py-0.5 font-bold text-gold tabular-nums">
                    {t("msg.chat.unreadCount", { count: hover.c.unread })}
                  </span>
                )}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** An avatar in a ring of its role's colour — gold when something is unread. */
function RingedAvatar({ c, size, active }: { c: Conversation; size: number; active?: boolean }) {
  const unread = c.unread > 0;
  return (
    <span className="relative inline-block shrink-0">
      <span
        className={`block rounded-full p-[2px] transition ${
          unread || active ? "bg-linear-to-br from-gold via-gold-soft to-gold" : (ROLE_LOOK[c.user.role]?.ring ?? "bg-forest/15")
        } ${active ? "shadow-[0_0_0_3px_rgba(193,150,90,0.18)]" : ""}`}
      >
        <span className="block rounded-full bg-cream-card p-[2px]">
          <UserAvatar user={c.user} size={size} />
        </span>
      </span>
      {c.user.online && (
        <span className="absolute end-0.5 bottom-0.5 size-3.5 rounded-full border-[2.5px] border-cream-card bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
      )}
    </span>
  );
}

function ChatRow({
  c,
  active,
  typing,
  onOpen,
}: {
  c: Conversation;
  active: boolean;
  typing: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const unread = c.unread > 0;
  const last = c.last;
  const look = ROLE_LOOK[c.user.role];
  const RoleIcon = look?.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="chat-row"
      data-active={active || undefined}
      className={`group relative mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-all duration-200 ${
        active
          ? "bg-linear-to-l from-gold/20 via-gold/[0.09] to-transparent shadow-[inset_0_0_0_1px_rgba(193,150,90,0.35)]"
          : "hover:bg-forest/[0.045]"
      }`}
    >
      {active && <span className="absolute inset-y-3 start-0 w-1 rounded-full bg-gold shadow-[0_0_10px_rgba(193,150,90,0.7)]" />}
      <RingedAvatar c={c} size={46} active={active} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate text-[14px] ${unread ? "font-extrabold" : "font-bold"} text-forest`}>{personName(c.user)}</span>
          {RoleIcon && (
            <span className={`inline-flex shrink-0 items-center gap-0.5 text-[10.5px] font-semibold ${look.text}`} title={t(`roles.${c.user.role}`)}>
              <RoleIcon size={12} />
              {t(`roles.${c.user.role}`)}
            </span>
          )}
          {last && (
            <span className={`ms-auto shrink-0 text-[11px] tabular-nums ${unread ? "font-bold text-gold" : "text-clay/90"}`}>
              {shortWhen(last.createdAt)}
            </span>
          )}
        </span>

        <span className="mt-1 flex items-center gap-1.5">
          {typing ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold" data-testid="row-typing">
              {t("msg.chat.typing")}
              <span className="inline-flex items-center gap-0.5" aria-hidden>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1 animate-bounce rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </span>
          ) : (
            <>
              {last?.mine &&
                (last.read ? (
                  <CheckCheck size={15} className="shrink-0 text-sky-500 dark:text-sky-400" />
                ) : (
                  <Check size={15} className="shrink-0 text-clay/80" />
                ))}
              {last?.broadcast && <Megaphone size={13} className="shrink-0 text-gold" />}
              <span className={`truncate text-[12.5px] ${unread ? "font-semibold text-forest" : "text-clay"}`} dir="auto">
                {last?.mine && <span className="font-medium text-gold/90">{t("msg.chat.youPrefix")} </span>}
                {last?.subject ? `${last.subject} — ` : ""}
                {last?.preview ?? ""}
              </span>
            </>
          )}
          {unread && (
            <span
              className="ms-auto grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded-full bg-linear-to-br from-gold to-gold-soft px-1.5 text-[11px] font-extrabold text-forest-deep shadow-[0_3px_10px_-2px_rgba(193,150,90,0.7)] tabular-nums"
              data-testid="chat-unread"
            >
              {c.unread > 99 ? "99+" : c.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function BroadcastRows({
  items,
  loading,
  activeId,
  onOpen,
  onNew,
}: {
  items: { id: string; subject: string | null; body: string; broadcast: string | null; createdAt: string; readCount: number; _count: { recipients: number } }[];
  loading: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="animate-spin text-gold" />
      </div>
    );
  return (
    <div className="px-2 pt-2">
      <button
        type="button"
        onClick={onNew}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/50 bg-gold/[0.06] px-3 py-3 text-[12.5px] font-semibold text-forest transition hover:bg-gold/[0.12]"
      >
        <Megaphone size={15} className="text-gold" />
        {t("msg.broadcastNew")}
      </button>
      {items.length === 0 ? (
        <p className="px-3 py-8 text-center text-[12px] text-clay">{t("msg.chat.noBroadcasts")}</p>
      ) : (
        items.map((m) => {
          const total = m._count?.recipients ?? 0;
          const pct = total ? Math.round((m.readCount / total) * 100) : 0;
          const on = activeId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              className={`relative mb-1 flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-start transition ${
                on ? "bg-linear-to-l from-gold/20 via-gold/[0.09] to-transparent shadow-[inset_0_0_0_1px_rgba(193,150,90,0.35)]" : "hover:bg-forest/[0.045]"
              }`}
            >
              {on && <span className="absolute inset-y-3 start-0 w-1 rounded-full bg-gold" />}
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-gold/30 bg-gold/15 text-gold">
                <Megaphone size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-bold text-forest">{m.subject || t("messages.noSubject")}</span>
                  <span className="ms-auto shrink-0 text-[11px] text-clay">{shortWhen(m.createdAt)}</span>
                </span>
                <span className="block truncate text-[11.5px] text-clay">{broadcastLabel(m.broadcast, t)}</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest/10">
                    <span className="block h-full rounded-full bg-linear-to-l from-emerald-400 to-emerald-600" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="shrink-0 text-[10.5px] font-semibold text-clay tabular-nums">
                    {t("msg.readOfShort", { read: m.readCount, total })}
                  </span>
                </span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  testId,
  primary,
}: {
  icon: typeof Search;
  label: string;
  onClick: () => void;
  testId?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={`grid size-9 place-items-center rounded-xl transition ${
        primary
          ? "bg-gold text-forest-deep shadow-[0_4px_12px_-4px_rgba(193,150,90,0.7)] hover:bg-gold-soft"
          : "border border-forest/10 text-clay hover:border-forest/20 hover:bg-forest/5 hover:text-forest"
      }`}
    >
      <Icon size={17} className="rtl:-scale-x-100" />
    </button>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
  gold,
  testId,
}: {
  icon: typeof Search;
  label: string;
  onClick: () => void;
  gold?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={`grid size-12 place-items-center rounded-2xl transition duration-300 ease-out hover:-translate-y-0.5 ${
        gold
          ? "bg-linear-to-br from-gold to-gold-soft text-forest-deep shadow-[0_8px_20px_-8px_rgba(193,150,90,0.9)] hover:shadow-[0_12px_26px_-8px_rgba(193,150,90,0.95)]"
          : "border border-forest/12 bg-cream-card/70 text-clay shadow-sm backdrop-blur-sm hover:border-gold/40 hover:text-forest"
      }`}
    >
      <Icon size={18} className="rtl:-scale-x-100" />
    </button>
  );
}
