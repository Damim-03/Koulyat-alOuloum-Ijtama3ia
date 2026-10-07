-- Changing a handed-out password is optional after all: students may keep
-- their birth date and change it from their account page whenever they like.
-- The per-account lock and refresh-token rotation stay.
ALTER TABLE `User` DROP COLUMN `mustChangePassword`;
