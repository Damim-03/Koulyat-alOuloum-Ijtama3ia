import { useEffect, useRef, useState } from "react";
import { useSocket } from "../app/socket-context";

export type NetworkQuality = "online" | "slow" | "offline";

/** A blip shorter than this never reaches the UI, so reconnects don't flash. */
const GRACE_MS = 300;

/**
 * Connection quality, from two independent signals.
 *
 * `navigator.onLine` only reports whether a network interface is up — it stays
 * true when the Wi-Fi is connected but the internet is not, when DNS fails,
 * behind a captive portal, or when the server itself is down. On its own it
 * misses the outages that matter most here.
 *
 * The live socket closes the gap: it is an open connection to our own server,
 * so a drop is known within milliseconds of it happening rather than at the
 * next failed request.
 */
export function useNetworkStatus() {
  const socket = useSocket();
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [slow, setSlow] = useState(false);
  const [serverDown, setServerDown] = useState(false);

  // ── interface-level ──
  useEffect(() => {
    const goOnline = () => setBrowserOnline(true);
    const goOffline = () => setBrowserOnline(false);
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

    const check = () => {
      const t = conn.effectiveType;
      setSlow(t === "slow-2g" || t === "2g");
    };
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
      timer = setTimeout(() => setServerDown(true), GRACE_MS);
    };
    const markUp = () => {
      everConnected.current = true;
      if (timer) clearTimeout(timer);
      setServerDown(false);
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

  const status: NetworkQuality =
    !browserOnline || serverDown ? "offline" : slow ? "slow" : "online";

  return { status };
}
