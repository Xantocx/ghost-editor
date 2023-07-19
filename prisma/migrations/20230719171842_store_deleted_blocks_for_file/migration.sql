-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "fileIdAfterDeletion" INTEGER;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_fileIdAfterDeletion_fkey" FOREIGN KEY ("fileIdAfterDeletion") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
