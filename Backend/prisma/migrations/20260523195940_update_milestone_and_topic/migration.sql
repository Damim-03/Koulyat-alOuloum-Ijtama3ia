/*
  Warnings:

  - Added the required column `order` to the `Milestone` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('pending', 'in_progress', 'completed', 'overdue');

-- AlterTable
ALTER TABLE "GraduationTopic" ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "description" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL,
ADD COLUMN     "status" "MilestoneStatus" NOT NULL DEFAULT 'pending';
