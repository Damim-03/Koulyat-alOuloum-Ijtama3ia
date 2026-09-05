-- Adds a per-user token generation counter.
-- Additive and non-destructive: existing rows default to 0, and tokens issued
-- before this migration also carry 0, so no session is broken by deploying it.
ALTER TABLE `User` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;
