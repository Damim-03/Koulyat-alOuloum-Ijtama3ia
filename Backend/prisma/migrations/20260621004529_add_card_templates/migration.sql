-- CreateEnum
CREATE TYPE "CardRole" AS ENUM ('student', 'professor', 'admin');

-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL,
    "role" "CardRole" NOT NULL,
    "backgroundColor" TEXT NOT NULL DEFAULT '#26423D',
    "textColor" TEXT NOT NULL DEFAULT '#F5EDDA',
    "accentColor" TEXT NOT NULL DEFAULT '#C1965A',
    "logoUrl" TEXT,
    "backgroundUrl" TEXT,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardTemplate_role_key" ON "CardTemplate"("role");
