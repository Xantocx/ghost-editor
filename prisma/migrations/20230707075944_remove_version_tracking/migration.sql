/*
  Warnings:

  - You are about to drop the `TrackedVersion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TrackedVersion" DROP CONSTRAINT "TrackedVersion_lineId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedVersion" DROP CONSTRAINT "TrackedVersion_versionId_fkey";

-- DropTable
DROP TABLE "TrackedVersion";
