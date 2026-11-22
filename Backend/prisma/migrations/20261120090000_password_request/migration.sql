-- «نسيت كلمة المرور» لطالبٍ بلا بريدٍ مؤكَّد (modules/password-request): رقم
-- التسجيل وصورة البطاقة إلى الإدارة، فتكتب كلمة مرورٍ مؤقّتة يقرؤها المتصفّح
-- الذي أرسل الطلب وحده — ثمّ يُحذف الطلب.

-- CreateTable
CREATE TABLE `PasswordRequest` (
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `cardFile` VARCHAR(64) NULL,
    `qrNumber` VARCHAR(32) NULL,
    `sealedPassword` VARCHAR(512) NULL,
    `rejectionReason` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PasswordRequest_tokenHash_key`(`tokenHash`),
    INDEX `PasswordRequest_status_sentAt_idx`(`status`, `sentAt`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordRequest` ADD CONSTRAINT `PasswordRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
