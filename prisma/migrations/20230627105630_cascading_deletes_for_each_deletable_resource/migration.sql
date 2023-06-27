-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_fileId_fkey";

-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_blockId_fkey";

-- DropForeignKey
ALTER TABLE "Line" DROP CONSTRAINT "Line_fileId_fkey";

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_blockId_fkey";

-- DropForeignKey
ALTER TABLE "Version" DROP CONSTRAINT "Version_lineId_fkey";

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
