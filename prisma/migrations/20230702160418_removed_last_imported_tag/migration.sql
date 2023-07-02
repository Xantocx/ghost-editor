/*
  Warnings:

  - The values [LAST_IMPORTED] on the enum `VersionType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "VersionType_new" AS ENUM ('IMPORTED', 'PRE_INSERTION', 'INSERTION', 'CHANGE', 'DELETION');
ALTER TABLE "Version" ALTER COLUMN "type" TYPE "VersionType_new" USING ("type"::text::"VersionType_new");
ALTER TYPE "VersionType" RENAME TO "VersionType_old";
ALTER TYPE "VersionType_new" RENAME TO "VersionType";
DROP TYPE "VersionType_old";
COMMIT;
