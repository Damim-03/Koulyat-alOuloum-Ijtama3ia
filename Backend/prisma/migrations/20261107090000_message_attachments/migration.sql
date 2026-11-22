-- Files sent with messages (modules/messages/attachments): kept in a private
-- folder and opened only by the sender and the recipients of their message.
-- `messageId` is empty between the upload and the sending; an upload never
-- sent, or whose message is gone, is swept after a day.

-- CreateTable
CREATE TABLE `MessageAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NULL,
    `uploaderId` VARCHAR(191) NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `storedName` VARCHAR(64) NOT NULL,
    `mimeType` VARCHAR(127) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MessageAttachment_storedName_key`(`storedName`),
    INDEX `MessageAttachment_messageId_createdAt_idx`(`messageId`, `createdAt`),
    INDEX `MessageAttachment_uploaderId_messageId_idx`(`uploaderId`, `messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MessageAttachment` ADD CONSTRAINT `MessageAttachment_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageAttachment` ADD CONSTRAINT `MessageAttachment_uploaderId_fkey` FOREIGN KEY (`uploaderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

