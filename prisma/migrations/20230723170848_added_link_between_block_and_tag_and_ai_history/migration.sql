/*
  Warnings:

  - You are about to drop the column `blockId` on the `Tag` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tagBlockId]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sourceBlockId` to the `Tag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tagBlockId` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_blockId_fkey";

-- DropIndex
DROP INDEX "Tag_blockId_idx";

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "aiVersionHistory" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "blockId",
ADD COLUMN     "sourceBlockId" INTEGER NOT NULL,
ADD COLUMN     "tagBlockId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tagBlockId_key" ON "Tag"("tagBlockId");

-- CreateIndex
CREATE INDEX "Tag_sourceBlockId_idx" ON "Tag"("sourceBlockId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tagBlockId_fkey" FOREIGN KEY ("tagBlockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_sourceBlockId_fkey" FOREIGN KEY ("sourceBlockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
