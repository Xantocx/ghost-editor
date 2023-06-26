/*
  Warnings:

  - A unique constraint covering the columns `[filePath]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - Made the column `filePath` on table `File` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "File" ALTER COLUMN "filePath" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "File_filePath_key" ON "File"("filePath");
