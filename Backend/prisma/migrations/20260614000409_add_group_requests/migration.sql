-- CreateEnum
CREATE TYPE "GroupRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "GroupRequest" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "leaderStudentId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" "GroupRequestStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRequestMember" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRequestMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupRequest_leaderStudentId_topicId_key" ON "GroupRequest"("leaderStudentId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRequestMember_requestId_studentId_key" ON "GroupRequestMember"("requestId", "studentId");

-- AddForeignKey
ALTER TABLE "GroupRequest" ADD CONSTRAINT "GroupRequest_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "GraduationTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRequest" ADD CONSTRAINT "GroupRequest_leaderStudentId_fkey" FOREIGN KEY ("leaderStudentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRequestMember" ADD CONSTRAINT "GroupRequestMember_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "GroupRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRequestMember" ADD CONSTRAINT "GroupRequestMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
