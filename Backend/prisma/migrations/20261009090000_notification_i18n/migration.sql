-- A notification in the three languages, so whoever reads it does so in the
-- language of their interface — even when someone else's action wrote it.
-- Rows written before this column stay as they were (NULL): their Arabic
-- title and message are still shown.
ALTER TABLE `Notification` ADD COLUMN `i18n` JSON NULL;
