import { BrowserWindow } from "electron"

import { BasicVCSServer, BlockId, BlockInfo, BlockRange, BlockUpdate, CopyBlockInfo, FileId, FileLoadingOptions, ChildBlockInfo, RootBlockInfo, SessionId, TagInfo } from "../app/components/vcs/vcs-rework"
import { LineChange, MultiLineChange } from "../app/components/data/change"

import { ResourceManager, Session } from "./vcs/db/utilities"
import { Block } from "./vcs/core/block"

import { BlockProxy, LineProxy } from "./vcs/db/types"
import { prismaClient } from "./vcs/db/client"

export class DBVCSServer extends BasicVCSServer {

    // helper for preview update
    private browserWindow: BrowserWindow | undefined

    private resources = new ResourceManager()

    public constructor(browserWindow?: BrowserWindow) {
        super()
        this.browserWindow = browserWindow
    }

    private async updatePreview(block: BlockProxy) {
        if (this.browserWindow) {
            const lines = await prismaClient.line.findMany({
                where: {
                    fileId:   block.file.id,
                    blocks:   { some: { id: block.id } },
                    versions: {
                        some: {
                            headLists: { some: { blocks: { some: { id: block.id } } } },
                            isActive:  true
                        }
                    }
                },
                orderBy: {
                    order: "asc"
                },
                include: {
                    versions: true
                }
            })

            const versionCounts = lines.map(line => line.versions.length)
            const text          = await block.getText()
            
            this.browserWindow!.webContents.send("update-vcs-preview", block.id, text, versionCounts)
        }
    }

    private getSession(sessionId: SessionId): Session {
        return this.resources.getSession(sessionId)
    }

    private async getBlock(blockId: BlockId): Promise<BlockProxy> {
        return await this.resources.getBlock(blockId)
    }



    public async createSession(): Promise<SessionId> {
        return this.resources.createSession()
    }

    public async closeSession(sessionId: SessionId): Promise<void> {
        this.resources.closeSession(sessionId)
    }

    public async loadFile(sessionId: SessionId, options: FileLoadingOptions): Promise<RootBlockInfo> {
        return await this.resources.loadFile(sessionId, options)
    }

    public async unloadFile(fileId: FileId): Promise<void> {
        this.resources.unloadFile(fileId)
    }

    public async copyBlock(blockId: BlockId): Promise<CopyBlockInfo> {
        const block = await this.getBlock(blockId)
        const copy  = await block.copy()
        return await copy.asBlockInfo(blockId)
    }

    public async createChild(parentBlockId: BlockId, range: BlockRange): Promise<ChildBlockInfo> {
        const block = await this.getBlock(parentBlockId)
        const child = await block.createChild(range)
        return await child.asBlockInfo(parentBlockId)
    }

    public async deleteBlock(blockId: BlockId): Promise<void> {
        throw new Error("Method not implemented.")
    }

    public async getBlockInfo(blockId: BlockId): Promise<BlockInfo> {
        const block = await this.getBlock(blockId)
        return await block.asBlockInfo(blockId)
    }

    public async getChildrenInfo(blockId: BlockId): Promise<BlockInfo[]> {
        const block = await this.getBlock(blockId)
        return await block.getChildrenInfo(blockId)
    }

    public async updateBlock(blockId: BlockId, update: BlockUpdate): Promise<void> {
        console.warn("Currently, blocks cannot be updated because its unused and I cannot be bothered to actually implement that nightmare.")
    }

    public async setBlockVersionIndex(blockId: BlockId, versionIndex: number): Promise<string> {
        const root  = this.resources.getRootBlockFor(blockId)
        const block = await this.getBlock(blockId)
        await block.applyIndex(versionIndex)
        return await root.getText()
    }

    public async saveCurrentBlockVersion(blockId: BlockId): Promise<TagInfo> {
        throw new Error("Currently, block versions cannot be saved. I will implement that as soon as I can verify that the rest works!")
    }




    public async lineChanged(blockId: BlockId, change: LineChange): Promise<BlockId[]> {
        const block = await this.getBlock(blockId)
        const line  = await block.updateLine(change.lineNumber, change.lineText)
        await this.updatePreview(block)
        return line.getAffectedBlockIds()
    }

    public async linesChanged(blockId: BlockId, change: MultiLineChange): Promise<BlockId[]> {
        const block = await this.getBlock(blockId)

        //block.resetVersionMerging()

        const startsWithEol = change.insertedText[0] === block.eol
        const endsWithEol   = change.insertedText[change.insertedText.length - 1] === block.eol

        const insertedAtStartOfStartLine = change.modifiedRange.startColumn === 1
        const insertedAtEndOfStartLine = change.modifiedRange.startColumn > block.getLineByLineNumber(change.modifiedRange.startLineNumber).currentContent.length

        const insertedAtEnd   = change.modifiedRange.endColumn > block.getLineByLineNumber(change.modifiedRange.endLineNumber).currentContent.length

        const oneLineModification = change.modifiedRange.startLineNumber === change.modifiedRange.endLineNumber
        const insertOnly = oneLineModification && change.modifiedRange.startColumn == change.modifiedRange.endColumn

        const pushStartLineDown = insertedAtStartOfStartLine && endsWithEol  // start line is not modified and will be below the inserted lines
        const pushStartLineUp   = insertedAtEndOfStartLine && startsWithEol  // start line is not modified and will be above the inserted lines

        const modifyStartLine = !insertOnly || (!pushStartLineDown && !pushStartLineUp)


        const modifiedRange = {
            startLine: change.modifiedRange.startLineNumber,
            endLine:   change.modifiedRange.endLineNumber
        }

        let vcsLines: LineProxy[] = []
        const modifiedLines = change.lineText.split(block.eol)

        if (modifyStartLine) {
            vcsLines = await block.getActiveLinesInRange(modifiedRange)
        } else {
            // TODO: pushStartDown case not handled well yet, line tracking is off
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }



        let affectedLines: LineProxy[] = []

        async function deleteLine(line: LineProxy): Promise<void> {
            await line.delete(block)
            affectedLines.push(line)
        }

        async function updateLine(line: LineProxy, newContent: string): Promise<void> {
            await line.updateContent(newContent, block)
            affectedLines.push(line)
        }

        async function insertLine(lineNumber: number, content: string): Promise<void> {
            const line = await block.insertLineAt(lineNumber, content)
            affectedLines.push(line)
        }



        for (let i = vcsLines.length - 1; i >= modifiedLines.length; i--) {
            const line = vcsLines.at(i)
            await deleteLine(line)
        }

        /*
        // inverse deletion order
        for (let i = modifiedLines.length; i < vcsLines.length; i++) {
            const line = vcsLines.at(i)
            deleteLine(line)
        }
        */

        if (modifyStartLine) { await updateLine(vcsLines.at(0), modifiedLines[0]) }

        for (let i = 1; i < modifiedLines.length; i++) {
            if (i < vcsLines.length) {
                const line = vcsLines.at(i)
                await updateLine(line, modifiedLines[i])
            } else {
                await insertLine(modifiedRange.startLine + i, modifiedLines[i])
            }
        }

        this.updatePreview(block)

        return affectedLines.map(line => line.getAffectedBlockIds()).flat()
    }
}