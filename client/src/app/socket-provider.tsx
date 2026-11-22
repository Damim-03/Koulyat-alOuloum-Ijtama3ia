import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { t } from "i18next";
import { useAuthStore } from "../store/auth.store";
import { createSocket } from "../lib/socket/socket";
import {
  ensureAccessToken,
  refreshAccessToken,
  SESSION_EXPIRED_EVENT,
  type SessionEndReason,
} from "../lib/api/client";
import { SocketContext } from "./socket-context";

export function SocketProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // The access token is kept in memory only, so after a reload there is none
  // until the refresh cookie has been exchanged — and the handshake needs one.
  const hasToken = useAuthStore((s) => !!s.accessToken);

  // Created once during render (not in an effect) -> no setState-in-effect.
  const [socket] = useState(() => createSocket());

  useEffect(() => {
    if (isAuthenticated && !hasToken) void ensureAccessToken();
  }, [isAuthenticated, hasToken]);

  // Signed out from elsewhere. The server says so on the socket the instant it
  // happens, so this page ends its session now rather than at its next
  // request — which, on an idle screen, could be many minutes away.
  useEffect(() => {
    const onRevoked = () => {
      if (!useAuthStore.getState().isAuthenticated) return; // our own sign-out
      useAuthStore.getState().logout();
      // Signing out sends the page straight to the login screen, taking the
      // session dialog with it; the toaster lives above the routes and stays.
      toast.warning(t("session.titleRevoked"), {
        description: t("session.descRevoked"),
        duration: 12_000,
      });
      window.dispatchEvent(
        new CustomEvent<SessionEndReason>(SESSION_EXPIRED_EVENT, { detail: "revoked" }),
      );
    };
    // The server cut the line without a word (the notice can be lost with the
    // connection). Ask it: a refused refresh ends the session through the
    // usual path; an accepted one means the line can simply come back.
    const onDisconnect = (why: string) => {
      if (why !== "io server disconnect") return;
      if (!useAuthStore.getState().isAuthenticated) return;
      refreshAccessToken().then(
        () => socket.connect(),
        () => undefined,
      );
    };
    socket.on("session:revoked", onRevoked);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("session:revoked", onRevoked);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!isAuthenticated || !user || !hasToken) return;

    // Rooms are no longer requested from here. The server authenticates the
    // handshake and joins this connection to its own user and role rooms —
    // the client used to name them itself, which meant any client could ask
    // for someone else's.
    //
    // Development-only tracing. A refused handshake is otherwise silent: the
    // page looks fine and simply stops receiving updates, which is very hard
    // to tell apart from "nothing changed yet".
    if (import.meta.env.DEV) {
      const onOk = () => console.info("[socket] connected", socket.id);
      const onErr = (e: Error) => console.warn("[socket] refused:", e.message);
      const onBye = (why: string) =>
        console.info("[socket] disconnected:", why);
      const onChanged = (p: { resource?: string }) =>
        console.info("[socket] data:changed", p?.resource);

      socket.on("connect", onOk);
      socket.on("connect_error", onErr);
      socket.on("disconnect", onBye);
      socket.on("data:changed", onChanged);
      (window as unknown as { __appSocket?: typeof socket }).__appSocket =
        socket;

      socket.connect();
      return () => {
        socket.off("connect", onOk);
        socket.off("connect_error", onErr);
        socket.off("disconnect", onBye);
        socket.off("data:changed", onChanged);
        socket.disconnect();
      };
    }

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, user?.id, hasToken, socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
