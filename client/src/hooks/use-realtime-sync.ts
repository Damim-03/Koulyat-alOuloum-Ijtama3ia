import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../app/socket-context";

interface ChangePayload {
  resource: string;
  action?: "created" | "updated" | "deleted";
  id?: string;
  at: string;
}

/**
 * Keeps every open screen current.
 *
 * The server announces which resource changed; we mark the matching queries
 * stale and TanStack Query refetches the ones actually on screen. Because the
 * match is by query-key membership, every existing hook is covered without
 * touching it — ["admin","topics",…], ["student","topics",…] and
 * ["professor","topics",…] all react to one "topics" event.
 *
 * Only mounted queries refetch; the rest simply refetch next time they mount.
 */
export function useRealtimeSync() {
  const socket = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const onChange = ({ resource }: ChangePayload) => {
      if (!resource) return;

      // The server names resources after the URL segment, which is plural
      // ("users"), while detail screens key their query on the singular
      // ("admin","user",id). An exact match therefore never fired for any
      // detail page: editing a user refreshed the list behind it but left the
      // open profile showing the old avatar and the old completion figure.
      const forms = new Set([resource]);
      if (resource.endsWith("ies")) forms.add(resource.slice(0, -3) + "y");
      else if (resource.endsWith("s")) forms.add(resource.slice(0, -1));

      qc.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some(
            (part) => typeof part === "string" && forms.has(part),
          ),
      });
    };

    // A pushed bell notification also refreshes the unread badge.
    const onNotification = () => {
      qc.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some(
            (part) => typeof part === "string" && part === "notifications",
          ),
      });
    };

    socket.on("data:changed", onChange);
    socket.on("notification", onNotification);
    return () => {
      socket.off("data:changed", onChange);
      socket.off("notification", onNotification);
    };
  }, [socket, qc]);
}
