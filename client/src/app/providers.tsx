import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./query-client";
import { Toaster } from "../components/ui/toaster";
import { AuthBootstrap } from "./auth-bootstrap";
import { NetworkToast } from "../components/network-toast";

// SocketProvider gets added here in a later step.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap />
        {children}
        <Toaster />
        <NetworkToast />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
