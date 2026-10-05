-- Images that rotate behind the home page title, chosen and ordered by the
-- administration. Read anonymously by the landing page, so only active rows
-- are ever served there. Purely additive.
CREATE TABLE `HomeSlide` (
    `id` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(2048) NOT NULL,
    `caption` VARCHAR(160) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HomeSlide_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
