import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "../store/auth.store";
import { createSocket } from "../lib/socket/socket";
import { SocketContext } from "./socket-context";

export function SocketProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Created once during render (not in an effect) -> no setState-in-effect.
  const [socket] = useState(() => createSocket());

  useEffect(() => {
    if (!isAuthenticated || !user) return;

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
      const onBye = (why: string) => console.info("[socket] disconnected:", why);
      const onChanged = (p: { resource?: string }) =>
        console.info("[socket] data:changed", p?.resource);

      socket.on("connect", onOk);
      socket.on("connect_error", onErr);
      socket.on("disconnect", onBye);
      socket.on("data:changed", onChanged);
      (window as unknown as { __appSocket?: typeof socket }).__appSocket = socket;

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
  }, [isAuthenticated, user?.id, socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
