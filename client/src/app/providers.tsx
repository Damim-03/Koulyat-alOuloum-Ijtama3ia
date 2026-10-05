import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./query-client";
import { Toaster } from "../components/ui/toaster";
import { AuthBootstrap } from "./auth-bootstrap";
import { ConnectionPill } from "../components/connection-pill";
import { SocketProvider } from "./socket-provider";
import { useRealtimeSync } from "../hooks/use-realtime-sync";
import { useMessageAlerts } from "../features/messages/hooks/use-message-alerts";

/** Invisible: subscribes to server change events and refreshes what is open. */
function RealtimeSync() {
  useRealtimeSync();
  // A new message announces itself on whatever screen is open.
  useMessageAlerts();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <BrowserRouter>
          <AuthBootstrap />
          <RealtimeSync />
          {children}
          <Toaster />
          <ConnectionPill />
        </BrowserRouter>
      </SocketProvider>
    </QueryClientProvider>
  );
}
