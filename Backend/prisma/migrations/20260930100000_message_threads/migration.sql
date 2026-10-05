-- Conversations and inbox removal for messages.
--
-- `threadId` groups a first message with every reply to it; `replyToId` names
-- the message a reply answers. Both are NULL on existing rows, which are
-- first messages of their own conversation.
--
-- `deletedAt` hides a message from one recipient's inbox without deleting the
-- recipient row, so the sender's recipient count and read receipts stay true.
-- All additive and nullable.
ALTER TABLE `Message`
  ADD COLUMN `threadId` VARCHAR(191) NULL,
  ADD COLUMN `replyToId` VARCHAR(191) NULL;

CREATE INDEX `Message_threadId_idx` ON `Message`(`threadId`);

ALTER TABLE `MessageRecipient`
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `MessageRecipient_userId_deletedAt_idx` ON `MessageRecipient`(`userId`, `deletedAt`);
