-- Per-session sign-out. Additive: no existing table or column is touched, and
-- tokens issued before this migration simply carry no `sid` (they remain valid
-- until they expire, and are still covered by the account-wide tokenVersion).
CREATE TABLE `RevokedSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RevokedSession_userId_idx`(`userId`),
    INDEX `RevokedSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
