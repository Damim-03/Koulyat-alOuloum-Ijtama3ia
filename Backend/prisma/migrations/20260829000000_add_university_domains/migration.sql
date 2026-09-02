-- CreateTable
CREATE TABLE `UniversityDomain` (
    `id` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UniversityDomain_domain_key`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the domain that was previously hard-coded in the validation schemas,
-- so existing professors stay valid the moment enforcement moves to this table.
INSERT INTO `UniversityDomain` (`id`, `domain`, `isDefault`, `createdAt`, `updatedAt`)
VALUES ('dom-univ-eloued-dz', 'univ-eloued.dz', true, NOW(3), NOW(3));
