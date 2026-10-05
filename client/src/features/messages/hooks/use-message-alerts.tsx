import { useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSocket } from "../../../app/socket-context";
import { useAuthStore } from "../../../store/auth.store";
import i18n from "../../../i18n/i18n";
import type { NewMessagePayload } from "../../../lib/socket/socket";
import { MessageToast } from "../components/message-toast";
import { isChatOpen, isThreadOpen } from "../messages-utils";

/** Where each role reads its messages. */
export const messagesPath = (role?: string | null) =>
  `/${i18n.language || "ar"}/${role === "admin" || role === "professor" ? role : "student"}/messages`;

/**
 * A new message announces itself the moment it is stored, on every screen:
 * a card with who wrote and what about, one click from the conversation.
 * Lists and badges refresh on their own through the realtime sync; this adds
 * the part a refetch cannot — being told.
 */
export function useMessageAlerts() {
  const socket = useSocket();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (!socket || !role) return;
    const onNew = (payload: NewMessagePayload) => {
      // Already open in front of the reader: the conversation shows it live.
      if (isThreadOpen(payload.threadId ?? payload.id) || isChatOpen(payload.sender.id)) return;
      toast.custom(
        (id) => (
          <MessageToast
            payload={payload}
            onOpen={() => {
              toast.dismiss(id);
              navigate(`${messagesPath(String(role))}?c=${payload.sender.id}`);
            }}
            onClose={() => toast.dismiss(id)}
          />
        ),
        { duration: 8000 },
      );
    };
    socket.on("message:new", onNew);
    return () => {
      socket.off("message:new", onNew);
    };
  }, [socket, role, navigate]);
}

/** Whether the realtime channel is up right now. */
export function useSocketStatus() {
  const socket = useSocket();
  return useSyncExternalStore(
    (cb) => {
      socket?.on("connect", cb);
      socket?.on("disconnect", cb);
      return () => {
        socket?.off("connect", cb);
        socket?.off("disconnect", cb);
      };
    },
    () => !!socket?.connected,
  );
}
