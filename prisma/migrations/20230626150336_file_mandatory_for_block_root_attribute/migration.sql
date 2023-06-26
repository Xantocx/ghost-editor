/*
  Warnings:

  - Added the required column `isRoot` to the `Block` table without a default value. This is not possible if the table is not empty.
  - Made the column `fileId` on table `Block` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_fileId_fkey";

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "isRoot" BOOLEAN NOT NULL,
ALTER COLUMN "fileId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
