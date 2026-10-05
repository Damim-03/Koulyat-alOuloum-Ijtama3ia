-- Closing an academic year keeps it: `archivedAt` marks the year closed, and
-- `AcademicYearArchive` holds its frozen record (figures and every row) so it
-- can be read back exactly as it stood. Additive; no existing year is closed.
ALTER TABLE `AcademicYear` ADD COLUMN `archivedAt` DATETIME(3) NULL;

CREATE TABLE `AcademicYearArchive` (
    `id` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `summary` JSON NOT NULL,
    `note` TEXT NULL,
    `archivedById` VARCHAR(191) NULL,
    `archivedByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AcademicYearArchive_academicYearId_key`(`academicYearId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AcademicYearArchive` ADD CONSTRAINT `AcademicYearArchive_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
