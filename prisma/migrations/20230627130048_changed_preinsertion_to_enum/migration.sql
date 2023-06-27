/*
  Warnings:

  - You are about to drop the column `isPreInsertion` on the `Version` table. All the data in the column will be lost.
  - Added the required column `versionType` to the `Version` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VersionType" AS ENUM ('PRE_INSERTION', 'INSERTION', 'CHANGE', 'DELETION');

-- AlterTable
ALTER TABLE "Version" DROP COLUMN "isPreInsertion",
ADD COLUMN     "versionType" "VersionType" NOT NULL;
