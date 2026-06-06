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

    const onConnect = () => {
      socket.emit("join-room", user.id);
    };

    socket.on("connect", onConnect);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.disconnect();
    };
  }, [isAuthenticated, user?.id, socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
