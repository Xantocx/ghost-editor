-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('ORIGINAL', 'INSERTED');

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "filePath" TEXT,
    "eol" TEXT NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Line" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "order" DOUBLE PRECISION NOT NULL,
    "lineType" "LineType" NOT NULL,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Version" (
    "id" SERIAL NOT NULL,
    "lineId" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "trackedTimestamps" INTEGER[],
    "isActive" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL,
    "originId" INTEGER,
    "sourceBlockId" INTEGER,

    CONSTRAINT "Version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" SERIAL NOT NULL,
    "blockId" TEXT NOT NULL,
    "fileId" INTEGER,
    "parentId" INTEGER,
    "originId" INTEGER,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Head" (
    "id" SERIAL NOT NULL,
    "blockId" INTEGER NOT NULL,
    "lineId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,

    CONSTRAINT "Head_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "tagId" TEXT NOT NULL,
    "blockId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LinesInBlocks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "Line_order_idx" ON "Line"("order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Version_timestamp_key" ON "Version"("timestamp");

-- CreateIndex
CREATE INDEX "Version_timestamp_idx" ON "Version"("timestamp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockId_key" ON "Block"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tagId_key" ON "Tag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_timestamp_key" ON "Tag"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "_LinesInBlocks_AB_unique" ON "_LinesInBlocks"("A", "B");

-- CreateIndex
CREATE INDEX "_LinesInBlocks_B_index" ON "_LinesInBlocks"("B");

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_sourceBlockId_fkey" FOREIGN KEY ("sourceBlockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Head" ADD CONSTRAINT "Head_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LinesInBlocks" ADD CONSTRAINT "_LinesInBlocks_A_fkey" FOREIGN KEY ("A") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LinesInBlocks" ADD CONSTRAINT "_LinesInBlocks_B_fkey" FOREIGN KEY ("B") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;
