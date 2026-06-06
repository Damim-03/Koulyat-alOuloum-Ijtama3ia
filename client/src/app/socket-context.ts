import { createContext, useContext } from "react";
import type { AppSocket } from "../lib/socket/socket";

export const SocketContext = createContext<AppSocket | null>(null);

// Returns the socket instance (created by SocketProvider). Use socket.connected
// if you need to know whether it's currently connected.
export function useSocket() {
  return useContext(SocketContext);
}