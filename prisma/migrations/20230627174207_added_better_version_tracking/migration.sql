/*
  Warnings:

  - You are about to drop the column `trackedTimestamps` on the `Version` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Version" DROP COLUMN "trackedTimestamps";

-- CreateTable
CREATE TABLE "TrackedVersion" (
    "id" SERIAL NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "lineId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,

    CONSTRAINT "TrackedVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedVersion_timestamp_key" ON "TrackedVersion"("timestamp");

-- AddForeignKey
ALTER TABLE "TrackedVersion" ADD CONSTRAINT "TrackedVersion_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedVersion" ADD CONSTRAINT "TrackedVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
