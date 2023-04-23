-- CreateTable
CREATE TABLE "DBPost" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER,

    CONSTRAINT "DBPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DBSnapshot" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "DBSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DBPost" ADD CONSTRAINT "DBPost_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DBSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
