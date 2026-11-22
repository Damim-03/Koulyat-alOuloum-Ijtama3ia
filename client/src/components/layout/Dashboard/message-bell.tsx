import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck, Inbox, Loader2, Megaphone, X } from "lucide-react";
import { useSocket } from "../../../app/socket-context";
import { useAuthStore } from "../../../store/auth.store";
import type { NewMessagePayload } from "../../../lib/socket/socket";
import { UserAvatar } from "../../ui/user-avatar";
import { useInbox, useMarkAllMessagesRead, useMessagesSummary } from "../../../features/messages/hooks/messages-hook";
import { messagesPath } from "../../../features/messages/hooks/use-message-alerts";
import { holdBell, personName, previewOf, shortWhen, worthTelling } from "../../../features/messages/messages-utils";
import { playCue } from "../../../lib/sound";

/** A bubble stays this long — longer while the pointer is on it. */
const SHOWN_MS = 6000;
/** Its going: the length of `.bubble-out`. */
const GONE_MS = 220;
/** Bubbles at once, the newest nearest the bell. */
const MAX_BUBBLES = 3;
/** Messages listed when the bell is opened. */
const LISTED = 6;
/** On a phone: the bubbles and the list across the screen, under the bar — not hanging off the bell past the edge. */
const PHONE = "max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.5rem] max-sm:mt-0 max-sm:w-auto";

/**
 * الجرس في رأس اللوحات: الرسائل وحدها — من طالبٍ أو أستاذٍ أو مسؤول.
 *
 * عليه عدد ما لم يُقرأ (العدد نفسه على «الرسائل» في القائمة الجانبية، يُبقيه
 * المقبس حيّاً). وحين تصل رسالة: يتأرجح الجرس من أعلاه، وتنتشر منه حلقةٌ ذهبيّة،
 * ويقفز العدد — وتخرج منه فقاعةٌ تنمو نحو الصفحة: من كتب، وعمّ، وأوّل سطر؛ نقرةٌ
 * تفتح المحادثة. وتذهب وحدها بعد لحظات، ولا تذهب والمؤشّر عليها.
 *
 * ويُفتح بنقرة: آخر الرسائل، و«تعليم الكلّ كمقروء»، والطريق إلى الرسائل كلّها.
 *
 * وحيث الجرس ظاهر، يتنحّى تنبيه الزاوية (use-message-alerts): رسالةٌ تُقال مرّةً
 * واحدة. ورسالةٌ محادثتُها مفتوحةٌ أمام صاحبها لا يُقال عنها شيء — تظهر فيها.
 */
