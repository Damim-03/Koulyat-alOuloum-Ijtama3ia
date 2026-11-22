-- Several teams may now request the same topic at once, up to its cap.
--
-- `activeTopicId` and its unique index allowed one live request per topic:
-- the first team reserved it and every other team waited for the decision.
-- Now up to `maxRequests` teams are pending together; the administration
-- picks one and the others are released to choose another topic.
--
-- `countsAgainstCap` measured the old cap — attempts over the topic's life.
-- The cap now counts pending requests only, kept on the topic itself so that
-- "still open for requests" can be asked in a single query.

DROP INDEX `GroupRequest_activeTopicId_key` ON `GroupRequest`;
ALTER TABLE `GroupRequest` DROP COLUMN `activeTopicId`;
ALTER TABLE `GroupRequest` DROP COLUMN `countsAgainstCap`;

ALTER TABLE `GraduationTopic` ADD COLUMN `pendingRequestCount` INTEGER NOT NULL DEFAULT 0;

UPDATE `GraduationTopic` t
  SET t.`pendingRequestCount` = (
    SELECT COUNT(*) FROM `GroupRequest` r
    WHERE r.`topicId` = t.`id` AND r.`status` = 'pending'
  );
