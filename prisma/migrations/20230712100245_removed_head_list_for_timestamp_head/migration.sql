/*
  Warnings:

  - You are about to drop the column `headListId` on the `Block` table. All the data in the column will be lost.
  - You are about to drop the `HeadList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_VersionsInHeadLists` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `headId` to the `Block` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_headListId_fkey";

-- DropForeignKey
ALTER TABLE "HeadList" DROP CONSTRAINT "HeadList_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "_VersionsInHeadLists" DROP CONSTRAINT "_VersionsInHeadLists_A_fkey";

-- DropForeignKey
ALTER TABLE "_VersionsInHeadLists" DROP CONSTRAINT "_VersionsInHeadLists_B_fkey";

-- AlterTable
ALTER TABLE "Block" DROP COLUMN "headListId",
ADD COLUMN     "headId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "HeadList";

-- DropTable
DROP TABLE "_VersionsInHeadLists";

-- CreateTable
CREATE TABLE "Head" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER,
    "timestamp" INTEGER NOT NULL,

    CONSTRAINT "Head_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Head_ownerId_key" ON "Head"("ownerId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Head"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
