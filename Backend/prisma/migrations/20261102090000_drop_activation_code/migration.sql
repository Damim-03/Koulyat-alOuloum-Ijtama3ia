-- The in-person activation code is gone: a student activates by sending photos
-- of the card and of their face, which an administrator reviews
-- (modules/activation/activation-request).

-- DropForeignKey
ALTER TABLE `ActivationCode` DROP FOREIGN KEY `ActivationCode_userId_fkey`;

-- DropTable
DROP TABLE `ActivationCode`;
