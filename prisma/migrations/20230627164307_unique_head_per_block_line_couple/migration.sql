/*
  Warnings:

  - A unique constraint covering the columns `[blockId,lineId]` on the table `Head` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Head_blockId_lineId_key" ON "Head"("blockId", "lineId");
