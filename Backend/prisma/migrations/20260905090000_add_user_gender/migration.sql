-- Records a user's gender so the interface can pick a default avatar when
-- no photo has been uploaded.
-- Additive and nullable: existing rows keep NULL, which the application
-- treats as "not stated" and answers with initials rather than a guess.
ALTER TABLE `User` ADD COLUMN `gender` ENUM('male', 'female') NULL;
