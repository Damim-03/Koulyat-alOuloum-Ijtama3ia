-- Sign-in hardening.
--
-- 1. Students whose password was handed to them (often their birth date) must
--    choose their own at the next sign-in. Accounts that never signed in are
--    still on the handed-out password, so they start flagged.
ALTER TABLE `User` ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;
UPDATE `User` SET `mustChangePassword` = true WHERE `role` = 'student' AND `lastLoginAt` IS NULL;

-- 2. One row per sign-in, holding the id of its current refresh token so a
--    replayed (stolen) older token is detected.
CREATE TABLE `AuthSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `refreshJti` VARCHAR(64) NOT NULL,
    `prevJti` VARCHAR(64) NULL,
    `rotatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuthSession_userId_idx`(`userId`),
    INDEX `AuthSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Failed sign-ins per identifier (not per IP), with an escalating lock.
CREATE TABLE `LoginThrottle` (
    `key` VARCHAR(191) NOT NULL,
    `failures` INTEGER NOT NULL DEFAULT 0,
    `lockCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastFailureAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginThrottle_lastFailureAt_idx`(`lastFailureAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
