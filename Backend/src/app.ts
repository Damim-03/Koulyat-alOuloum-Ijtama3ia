/**
 * The Express application — built here, listened to in `server.ts`.
 *
 * This file used to do both: it created the app, attached Socket.IO, and
 * called `listen()` at the bottom. Importing it for any reason therefore
 * started a server, which made the whole HTTP surface untestable: a test that
 * imported the app to send a request through it would instead try to bind the
 * real port and fail against the running dev server.
 *
 * Building and listening are separate concerns now. `app` is a plain object
 * any test can hand to supertest, which opens an ephemeral port of its own.
 */
import "dotenv/config";
import express, { Request, Response } from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { config } from "./core/config/app.config";
import { errorHandler } from "./core/middleware/errorHandler.middleware";
import { asyncHandler } from "./core/middleware/asyncHandler.middleware";
import { HTTPSTATUS } from "./core/config/http/http.config";
import { globalLimiter } from "./core/middleware/rateLimit.middleware";
import mainRoute from "./routes/mainRoutes";
import { prisma } from "./core/prisma/client";

export const app = express();

/* ============================================================
   TRUST PROXY
   Rate limiting and any IP-derived decision are only as honest as
   the hop count. `trust proxy: true` would let a client forge
   X-Forwarded-For and dodge every per-IP limit, so the number of
   real proxies in front of this process is configured explicitly
   (0 = directly exposed, 1 = one Nginx/Cloudflare layer, ...).
   ============================================================ */
app.set("trust proxy", config.TRUST_PROXY_HOPS);
app.disable("x-powered-by");

/* ============================================================
   SECURITY HEADERS
   ============================================================ */
app.use(
  helmet({
    // The SPA is served from its own origin and talks to this API over
    // CORS; the API itself returns JSON and static uploads.
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // No inline script is ever served by this origin. JSON and images
        // only — so the strictest sensible policy applies here.
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        upgradeInsecureRequests: config.IS_PRODUCTION ? [] : null,
      },
    },
    // Uploads are fetched by the SPA on a different origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Do not let this origin be embedded anywhere.
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: config.IS_PRODUCTION
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
  }),
);

app.use((_req, res, next) => {
  // Not covered by helmet: drop access to hardware APIs entirely.
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  next();
});

/* ============================================================
   CORS — explicit allowlist, never a wildcard with credentials
   ============================================================ */
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin and non-browser callers send no Origin header.
      if (!origin) return callback(null, true);
      if (config.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }),
);

/* ============================================================
   RATE LIMITING — global floor; auth routes add a stricter layer
   ============================================================ */
app.use(globalLimiter);

/* ============================================================
   BODY PARSING — bounded. Uploads go through multer, not these.
   ============================================================ */
app.use(express.json({ limit: config.JSON_BODY_LIMIT }));
app.use(
  express.urlencoded({
    extended: true,
    limit: config.URLENCODED_BODY_LIMIT,
  }),
);
app.use(cookieParser());
app.use(compression());

/* ============================================================
   LOGGING — never log credentials, tokens or cookies
   ============================================================ */
morgan.token("safe-url", (req) => {
  // Query strings can carry search terms and ids; keep the path only.
  const url = (req as Request).originalUrl ?? "";
  return url.split("?")[0];
});

app.use(
  morgan(
    config.IS_PRODUCTION
      ? ":remote-addr :method :safe-url :status :res[content-length] - :response-time ms"
      : "dev",
    {
      // سجلّ لكل طلب يُغرق مخرجات الاختبارات فيُخفي الفشل بينه.
      skip: (req) => req.method === "OPTIONS" || config.NODE_ENV === "test",
    },
  ),
);

/* ============================================================
   STATIC UPLOADS
   Served read-only, with no directory listing, no dotfiles, and
   Content-Disposition: attachment so a file that slips past the
   upload filter is downloaded rather than rendered in-origin.
   ============================================================ */
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    dotfiles: "deny",
    index: false,
    redirect: false,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

/* ============================================================
   HEALTH / READINESS
   Liveness stays anonymous and says nothing about the internals.
   ============================================================ */
app.get(
  "/api/health",
  asyncHandler(async (_: Request, res: Response) => {
    return res.status(HTTPSTATUS.OK).json({ status: "ok" });
  }),
);

app.get(
  "/api/ready",
  asyncHandler(async (_: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(HTTPSTATUS.OK).json({ status: "ready" });
    } catch {
      // No driver text, no DSN, no host names.
      return res.status(503).json({ status: "unavailable" });
    }
  }),
);

app.use("/api", mainRoute);

/* ============================================================
   SPA (production single-origin deployments)
   ============================================================ */
if (config.IS_PRODUCTION) {
  const frontendPath = path.join(__dirname, "../../client/dist");

  app.use(express.static(frontendPath, { dotfiles: "deny", index: false }));

  // Only non-API GETs fall through to the SPA shell; an unknown /api path
  // must return JSON 404, not index.html.
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// Last, so it sees errors thrown by everything above it.
app.use(errorHandler);

export default app;
