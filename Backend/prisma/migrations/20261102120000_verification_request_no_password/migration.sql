-- A student's first password now applies the moment they choose it (the first
-- stage of activation); the photos only verify the account. No request carries
-- a password waiting for approval any more.

-- AlterTable
ALTER TABLE `ActivationRequest` DROP COLUMN `passwordHash`;
