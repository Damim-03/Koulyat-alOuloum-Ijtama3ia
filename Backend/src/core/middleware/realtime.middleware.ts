import { Request, Response, NextFunction } from "express";
import { broadcastChange } from "../realtime/realtime";

/**
 * Announces every successful mutation so connected clients can refresh.
 *
 * Sitting on the router rather than inside each service means a new endpoint
 * is realtime the day it is written — there is no per-mutation wiring to
 * forget. The resource is read from the path, which the REST routes already
 * name consistently (/admin/topics/:id/approve → "topics").
 */

/** Paths whose changes ripple into the dashboard counters. */
const AFFECTS_DASHBOARD = new Set([
  "topics",
  "applications",
  "group-requests",
  "projects",
  "defenses",
  "students",
  "professors",
  "users",
]);

/** First path segment after the module prefix, e.g. "/admin/topics/x" → topics */
function resourceOf(req: Request): string | null {
  // req.baseUrl is the mount point ("/api/admin"); req.path is the rest.
  const segments = req.path.split("/").filter(Boolean);
  return segments[0] ?? null;
}

export function realtimeBroadcast(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "GET" || req.method === "OPTIONS") return next();

  res.on("finish", () => {
    if (res.statusCode >= 400) return; // failed writes change nothing

    const resource = resourceOf(req);
    if (!resource) return;

    const action =
      req.method === "POST"
        ? "created"
        : req.method === "DELETE"
          ? "deleted"
          : "updated";

    // Express types params as string | string[]; only a plain id is useful.
    const id = req.params?.id;
    broadcastChange(resource, action, typeof id === "string" ? id : undefined);

    // Counters on the overview pages derive from several resources at once.
    if (AFFECTS_DASHBOARD.has(resource)) broadcastChange("dashboard", "updated");
  });

  next();
}
