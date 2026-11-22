-- In-person activation of student accounts (modules/admin/activation-desk):
-- the one-time code a student is handed at the desk, after the card's photo
-- was matched with its holder. One per account, deleted once used.

-- CreateTable
CREATE TABLE `ActivationCode` (
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivationCode_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivationCode` ADD CONSTRAINT `ActivationCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
