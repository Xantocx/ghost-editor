-- CreateTable
CREATE TABLE "Timestamp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "File" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filePath" TEXT NOT NULL,
    "eol" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Block" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "blockId" TEXT NOT NULL,
    "fileId" INTEGER,
    "fileIdAfterDeletion" INTEGER,
    "type" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "parentId" INTEGER,
    "originId" INTEGER,
    "aiVersionNameHistory" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Block_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Block_fileIdAfterDeletion_fkey" FOREIGN KEY ("fileIdAfterDeletion") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Block_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Block" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Block_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Block" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Line" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileId" INTEGER NOT NULL,
    "order" REAL NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "Line_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lineId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL,
    "originId" INTEGER,
    "sourceBlockId" INTEGER,
    CONSTRAINT "Version_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Version_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Version" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Version_sourceBlockId_fkey" FOREIGN KEY ("sourceBlockId") REFERENCES "Block" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tagId" TEXT NOT NULL,
    "sourceBlockId" INTEGER NOT NULL,
    "tagBlockId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "Tag_sourceBlockId_fkey" FOREIGN KEY ("sourceBlockId") REFERENCES "Block" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tag_tagBlockId_fkey" FOREIGN KEY ("tagBlockId") REFERENCES "Block" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_LinesInBlocks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_LinesInBlocks_A_fkey" FOREIGN KEY ("A") REFERENCES "Block" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_LinesInBlocks_B_fkey" FOREIGN KEY ("B") REFERENCES "Line" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "File_filePath_key" ON "File"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockId_key" ON "Block"("blockId");

-- CreateIndex
CREATE INDEX "Block_fileId_idx" ON "Block"("fileId");

-- CreateIndex
CREATE INDEX "Line_order_fileId_idx" ON "Line"("order" ASC, "fileId");

-- CreateIndex
CREATE INDEX "Version_timestamp_idx" ON "Version"("timestamp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tagId_key" ON "Tag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tagBlockId_key" ON "Tag"("tagBlockId");

-- CreateIndex
CREATE INDEX "Tag_sourceBlockId_idx" ON "Tag"("sourceBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "_LinesInBlocks_AB_unique" ON "_LinesInBlocks"("A", "B");

-- CreateIndex
CREATE INDEX "_LinesInBlocks_B_index" ON "_LinesInBlocks"("B");
