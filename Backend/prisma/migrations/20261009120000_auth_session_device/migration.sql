-- The device each session was opened from, for the account's list of sessions.
ALTER TABLE `AuthSession`
    ADD COLUMN `userAgent` VARCHAR(512) NULL,
    ADD COLUMN `ip` VARCHAR(64) NULL;
