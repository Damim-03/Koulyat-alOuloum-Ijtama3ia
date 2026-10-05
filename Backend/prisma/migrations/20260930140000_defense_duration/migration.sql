-- How long a defence lasts, so room and jury clashes can be told apart from
-- sessions that merely follow each other. Existing rows take the usual hour.
ALTER TABLE `Defense` ADD COLUMN `durationMinutes` INTEGER NOT NULL DEFAULT 60;
