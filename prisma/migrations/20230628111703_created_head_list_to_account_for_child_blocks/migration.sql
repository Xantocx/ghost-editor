/*
  Warnings:

  - You are about to drop the column `blockId` on the `Head` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[listId,lineId]` on the table `Head` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `headListId` to the `Block` table without a default value. This is not possible if the table is not empty.
  - Added the required column `listId` to the `Head` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_blockId_fkey";

-- DropIndex
DROP INDEX "Head_blockId_lineId_idx";

-- DropIndex
DROP INDEX "Head_blockId_lineId_key";

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "headListId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Head" DROP COLUMN "blockId",
ADD COLUMN     "listId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "HeadList" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,

    CONSTRAINT "HeadList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeadList_ownerId_key" ON "HeadList"("ownerId");

-- CreateIndex
CREATE INDEX "Head_listId_lineId_idx" ON "Head"("listId", "lineId");

-- CreateIndex
CREATE UNIQUE INDEX "Head_listId_lineId_key" ON "Head"("listId", "lineId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_headListId_fkey" FOREIGN KEY ("headListId") REFERENCES "HeadList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadList" ADD CONSTRAINT "HeadList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_listId_fkey" FOREIGN KEY ("listId") REFERENCES "HeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
