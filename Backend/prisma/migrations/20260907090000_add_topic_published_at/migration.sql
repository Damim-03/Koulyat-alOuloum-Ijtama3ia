-- Keeps "was this topic published?" from being erased by occupancy.
--
-- `GraduationTopic.status` holds two different things in one field: the
-- administration's decision (pending -> approved -> open, or rejected /
-- archived) and the fact that a group has formed (`full`). Writing `full`
-- over `open` destroys the decision, so no path out of `full` can know where
-- the topic came back to. They guessed, and they guessed differently:
-- rejecting the request returned it to `open`, dissolving the group returned
-- it to `approved` -- the same situation reached by two doors, two answers.
--
-- This column carries that one bit across `full` and `archived`. Nothing
-- reads it yet; it is added first so the code that recomputes `status` has
-- somewhere truthful to read from.
ALTER TABLE `GraduationTopic` ADD COLUMN `publishedAt` DATETIME(3) NULL;

-- Backfill: a topic sitting at `open` right now is published by definition.
-- `updatedAt` is the closest honest timestamp we have for when that happened.
UPDATE `GraduationTopic` SET `publishedAt` = `updatedAt` WHERE `status` = 'open';

-- Deliberately NOT backfilled: `full` and `archived` rows. Whether they were
-- published before they got there is exactly the information the old schema
-- threw away, and inventing it would be worse than admitting it is gone.
-- They stay NULL, which means they return to `approved` and must be
-- published again on purpose -- the safe direction, and the one
-- `unarchiveTopicService` already documents.
