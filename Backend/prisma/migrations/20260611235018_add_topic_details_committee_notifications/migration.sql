/*
  Warnings:

  - Added the required column `fileName` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DefenseStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('president', 'supervisor', 'examiner');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('application_accepted', 'application_rejected', 'topic_approved', 'topic_rejected', 'milestone_due', 'milestone_feedback', 'defense_scheduled', 'defense_graded', 'general');

-- AlterTable
ALTER TABLE "Defense" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "DefenseStatus" NOT NULL DEFAULT 'scheduled';

-- AlterTable
ALTER TABLE "GraduationTopic" ADD COLUMN     "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mimeType" TEXT;

-- AlterTable
ALTER TABLE "TopicApplication" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "DefenseCommitteeMember" (
    "id" TEXT NOT NULL,
    "defenseId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "role" "CommitteeRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefenseCommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DefenseCommitteeMember_defenseId_professorId_key" ON "DefenseCommitteeMember"("defenseId", "professorId");

-- AddForeignKey
ALTER TABLE "DefenseCommitteeMember" ADD CONSTRAINT "DefenseCommitteeMember_defenseId_fkey" FOREIGN KEY ("defenseId") REFERENCES "Defense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefenseCommitteeMember" ADD CONSTRAINT "DefenseCommitteeMember_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
