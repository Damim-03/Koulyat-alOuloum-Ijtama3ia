import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { useLanguage } from "../../hooks/use-language";
import { useAuthStore } from "../../store/auth.store";
import { SESSION_EXPIRED_EVENT } from "../../lib/api/client";
import { PATHS } from "../../routes/paths";
import { SessionExpiredModal } from "./session-expired-modal";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

export function SessionGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { localePath } = useLanguage();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"idle" | "token">("token");
  const shownRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showExpired = (r: "idle" | "token") => {
    if (shownRef.current) return;
    shownRef.current = true;
    setReason(r);
    setOpen(true);
    // clear tokens without navigating (modal handles redirect)
    useAuthStore.getState().logout();
  };

  // 1) token failure event from axios
  useEffect(() => {
    const handler = () => showExpired("token");
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  // 2) idle timer (only while authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => showExpired("idle"), IDLE_TIMEOUT_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isAuthenticated]);

  const handleLogin = () => {
    setOpen(false);
    shownRef.current = false;
    logout(); // navigates to login
    navigate(localePath(PATHS.login), { replace: true });
  };

  return (
    <>
      {children}
      <SessionExpiredModal open={open} reason={reason} onLogin={handleLogin} />
    </>
  );
}