/*
  Warnings:

  - You are about to drop the column `timestamp` on the `DBSnapshot` table. All the data in the column will be lost.
  - Added the required column `timestamp` to the `DBLineVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DBLineVersion" ADD COLUMN     "timestamp" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "DBSnapshot" DROP COLUMN "timestamp";
