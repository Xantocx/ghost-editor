-- DropIndex
DROP INDEX "Line_order_idx";

-- DropIndex
DROP INDEX "Version_timestamp_idx";

-- CreateIndex
CREATE INDEX "Block_fileId_idx" ON "Block"("fileId");

-- CreateIndex
CREATE INDEX "Head_blockId_lineId_idx" ON "Head"("blockId", "lineId");

-- CreateIndex
CREATE INDEX "Line_order_fileId_idx" ON "Line"("order" ASC, "fileId");

-- CreateIndex
CREATE INDEX "Tag_blockId_idx" ON "Tag"("blockId");

-- CreateIndex
CREATE INDEX "Version_timestamp_lineId_idx" ON "Version"("timestamp" ASC, "lineId");
