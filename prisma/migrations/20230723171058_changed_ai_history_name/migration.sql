/*
  Warnings:

  - You are about to drop the column `aiVersionHistory` on the `Block` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Block" DROP COLUMN "aiVersionHistory",
ADD COLUMN     "aiVersionNameHistory" TEXT NOT NULL DEFAULT '[]';
