-- «طلب الموافقة على الإشراف»: ورقةٌ رسمية تُثبت أنّ الموضوع صار لمجموعةٍ
-- بعينها، يوقّعها المشرف ويتحقّق منها أيٌّ كان بمسح رمز الاستجابة.
--
-- وأسماء الجداول بحالة أحرفها الصحيحة — انظر `add_cover_images`: الاسم
-- حسّاسٌ لحالته على لينكس، فهجرةٌ بأحرفٍ صغيرة تمرّ على ويندوز وتمنع لينكس.
--
-- و`snapshot` لقطةُ ما وُقّع عليه لا مرآةٌ للحاضر: لو خرج طالبٌ من المجموعة
-- بعد التوقيع لَقال ماسحُ الـQR إنّ الورقة تخصّ طلبةً آخرين — وهي لا تخصّهم.
--
-- و`topicId` ليس فريداً: الوثيقة تُلغى ثمّ تُصدَر غيرها، فيبقى للموضوع
-- تاريخٌ من الأوراق. و«واحدةٌ فعّالة لكل موضوع» شرطٌ تحرسه الخدمة، إذ لا
-- يعبّر عنه قيدٌ فريدٌ بسيط في MariaDB.

-- CreateTable
CREATE TABLE `SupervisionDocument` (
    `id` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(191) NOT NULL,
    `verificationToken` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `status` ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `SupervisionDocument_documentNumber_key`(`documentNumber`),
    UNIQUE INDEX `SupervisionDocument_verificationToken_key`(`verificationToken`),
    INDEX `SupervisionDocument_topicId_idx`(`topicId`),
    INDEX `SupervisionDocument_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SupervisionDocument` ADD CONSTRAINT `SupervisionDocument_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `GraduationTopic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
