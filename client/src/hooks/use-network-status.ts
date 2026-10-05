import { useEffect, useRef } from "react";
import { useSocket } from "../app/socket-context";
import { checkConnection, reportOffline, reportServerUp, reportSlow, reportUnreachable } from "../lib/connection/connection";

/** A blip shorter than this never reaches the UI, so reconnects don't flash. */
const GRACE_MS = 300;

/**
 * Feeds the app-wide connection state (`lib/connection`) from the signals the
 * browser gives — mounted once, beside the pill that shows it.
 *
 * `navigator.onLine` only reports whether a network interface is up — it stays
 * true when the Wi-Fi is connected but the internet is not, when DNS fails,
 * behind a captive portal, or when the server itself is down. On its own it
 * misses the outages that matter most here.
 *
 * The live socket closes part of the gap: it is an open connection to our own
 * server, so a drop is known within milliseconds rather than at the next
 * failed request. And every request through the API client reports too, so a
 * page opened while the server is already down is caught at once — the socket
 * alone never sees an outage it was never connected through.
 */
export function useConnectionWatch() {
  const socket = useSocket();

  // ── interface-level ──
  useEffect(() => {
    const goOnline = () => void checkConnection();
    const goOffline = () => reportOffline();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── connection quality, where the browser exposes it ──
  useEffect(() => {
    const conn = (
      navigator as Navigator & {
        connection?: {
          effectiveType?: string;
          addEventListener?: (e: string, cb: () => void) => void;
          removeEventListener?: (e: string, cb: () => void) => void;
        };
      }
    ).connection;
    if (!conn) return;

    const check = () => reportSlow(conn.effectiveType === "slow-2g" || conn.effectiveType === "2g");
    check();
    conn.addEventListener?.("change", check);
    return () => conn.removeEventListener?.("change", check);
  }, []);

  // ── the live socket: the fast, truthful signal ──
  const everConnected = useRef(false);
  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const markDown = () => {
      // Only meaningful once the socket has actually been up: before sign-in
      // it is deliberately disconnected, which is not an outage.
      if (!everConnected.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(reportUnreachable, GRACE_MS);
    };
    const markUp = () => {
      everConnected.current = true;
      if (timer) clearTimeout(timer);
      reportServerUp();
    };

    if (socket.connected) markUp();
    socket.on("connect", markUp);
    socket.on("disconnect", markDown);
    socket.on("connect_error", markDown);

    return () => {
      if (timer) clearTimeout(timer);
      socket.off("connect", markUp);
      socket.off("disconnect", markDown);
      socket.off("connect_error", markDown);
    };
  }, [socket]);
}
