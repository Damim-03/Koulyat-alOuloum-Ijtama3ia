-- The most topics a professor sends for the year: every topic of his but the rejected;
-- NULL is no limit (core/academic/topic-quota).
ALTER TABLE `AcademicYear` ADD COLUMN `maxTopicsPerProfessor` INTEGER NULL;
