-- A supervision document follows its topic and the sheet's text until it is
-- first printed; then they are fixed in it, and who printed it is kept
-- (modules/supervision).
ALTER TABLE `SupervisionDocument` ADD COLUMN `printedAt` DATETIME(3) NULL,
    ADD COLUMN `printedById` VARCHAR(191) NULL,
    ADD COLUMN `printedByRole` ENUM('admin', 'professor', 'student') NULL,
    ADD COLUMN `printedByName` VARCHAR(191) NULL,
    ADD COLUMN `printCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastPrintedAt` DATETIME(3) NULL;

-- Those issued before: whether they were printed is not known, so they are
-- taken as printed from their issue — their data and text stay as they are.
UPDATE `SupervisionDocument` SET `printedAt` = `createdAt` WHERE `printedAt` IS NULL;
