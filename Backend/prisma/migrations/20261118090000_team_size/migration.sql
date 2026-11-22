-- The number of students in every topic of an academic year, set by the
-- administration: one number, or none (core/academic/team-size).
ALTER TABLE `AcademicYear` ADD COLUMN `teamSize` INTEGER NULL;
