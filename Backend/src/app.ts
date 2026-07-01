import "dotenv/config";
import express, { Request, Response } from "express";
import http from "http";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { config } from "./core/config/app.config";
import { errorHandler } from "./core/middleware/errorHandler.middleware";
import { asyncHandler } from "./core/middleware/asyncHandler.middleware";
import { HTTPSTATUS } from "./core/config/http/http.config";
import mainRoute from "./routes/mainRoutes";

//
// ======================================================
// APP
// ======================================================
//

const app = express();

//
// ======================================================
// HTTP SERVER
// ======================================================
//

const server = http.createServer(app);

//
// ======================================================
// SOCKET.IO
// ======================================================
//

export const io = new Server(server, {
  cors: {
    origin: [
      config.FRONTEND_ORIGIN,
      "http://localhost:3000",
      "http://localhost:8081",
      "http://localhost:19006",
    ],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  //
  // Join personal room
  //

  socket.on("join-room", (userId: string) => {
    socket.join(userId);
  });

  //
  // Disconnect
  //

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

//
// ======================================================
// SECURITY
// ======================================================
//

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);
//
// ======================================================
// RATE LIMITER
// ======================================================
//

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests from this IP, please try again later.",
  }),
);

//
// ======================================================
// CORS
// ======================================================
//

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
      ];

      //
      // Allow mobile apps / Postman
      //

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },

    credentials: true,
  }),
);

//
// ======================================================
// BODY PARSER
// ======================================================
//

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

//
// ======================================================
// COOKIES
// ======================================================
//

app.use(cookieParser());

//
// ======================================================
// COMPRESSION
// ======================================================
//

app.use(compression());

//
// ======================================================
// LOGGER
// ======================================================
//

app.use(morgan("dev"));

//
// ======================================================
// UPLOADS
// ======================================================
//

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

//
// ======================================================
// HEALTH CHECK
// ======================================================
//

app.get(
  "/api/health",
  asyncHandler(async (_: Request, res: Response) => {
    return res.status(HTTPSTATUS.OK).json({
      success: true,
      message: "Server is running 🚀",
    });
  }),
);

//
// ======================================================
// API ROUTES
// ======================================================
//

app.use("/api", mainRoute);

//
// ======================================================
// FRONTEND SERVING (PRODUCTION)
// ======================================================
//

if (config.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../../client/dist");

  app.use(express.static(frontendPath));

  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

//
// ======================================================
// ERROR HANDLER
// ======================================================
//

app.use(errorHandler);

//
// ======================================================
// START SERVER
// ======================================================
//

const PORT = config.PORT;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${config.NODE_ENV}`);

  console.log("🔌 Socket.IO ready");
});
