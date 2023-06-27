/*
  Warnings:

  - Added the required column `isPreInsertion` to the `Version` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "isPreInsertion" BOOLEAN NOT NULL;
