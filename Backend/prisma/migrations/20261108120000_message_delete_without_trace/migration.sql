-- A message the administration deletes for everyone now leaves no trace:
-- the row itself is deleted, so the column that marked it is not needed.

-- AlterTable
ALTER TABLE `Message` DROP COLUMN `deletedAt`;
