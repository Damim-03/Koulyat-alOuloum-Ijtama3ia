-- The students' deadline to choose their topics, per academic year: no team
-- request on the year's topics before it opens or after it closes, and none
-- withdrawn after it closes (core/academic/proposal-window).
ALTER TABLE `AcademicYear` ADD COLUMN `selectionOpenAt` DATETIME(3) NULL,
    ADD COLUMN `selectionCloseAt` DATETIME(3) NULL;
