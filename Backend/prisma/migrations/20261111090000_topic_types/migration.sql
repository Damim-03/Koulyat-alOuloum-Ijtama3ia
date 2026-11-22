-- Topics as the official list prints them: each with its type (an axis the
-- administration sets per department — AI, cybersecurity…, a code and a
-- colour), a co-supervisor from the platform, and a short description. And
-- the Latin names of the faculty and department, for the list in English or
-- French.

-- AlterTable
ALTER TABLE `Faculty` ADD COLUMN `nameLatin` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Department` ADD COLUMN `nameLatin` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `GraduationTopic` ADD COLUMN `coSupervisorId` VARCHAR(191) NULL,
    ADD COLUMN `summary` VARCHAR(300) NULL,
    ADD COLUMN `typeId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TopicType` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `code` VARCHAR(8) NOT NULL,
    `color` VARCHAR(9) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TopicType_departmentId_code_key`(`departmentId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GraduationTopic` ADD CONSTRAINT `GraduationTopic_coSupervisorId_fkey` FOREIGN KEY (`coSupervisorId`) REFERENCES `Professor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GraduationTopic` ADD CONSTRAINT `GraduationTopic_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `TopicType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TopicType` ADD CONSTRAINT `TopicType_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
