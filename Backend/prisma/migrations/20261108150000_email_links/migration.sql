-- Email links (modules/auth/email-links): a password reset, and the proof
-- that an address belongs to its account. Only a hash of each token is kept.

-- AlterTable
ALTER TABLE `User` ADD COLUMN `verifiedEmail` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `EmailToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('reset', 'verify') NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailToken_userId_purpose_createdAt_idx`(`userId`, `purpose`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmailToken` ADD CONSTRAINT `EmailToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