export function MessageBell() {
  const { t } = useTranslation();
  const socket = useSocket();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const unread = useMessagesSummary().data?.unread ?? 0;
  const [open, setOpen] = useState(false);
  // How many messages have arrived since the page opened: each one rings the bell anew.
  const [rings, setRings] = useState(0);
  const [bubbles, setBubbles] = useState<NewMessagePayload[]>([]);
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const inbox = useInbox({ limit: LISTED }, open);
  const markAll = useMarkAllMessagesRead();

  // While it is on screen, the corner toast stands aside.
  useEffect(() => holdBell(), []);

  const arrive = useEffectEvent((p: NewMessagePayload) => {
    if (!worthTelling(p)) return;
    // It rings — heard as well as seen (unless sound is off in the settings).
    playCue("messageArrived");
    setRings((n) => n + 1);
    // Open, the list shows it already.
    if (!open) setBubbles((b) => [p, ...b.filter((x) => x.id !== p.id)].slice(0, MAX_BUBBLES));
  });
  useEffect(() => {
    if (!socket) return;
    const onNew = (p: NewMessagePayload) => arrive(p);
    socket.on("message:new", onNew);
    return () => {
      socket.off("message:new", onNew);
    };
  }, [socket]);

  // Closed by a press outside, or Escape — which returns to the bell.
  useEffect(() => {
    if (!open) return;
    const onPress = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** To the conversation with whoever wrote — or to all the messages. */
  const go = (senderId?: string) => {
    setOpen(false);
    navigate(senderId ? `${messagesPath(role)}?c=${senderId}` : messagesPath(role));
  };
  const drop = (id: string) => setBubbles((b) => b.filter((x) => x.id !== id));
  const items = inbox.data?.items ?? [];

  return (
    <div className="relative" ref={box}>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setBubbles([]);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("msg.bell.aria", { count: unread })}
        data-testid="message-bell"
        className={`relative grid size-10 place-items-center rounded-xl border transition duration-200 focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:outline-none ${
          open ? "border-gold/50 bg-gold/10 text-gold" : "border-forest/10 text-forest hover:border-gold/40 hover:bg-forest/5"
        }`}
      >
        {/* A message came: a gold ring spreads from the bell as it swings. */}
        {rings > 0 && <span key={`halo-${rings}`} aria-hidden className="bell-halo pointer-events-none absolute inset-0 rounded-xl ring-2 ring-gold/70" />}
        {/* Keys apart from the count's: a number shared by both would keep the old bell beside the new. */}
        <span key={`swing-${rings}`} className={rings ? "bell-swing" : undefined} data-testid="message-bell-icon" data-rings={rings}>
          <Bell size={19} />
        </span>
        {unread > 0 && (
          // A new number pops in.
          <span
            key={`count-${unread}`}
            data-testid="message-bell-count"
            className="badge-pop absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10.5px] font-bold text-white tabular-nums shadow-[0_4px_10px_-3px_rgba(239,68,68,0.8)] ring-2 ring-cream-2"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* The bubbles grow out of the bell, the newest nearest it. */}
      {/* On a phone the bell is not at the screen's edge: across the screen, under the bar, instead. */}
      <div
        className={`pointer-events-none absolute end-0 top-full z-50 mt-3 flex w-[min(21rem,calc(100vw-1.5rem))] flex-col gap-2 ${PHONE}`}
        aria-live="polite"
      >
        {bubbles.map((p, i) => (
          <Bubble
            key={p.id}
            p={p}
            first={i === 0}
            paused={paused}
            onHover={setPaused}
            onOpen={() => {
              drop(p.id);
              go(p.sender.id);
            }}
            onGone={() => drop(p.id)}
          />
        ))}
      </div>

      {/* Kept in the page to fade in and out, but a dialog only while open: closed, it is nothing at all to anyone. */}
      <div
        role={open ? "dialog" : undefined}
        aria-label={open ? t("msg.bell.title") : undefined}
        aria-hidden={!open}
        inert={!open}
        data-testid="message-bell-panel"
        className={`absolute end-0 top-full z-50 mt-2.5 w-[min(22rem,calc(100vw-1.5rem))] origin-top transition-all duration-200 ease-out motion-reduce:transition-none ${PHONE} ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_24px_60px_-16px_rgba(26,49,45,0.5)]">
          <div className="flex items-center gap-3 border-b border-forest/8 bg-linear-to-b from-cream-2 to-cream-card px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/25">
              <Bell size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[15px] font-bold text-forest">{t("msg.bell.title")}</p>
              <p className="text-[11.5px] text-clay">{unread ? t("msg.bell.unread", { count: unread }) : t("msg.bell.allRead")}</p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                data-testid="message-bell-read-all"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-gold transition hover:bg-gold/10 disabled:opacity-50"
              >
                <CheckCheck size={14} />
                {t("msg.bell.markAll")}
              </button>
            )}
          </div>

          <ul className="max-h-[22rem] overflow-y-auto p-1.5" data-testid="message-bell-list">
            {inbox.isLoading && (
              <li className="grid place-items-center py-8">
                <Loader2 size={20} className="animate-spin text-clay" />
              </li>
            )}
            {!inbox.isLoading && !items.length && (
              <li className="grid place-items-center gap-1.5 px-4 py-8 text-center text-clay">
                <Inbox size={26} className="text-forest/25" />
                <span className="text-[12.5px] font-semibold">{t("msg.bell.empty")}</span>
              </li>
            )}
            {items.map((it) => {
              const m = it.message;
              const fresh = !it.readAt;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => go(m.sender.id)}
                    className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-start transition hover:bg-gold/[0.07] ${fresh ? "bg-gold/[0.045]" : ""}`}
                  >
                    <UserAvatar user={m.sender} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[13px] text-forest ${fresh ? "font-bold" : "font-semibold"}`}>{personName(m.sender)}</span>
                        <span className="shrink-0 text-[10.5px] text-clay tabular-nums">{shortWhen(m.createdAt)}</span>
                      </span>
                      <span className={`mt-0.5 flex items-center gap-1 truncate text-[12px] ${fresh ? "text-forest/85" : "text-clay"}`}>
                        {m.broadcast && <Megaphone size={11} className="shrink-0 text-gold" />}
                        <span className="truncate">{m.subject || previewOf(m.body.split("\n")[0], m.attachments, t)}</span>
                      </span>
                    </span>
                    {fresh && <span aria-label={t("msg.bell.new")} className="mt-1.5 size-2 shrink-0 rounded-full bg-gold shadow-[0_0_0_3px_rgba(193,150,90,0.18)]" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <Link
            to={messagesPath(role)}
            onClick={() => setOpen(false)}
            className="block border-t border-forest/8 px-4 py-3 text-center text-[12.5px] font-bold text-gold transition hover:bg-gold/[0.07]"
          >
            {t("msg.bell.all")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A new message, grown out of the bell: who, about what, the first line — a click opens it. */
function Bubble({
  p,
  first,
  paused,
  onHover,
  onOpen,
  onGone,
}: {
  p: NewMessagePayload;
  /** The one nearest the bell: its tail points up to it. */
  first: boolean;
  paused: boolean;
  onHover: (on: boolean) => void;
  onOpen: () => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const gone = useEffectEvent(onGone);

  // Its time up — not while the pointer rests on one of them.
  useEffect(() => {
    if (paused || leaving) return;
    const timer = setTimeout(() => setLeaving(true), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [paused, leaving]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => gone(), GONE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  return (
    <div
      className={`bubble-from pointer-events-auto relative ${leaving ? "bubble-out" : "bubble-in"}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      data-testid="bell-bubble"
    >
      {first && (
        <span aria-hidden className="absolute end-4 -top-1.5 size-3 rotate-45 rounded-[3px] border-s border-t border-gold/35 bg-cream-card max-sm:hidden" />
      )}
      <div className="relative overflow-hidden rounded-2xl border border-gold/35 bg-cream-card shadow-[0_22px_48px_-20px_rgba(26,49,45,0.6)]">
        <span aria-hidden className="absolute inset-y-3 start-0 w-1 rounded-e-full bg-linear-to-b from-gold-soft to-gold" />
        <button type="button" onClick={onOpen} className="flex w-full min-w-0 items-start gap-3 p-3 pe-10 text-start transition hover:bg-gold/[0.05]">
          <span className="relative shrink-0">
            <UserAvatar user={p.sender} size={38} />
            <span className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-cream-card bg-emerald-500" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide text-gold">
              {p.broadcast ? <Megaphone size={11} /> : <Bell size={11} />}
              {t(p.broadcast ? "msg.toast.broadcast" : "msg.toast.newMessage")}
              <span className="font-medium text-clay/80">· {t("msg.bell.now")}</span>
            </span>
            <span className="mt-0.5 block truncate text-[13.5px] font-bold text-forest">{personName(p.sender)}</span>
            {p.subject && <span className="block truncate text-[12px] font-semibold text-forest/85">{p.subject}</span>}
            <span className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-clay">{previewOf(p.preview, p.attachments, t)}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label={t("msg.close")}
          className="absolute end-2 top-2 grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
