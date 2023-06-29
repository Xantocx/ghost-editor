-- CreateTable
CREATE TABLE "_LinesInBlocks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_LinesInBlocks_AB_unique" ON "_LinesInBlocks"("A", "B");

-- CreateIndex
CREATE INDEX "_LinesInBlocks_B_index" ON "_LinesInBlocks"("B");

-- AddForeignKey
ALTER TABLE "_LinesInBlocks" ADD CONSTRAINT "_LinesInBlocks_A_fkey" FOREIGN KEY ("A") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LinesInBlocks" ADD CONSTRAINT "_LinesInBlocks_B_fkey" FOREIGN KEY ("B") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;
