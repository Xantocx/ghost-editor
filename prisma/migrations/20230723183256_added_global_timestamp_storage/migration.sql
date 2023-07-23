-- CreateTable
CREATE TABLE "Timestamp" (
    "id" SERIAL NOT NULL,
    "timestamp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Timestamp_pkey" PRIMARY KEY ("id")
);
