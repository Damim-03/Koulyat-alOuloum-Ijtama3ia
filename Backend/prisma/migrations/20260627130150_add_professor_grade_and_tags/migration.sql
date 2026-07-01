/*
  Warnings:

  - The `grade` column on the `Professor` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Professor" DROP COLUMN "grade",
ADD COLUMN     "grade" TEXT[] DEFAULT ARRAY[]::TEXT[];
