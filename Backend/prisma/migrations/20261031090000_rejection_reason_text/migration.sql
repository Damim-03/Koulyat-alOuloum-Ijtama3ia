-- Rejection reasons were VARCHAR(191). An administrator's reason written in a
-- sentence or two is longer, and the reasons the platform writes itself when it
-- releases a team's other requests name the topic and the members — a topic
-- title alone may take 191 — so accepting a team could fail on the length of
-- a reason. TEXT keeps every existing value as it is.

-- AlterTable
ALTER TABLE `GraduationTopic` MODIFY `rejectionReason` TEXT NULL;

-- AlterTable
ALTER TABLE `TopicApplication` MODIFY `rejectionReason` TEXT NULL;

-- AlterTable
ALTER TABLE `GroupRequest` MODIFY `rejectionReason` TEXT NULL;
