/*
  Warnings:

  - You are about to drop the column `headListId` on the `Block` table. All the data in the column will be lost.
  - You are about to drop the column `isRoot` on the `Block` table. All the data in the column will be lost.
  - You are about to drop the column `listId` on the `Head` table. All the data in the column will be lost.
  - You are about to drop the column `lineType` on the `Line` table. All the data in the column will be lost.
  - You are about to drop the column `versionType` on the `Version` table. All the data in the column will be lost.
  - You are about to drop the `HeadList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_LinesInBlocks` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `type` to the `Block` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerBlockId` to the `Head` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Line` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Version` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('ROOT', 'INLINE', 'CLONE');

-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_headListId_fkey";

-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_lineId_fkey";

-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_listId_fkey";

-- DropForeignKey
ALTER TABLE "HeadList" DROP CONSTRAINT "HeadList_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "_LinesInBlocks" DROP CONSTRAINT "_LinesInBlocks_A_fkey";

-- DropForeignKey
ALTER TABLE "_LinesInBlocks" DROP CONSTRAINT "_LinesInBlocks_B_fkey";

-- DropIndex
DROP INDEX "Head_listId_lineId_idx";

-- DropIndex
DROP INDEX "Head_listId_lineId_key";

-- AlterTable
ALTER TABLE "Block" DROP COLUMN "headListId",
DROP COLUMN "isRoot",
ADD COLUMN     "type" "BlockType" NOT NULL;

-- AlterTable
ALTER TABLE "Head" DROP COLUMN "listId",
ADD COLUMN     "ownerBlockId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Line" DROP COLUMN "lineType",
ADD COLUMN     "type" "LineType" NOT NULL;

-- AlterTable
ALTER TABLE "Version" DROP COLUMN "versionType",
ADD COLUMN     "type" "VersionType" NOT NULL;

-- DropTable
DROP TABLE "HeadList";

-- DropTable
DROP TABLE "_LinesInBlocks";

-- CreateTable
CREATE TABLE "_HeadsOfBlocks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_HeadsOfBlocks_AB_unique" ON "_HeadsOfBlocks"("A", "B");

-- CreateIndex
CREATE INDEX "_HeadsOfBlocks_B_index" ON "_HeadsOfBlocks"("B");

-- CreateIndex
CREATE INDEX "Head_lineId_idx" ON "Head"("lineId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_ownerBlockId_fkey" FOREIGN KEY ("ownerBlockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HeadsOfBlocks" ADD CONSTRAINT "_HeadsOfBlocks_A_fkey" FOREIGN KEY ("A") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HeadsOfBlocks" ADD CONSTRAINT "_HeadsOfBlocks_B_fkey" FOREIGN KEY ("B") REFERENCES "Head"("id") ON DELETE CASCADE ON UPDATE CASCADE;
