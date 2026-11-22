-- A message's text may be changed by its sender shortly after sending
-- (editedAt), and the administration may withdraw what it sent, for
-- everyone (deletedAt): the text and files go, the place stays.

-- AlterTable
ALTER TABLE `Message` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `editedAt` DATETIME(3) NULL;

