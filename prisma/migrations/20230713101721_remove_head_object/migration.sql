/*
  Warnings:

  - You are about to drop the column `headId` on the `Block` table. All the data in the column will be lost.
  - You are about to drop the `Head` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `timestamp` to the `Block` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_headId_fkey";

-- DropForeignKey
ALTER TABLE "Head" DROP CONSTRAINT "Head_ownerId_fkey";

-- AlterTable
ALTER TABLE "Block" DROP COLUMN "headId",
ADD COLUMN     "timestamp" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Head";
