-- AlterTable
ALTER TABLE "Filiere" ADD COLUMN     "domainId" TEXT;

-- AddForeignKey
ALTER TABLE "Filiere" ADD CONSTRAINT "Filiere_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
