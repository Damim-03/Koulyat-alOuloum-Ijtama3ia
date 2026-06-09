import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Wifi, WifiOff, SignalLow } from "lucide-react";
import {
  useNetworkStatus,
  type NetworkQuality,
} from "../hooks/use-network-status";

const STYLES: Record<
  NetworkQuality,
  { icon: typeof Wifi; color: string; bg: string; border: string }
> = {
  online: {
    icon: Wifi,
    color: "#26423D",
    bg: "rgba(38,66,61,0.08)",
    border: "rgba(38,66,61,0.25)",
  },
  slow: {
    icon: SignalLow,
    color: "#C1965A",
    bg: "rgba(193,150,90,0.1)",
    border: "rgba(193,150,90,0.3)",
  },
  offline: {
    icon: WifiOff,
    color: "#dc2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.25)",
  },
};

function Toast() {
  const { t } = useTranslation();
  const { status } = useNetworkStatus();
  const prev = useRef<NetworkQuality | null>(null);
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState<NetworkQuality>("online");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = status;
      return;
    }
    if (prev.current === status) return;
    prev.current = status;
    setCurrent(status);
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    if (status !== "offline")
      timer.current = setTimeout(() => setShow(false), 4000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status]);

  const cfg = STYLES[current];
  const Icon = cfg.icon;
  const label =
    current === "online"
      ? t("network.online")
      : current === "slow"
        ? t("network.slow")
        : t("network.offline");
  const sub =
    current === "online"
      ? t("network.onlineSub")
      : current === "slow"
        ? t("network.slowSub")
        : t("network.offlineSub");

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        zIndex: 2147483647,
        transform: show
          ? "translateX(-50%) translateY(0)"
          : "translateX(-50%) translateY(-16px)",
        opacity: show ? 1 : 0,
        visibility: show ? "visible" : "hidden",
        transition:
          "transform .4s cubic-bezier(.34,1.56,.64,1), opacity .3s ease",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 18px",
          borderRadius: 16,
          border: `1px solid ${cfg.border}`,
          background: cfg.bg,
          backdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          minWidth: 240,
          maxWidth: 360,
        }}
      >
        <Icon size={18} style={{ color: cfg.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: cfg.color,
              margin: 0,
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "rgba(107,99,87,0.85)",
              margin: "2px 0 0",
            }}
          >
            {sub}
          </p>
        </div>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: cfg.color,
            flexShrink: 0,
            boxShadow: `0 0 6px ${cfg.color}`,
          }}
        />
      </div>
    </div>
  );
}

export function NetworkToast() {
  return createPortal(<Toast />, document.body);
}
