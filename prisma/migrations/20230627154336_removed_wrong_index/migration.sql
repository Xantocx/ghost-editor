-- DropIndex
DROP INDEX "Version_timestamp_lineId_idx";

-- CreateIndex
CREATE INDEX "Version_timestamp_idx" ON "Version"("timestamp" ASC);
