-- The number of students per topic, by level: `{ "licence": { "n": 3, "mode": "max" }, ... }`,
-- "exact" or "max"; a level left out is free (core/academic/team-size).
ALTER TABLE `AcademicYear` ADD COLUMN `teamSizes` JSON NULL;

-- A number set for the whole year becomes that number, exactly, for each level.
UPDATE `AcademicYear`
SET `teamSizes` = JSON_OBJECT(
    'licence', JSON_OBJECT('n', `teamSize`, 'mode', 'exact'),
    'master', JSON_OBJECT('n', `teamSize`, 'mode', 'exact'),
    'doctorate', JSON_OBJECT('n', `teamSize`, 'mode', 'exact'))
WHERE `teamSize` IS NOT NULL;

ALTER TABLE `AcademicYear` DROP COLUMN `teamSize`;
