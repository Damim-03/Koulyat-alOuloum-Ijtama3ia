import { create } from "zustand";
import { queryClient } from "../../app/query-client";
import { pingServer } from "../api/health";

/**
 * حالُ الاتّصال بالخادم، للتطبيق كلّه.
 *
 * ثلاث إشارات تُغذّيها: أحداثُ المتصفّح (online/offline)، وكلُّ طلبٍ يمرّ
 * بعميل axios (فشلُ شبكةٍ أو 502/503/504 ⇒ «تحقّق»، ونجاحٌ ⇒ «يعمل»)، والمقبسُ
 * الحيّ. وعند الشكّ تسأل الخادمَ نفسه (`/api/health`) — فطلبٌ واحد فشل لسببه
 * لا يُعلن انقطاعاً.
 *
 * وما دام الخادم لا يجيب عادت تسأله على مهلٍ متزايد (5، 10، 20، ثم كلّ 30
 * ثانية)؛ ولحظةَ يجيب تُعيد جلبَ كلّ استعلامٍ ظاهرٍ فشل، فتعود الصفحاتُ
 * كلّها معاً دون أن يضغط أحد شيئاً.
 */

export type Link = "ok" | "checking" | "down" | "offline";

type ConnectionState = {
  link: Link;
  /** When the next look at a server that does not answer is due. */
  nextAt: number | null;
  /** The length of that wait, for a countdown to measure against. */
  waitMs: number;
  /** When the server last answered a look. */
  checkedAt: number;
  /** When the connection last came back after an outage. */
  restoredAt: number | null;
  /** The browser reports a very slow link — and since when. */
  slow: boolean;
  slowAt: number | null;
};

const BACKOFF_S = [5, 10, 20, 30];

export const useConnection = create<ConnectionState>(() => ({
  link: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "ok",
  nextAt: null,
  waitMs: 0,
  checkedAt: 0,
  restoredAt: null,
  slow: false,
  slowAt: null,
}));

let attempt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<boolean> | null = null;

function scheduleNextLook() {
  const ms = BACKOFF_S[Math.min(attempt, BACKOFF_S.length - 1)] * 1000;
  attempt += 1;
  clearTimeout(timer);
  timer = setTimeout(() => void checkConnection(), ms);
  useConnection.setState({ link: "down", nextAt: Date.now() + ms, waitMs: ms });
}

/** The server answered — after an outage, everything that failed loads again. */
export function reportServerUp() {
  const broken = useConnection.getState().link !== "ok";
  attempt = 0;
  clearTimeout(timer);
  useConnection.setState({
    link: "ok",
    nextAt: null,
    waitMs: 0,
    checkedAt: Date.now(),
    ...(broken && { restoredAt: Date.now() }),
  });
  if (broken) void queryClient.refetchQueries({ type: "active", predicate: (q) => q.state.status === "error" });
}

export function reportOffline() {
  clearTimeout(timer);
  useConnection.setState({ link: "offline", nextAt: null, waitMs: 0 });
}

/** Ask the server now — one look at a time; the answer settles the state. */
export function checkConnection(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    reportOffline();
    return Promise.resolve(false);
  }
  if (inflight) return inflight;
  // While all is well a look stays quiet; after an outage it shows.
  if (useConnection.getState().link !== "ok") useConnection.setState({ link: "checking", nextAt: null });
  inflight = pingServer().then((up) => {
    inflight = null;
    if (up) reportServerUp();
    else scheduleNextLook();
    return up;
  });
  return inflight;
}

/** A request could not reach the server: find out whether it is down. */
export function reportUnreachable() {
  const { link } = useConnection.getState();
  if (link === "down" || link === "checking") return;
  void checkConnection();
}

export function reportSlow(slow: boolean) {
  if (useConnection.getState().slow !== slow) useConnection.setState({ slow, slowAt: slow ? Date.now() : null });
}

/** For tests: forget everything. */
export function resetConnection() {
  attempt = 0;
  inflight = null;
  clearTimeout(timer);
  useConnection.setState({ link: "ok", nextAt: null, waitMs: 0, checkedAt: 0, restoredAt: null, slow: false, slowAt: null });
}

// A module that holds app-wide state cannot be swapped while the app runs: the
// API client would keep reporting to the old copy while the pill reads the new
// one, and an outage that ended would go on showing. A change reloads instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
