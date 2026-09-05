import { z } from "zod";

/**
 * ============================================================
 * ENTITY ID
 * ============================================================
 *
 * Every id in the API was validated with `z.string().uuid()`. The Prisma
 * models do default to `uuid()`, but a default only applies when no id is
 * supplied — and the seeder supplies its own readable ids:
 *
 *   professor  prf-0001
 *   student    std-0001, std-0002, std-0003
 *   user       usr-admin-0001, usr-prof-0001, usr-stud-0001
 *
 * So every request naming a seeded professor or student was rejected before
 * it reached the service, with "Invalid UUID". Assigning a topic to seeded
 * students could not succeed at all.
 *
 * This accepts either shape while still being a real constraint: bounded
 * length, and a character class with no whitespace, quotes, slashes or dots,
 * so nothing path-like or injection-shaped gets through to the query layer.
 */
export const entityId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

/** Same rule, for a list of ids. */
export const entityIdArray = z.array(entityId);
