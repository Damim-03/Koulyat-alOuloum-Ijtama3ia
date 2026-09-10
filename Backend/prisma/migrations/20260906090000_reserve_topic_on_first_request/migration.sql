-- Reserves a topic for the first team that asks for it, at the database level.
--
-- Until now two requests arriving together both passed the application's
-- "is it taken?" read and both were written. `activeTopicId` carries the
-- topic while a request is live and NULL when it is not, so the unique index
-- refuses the second live request outright. NULLs are not compared, so a
-- rejected request releases the topic.
ALTER TABLE `GroupRequest` ADD COLUMN `activeTopicId` VARCHAR(191) NULL;

-- Backfill: every request that is currently live reserves its topic.
UPDATE `GroupRequest` SET `activeTopicId` = `topicId`
  WHERE `status` IN ('pending', 'accepted');

-- If this index fails to create, two live requests already share a topic.
-- Resolve them (accept one, reject the other) and run the migration again --
-- do not drop the index, it is the guarantee.
CREATE UNIQUE INDEX `GroupRequest_activeTopicId_key` ON `GroupRequest`(`activeTopicId`);
