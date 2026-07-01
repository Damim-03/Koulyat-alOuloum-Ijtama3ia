-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "grade" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
