-- The topic proposal window of an academic year: professors propose new
-- topics for that year only between these two instants. Both NULL (every
-- existing year) means no window — proposals stay open as before.

-- AlterTable
ALTER TABLE `AcademicYear` ADD COLUMN `proposalsOpenAt` DATETIME(3) NULL,
    ADD COLUMN `proposalsCloseAt` DATETIME(3) NULL;
