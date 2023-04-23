/*
  Warnings:

  - You are about to drop the `DBPost` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `endLine` to the `DBSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileId` to the `DBSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startLine` to the `DBSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timestamp` to the `DBSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uuid` to the `DBSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DBPost" DROP CONSTRAINT "DBPost_snapshotId_fkey";

-- AlterTable
ALTER TABLE "DBSnapshot" ADD COLUMN     "endLine" INTEGER NOT NULL,
ADD COLUMN     "fileId" INTEGER NOT NULL,
ADD COLUMN     "startLine" INTEGER NOT NULL,
ADD COLUMN     "timestamp" INTEGER NOT NULL,
ADD COLUMN     "uuid" TEXT NOT NULL;

-- DropTable
DROP TABLE "DBPost";

-- CreateTable
CREATE TABLE "DBTrackedFile" (
    "id" SERIAL NOT NULL,
    "filePath" TEXT,

    CONSTRAINT "DBTrackedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DBTrackedLine" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,

    CONSTRAINT "DBTrackedLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DBLineHistory" (
    "id" SERIAL NOT NULL,
    "lineId" INTEGER NOT NULL,

    CONSTRAINT "DBLineHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DBLineVersion" (
    "id" SERIAL NOT NULL,
    "isHead" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL,
    "previousId" INTEGER,
    "originId" INTEGER,
    "historyId" INTEGER NOT NULL,

    CONSTRAINT "DBLineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DBLineHistory_lineId_key" ON "DBLineHistory"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "DBLineVersion_previousId_key" ON "DBLineVersion"("previousId");

-- CreateIndex
CREATE UNIQUE INDEX "DBLineVersion_originId_key" ON "DBLineVersion"("originId");

-- CreateIndex
CREATE UNIQUE INDEX "DBLineVersion_historyId_key" ON "DBLineVersion"("historyId");

-- AddForeignKey
ALTER TABLE "DBTrackedLine" ADD CONSTRAINT "DBTrackedLine_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DBTrackedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DBLineHistory" ADD CONSTRAINT "DBLineHistory_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "DBTrackedLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DBLineVersion" ADD CONSTRAINT "DBLineVersion_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "DBLineVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DBLineVersion" ADD CONSTRAINT "DBLineVersion_originId_fkey" FOREIGN KEY ("originId") REFERENCES "DBLineVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DBLineVersion" ADD CONSTRAINT "DBLineVersion_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "DBLineHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DBSnapshot" ADD CONSTRAINT "DBSnapshot_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DBTrackedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
