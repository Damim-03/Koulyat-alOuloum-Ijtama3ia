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
import express, { NextFunction, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { config, isAllowedOrigin } from "./core/config/app.config";
import { errorHandler } from "./core/middleware/errorHandler.middleware";
import { asyncHandler } from "./core/middleware/asyncHandler.middleware";
import { HTTPSTATUS } from "./core/config/http/http.config";
import { globalLimiter } from "./core/middleware/rateLimit.middleware";
import mainRoute from "./routes/mainRoutes";
import { prisma } from "./core/prisma/client";
import { languageMiddleware, tr } from "./core/i18n";
import { NotFoundException } from "./core/utils/appErros";
import "./core/i18n/zod";

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

// Requests that arrive through a proxy while none is trusted all look as if
// they came from the proxy: one IP for everyone, so the per-IP limits lump
// every user together and the list of devices shows the proxy's address.
// Nothing fails visibly, so say it once, in the log the deployer reads.
if (config.IS_PRODUCTION && config.TRUST_PROXY_HOPS === 0) {
  let warned = false;
  app.use((req, _res, next) => {
    if (!warned && req.headers["x-forwarded-for"]) {
      warned = true;
      console.warn(
        "WARNING: requests arrive through a proxy (X-Forwarded-For is set) but " +
          "TRUST_PROXY_HOPS=0. Set TRUST_PROXY_HOPS=1 behind one Nginx, or every " +
          "user shares the proxy's IP address.",
      );
    }
    next();
  });
}

// The sign-in check (modules/auth/captcha) cannot run in a browser on a
// plain-HTTP page, so `auto` leaves it off there — and guessing is slowed by
// the locks alone. Say so once, where the deployer reads.
if (config.IS_PRODUCTION && !config.LOGIN_CAPTCHA) {
  console.warn(
    "WARNING: the sign-in check (LOGIN_CAPTCHA) is off. It turns on by itself when " +
      "FRONTEND_ORIGIN/CORS_ORIGINS are served over HTTPS; browsers cannot run it on plain HTTP.",
  );
}

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
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }),
);

/* ============================================================
   LANGUAGE — the interface's language, for every message the
   server writes during this request (core/i18n). Before the
   limiter, whose refusal is a message too.
   ============================================================ */
app.use(languageMiddleware);

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
  // (Express's router sets originalUrl before the first middleware runs.)
  return (req as Request).originalUrl.split("?")[0];
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

// An API path that does not exist: a JSON 404 like every other API error —
// not Express's own HTML page ("Cannot GET …"), which names the framework and
// replaces the app's security policy with a thinner one of its own (a ZAP
// scan's one finding).
app.use("/api", (_req: Request, _res: Response, next: NextFunction) =>
  next(new NotFoundException(tr("notFound.route"))),
);

/* ============================================================
   SPA (production single-origin deployments)
   ============================================================ */
if (config.IS_PRODUCTION) {
  const frontendPath = path.join(__dirname, "../../client/dist");
  const spaCsp = spaContentSecurityPolicy(path.join(frontendPath, "index.html"));

  app.use(
    express.static(frontendPath, {
      dotfiles: "deny",
      index: false,
      // A script started as a worker — the PDF reader's — runs under the
      // policy it is served with. The API's (`script-src 'none'`) would stop
      // it compiling the WebAssembly that decodes images in scanned PDFs.
      setHeaders: (res, filePath) => {
        if (/\.m?js$/.test(filePath)) res.setHeader("Content-Security-Policy", spaCsp);
      },
    }),
  );

  // Only non-API GETs fall through to the SPA shell; an unknown /api path
  // must return JSON 404, not index.html.
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
    // The API's own policy (`script-src 'none'`) would stop the app's scripts
    // from running at all; the shell gets the policy written for it.
    res.setHeader("Content-Security-Policy", spaCsp);
    // The account's activation photographs the card and the face with the
    // camera — this page's own, never a frame's. The rest stays off.
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
    );
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// Last, so it sees errors thrown by everything above it.
app.use(errorHandler);

/**
 * The SPA shell's policy. Its scripts come from this origin only, plus the
 * one inline script in `index.html` (the theme bootstrap), allowed by its
 * hash — read from the built file, so the policy follows whatever was built.
 * Everything else — fonts, images, the API, uploads, the socket — is this
 * origin too: the client bundles its fonts and default images, so the site
 * works on a university intranet with no internet access.
 */
function spaContentSecurityPolicy(indexPath: string): string {
  let hashes: string[] = [];
  try {
    const html = fs.readFileSync(indexPath, "utf8");
    hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(
      (m) => `'sha256-${crypto.createHash("sha256").update(m[1]!).digest("base64")}'`,
    );
  } catch {
    // No build yet: the fallback route will 404 on its own.
  }
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval': WebAssembly only — the face detector of the
    // activation photo (MediaPipe) — never eval() or new Function().
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`.trim(),
    // React writes style attributes.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // No `upgrade-insecure-requests`: a deployment on plain HTTP (an intranet
    // without TLS) would have every asset rewritten to an https:// that is
    // not there. HTTPS deployments already get HSTS.
  ].join("; ");
}

export default app;
