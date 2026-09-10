/**
 * The process entry point: takes the app from `app.ts` and runs it.
 *
 * Everything here is about *running* — the HTTP server, the Socket.IO
 * attachment, the port. None of it belongs in `app.ts`, because a test that
 * wants to send a request through the API has no use for a bound port or a
 * websocket server, and used to get both simply by importing the app.
 */
import "dotenv/config";
import http from "http";
import { Server } from "socket.io";

import app from "./app";
import { config } from "./core/config/app.config";
import { setRealtimeServer } from "./core/realtime/realtime";
import { installSocketSecurity } from "./core/realtime/socket-auth";

const server = http.createServer(app);

/* ============================================================
   SOCKET.IO — same origin policy as the HTTP API
   ============================================================ */
export const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGINS,
    credentials: true,
  },
  maxHttpBufferSize: 1e6, // 1 MB: realtime payloads are tiny invalidations
});

// The modules reach realtime through this injection rather than importing the
// server, so nothing in the domain layer depends on transport. In a test the
// injection simply never happens, and every emit helper is a no-op.
setRealtimeServer(io);

// Authenticates the handshake and assigns rooms server-side.
installSocketSecurity(io);

const PORT = config.PORT;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.NODE_ENV}`);
  console.log("Socket.IO ready (authenticated handshake required)");
});

export { server };
