import { useEffect, useState } from "react";

export type NetworkQuality = "online" | "slow" | "offline";

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkQuality>(
    navigator.onLine ? "online" : "offline",
  );

  useEffect(() => {
    const goOnline = () => setStatus("online");
    const goOffline = () => setStatus("offline");

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // detect slow connection if the API is available
    const conn = (navigator as Navigator & {
      connection?: { effectiveType?: string; addEventListener?: (e: string, cb: () => void) => void; removeEventListener?: (e: string, cb: () => void) => void };
    }).connection;

    const checkSpeed = () => {
      if (!navigator.onLine) return setStatus("offline");
      const t = conn?.effectiveType;
      if (t === "slow-2g" || t === "2g") setStatus("slow");
      else setStatus("online");
    };
    checkSpeed();
    conn?.addEventListener?.("change", checkSpeed);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      conn?.removeEventListener?.("change", checkSpeed);
    };
  }, []);

  return { status };
}