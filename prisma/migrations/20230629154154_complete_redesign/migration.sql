/*
  Warnings:

  - You are about to drop the `Head` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_HeadsOfBlocks` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `headListId` to the `Block` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_lineId_fkey";

-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_ownerBlockId_fkey";

-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_versionId_fkey";

-- DropForeignKey
ALTER TABLE "_HeadsOfBlocks" DROP CONSTRAINT "_HeadsOfBlocks_A_fkey";

-- DropForeignKey
ALTER TABLE "_HeadsOfBlocks" DROP CONSTRAINT "_HeadsOfBlocks_B_fkey";

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "headListId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Head";

-- DropTable
DROP TABLE "_HeadsOfBlocks";

-- CreateTable
CREATE TABLE "HeadList" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER,

    CONSTRAINT "HeadList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_VersionsInHeadLists" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "HeadList_ownerId_key" ON "HeadList"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "_VersionsInHeadLists_AB_unique" ON "_VersionsInHeadLists"("A", "B");

-- CreateIndex
CREATE INDEX "_VersionsInHeadLists_B_index" ON "_VersionsInHeadLists"("B");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_headListId_fkey" FOREIGN KEY ("headListId") REFERENCES "HeadList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadList" ADD CONSTRAINT "HeadList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VersionsInHeadLists" ADD CONSTRAINT "_VersionsInHeadLists_A_fkey" FOREIGN KEY ("A") REFERENCES "HeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VersionsInHeadLists" ADD CONSTRAINT "_VersionsInHeadLists_B_fkey" FOREIGN KEY ("B") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
