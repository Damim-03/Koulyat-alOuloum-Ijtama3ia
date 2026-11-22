-- Remote activation of student accounts (modules/activation): the photos of
-- the card and of the student holding it, and the password they chose —
-- applied only when an administrator accepts the request.

-- CreateTable
CREATE TABLE `ActivationRequest` (
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'rejected') NOT NULL DEFAULT 'pending',
    `passwordHash` VARCHAR(255) NULL,
    `cardFile` VARCHAR(64) NULL,
    `selfieFile` VARCHAR(64) NULL,
    `qrNumber` VARCHAR(32) NULL,
    `rejectionReason` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ActivationRequest_status_sentAt_idx`(`status`, `sentAt`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivationRequest` ADD CONSTRAINT `ActivationRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
