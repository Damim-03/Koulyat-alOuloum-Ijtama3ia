import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./query-client";
import { Toaster } from "../components/ui/toaster";
import { AuthBootstrap } from "./auth-bootstrap";
import { NetworkToast } from "../components/network-toast";
import { SocketProvider } from "./socket-provider";
import { useRealtimeSync } from "../hooks/use-realtime-sync";

/** Invisible: subscribes to server change events and refreshes what is open. */
function RealtimeSync() {
  useRealtimeSync();
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
          <NetworkToast />
        </BrowserRouter>
      </SocketProvider>
    </QueryClientProvider>
  );
}
