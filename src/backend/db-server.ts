import { BrowserWindow } from "electron"

import { VCSRequest, VCSResponse, BasicVCSServer, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockUpdate, VCSCopyBlockInfo, VCSFileId, VCSFileLoadingOptions, VCSChildBlockInfo, VCSRootBlockInfo, VCSSessionId, VCSTagInfo, VCSTagId, VCSUnwrappedText } from "../app/components/vcs/vcs-rework"
import { LineChange, MultiLineChange } from "../app/components/data/change"

import { ResourceManager, Session } from "./vcs/db/utilities"

import { BlockProxy, FileProxy, LineProxy, TagProxy } from "./vcs/db/types"
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

    private getSession(sessionId: VCSSessionId): Session {
        return this.resources.getSession(sessionId)
    }

    private getFile(fileId: VCSFileId): FileProxy {
        return this.resources.getFile(fileId)
    }

    private async getBlock(blockId: VCSBlockId): Promise<BlockProxy> {
        return await this.resources.getBlock(blockId)
    }

    private async getTag(tagId: VCSTagId): Promise<TagProxy> {
        return await this.resources.getTag(tagId)
    }



    public async createSession(request: VCSRequest<void>): Promise<VCSResponse<VCSSessionId>> {
        return this.resources.createSession()
    }

    public async closeSession(sessionId: VCSSessionId): Promise<void> {
        this.resources.closeSession(sessionId)
    }

    public async loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        return await this.resources.loadFile(sessionId, options)
    }

    public async unloadFile(fileId: VCSFileId): Promise<void> {
        this.resources.unloadFile(fileId)
    }

    public async getText(blockId: VCSBlockId): Promise<string> {
        const block = await this.getBlock(blockId)
        return await block.getText()
    }

    public async getUnwrappedText(blockId: VCSBlockId): Promise<VCSUnwrappedText> {
        const block = await this.getBlock(blockId)
        return await block.getUnwrappedText()
    }

    public async copyBlock(blockId: VCSBlockId): Promise<VCSCopyBlockInfo> {
        const block = await this.getBlock(blockId)
        const copy  = await block.copy()
        return await copy.asBlockInfo(blockId)
    }

    public async createChild(parentBlockId: VCSBlockId, range: VCSBlockRange): Promise<VCSChildBlockInfo> {
        const block = await this.getBlock(parentBlockId)
        const child = await block.createChild(range)
        return await child.asBlockInfo(parentBlockId)
    }

    public async deleteBlock(blockId: VCSBlockId): Promise<void> {
        throw new Error("Method not implemented.")
    }

    public async getBlockInfo(blockId: VCSBlockId): Promise<VCSBlockInfo> {
        const block = await this.getBlock(blockId)
        return await block.asBlockInfo(blockId)
    }

    public async getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]> {
        const block = await this.getBlock(blockId)
        return await block.getChildrenInfo(blockId)
    }

    public async updateBlock(blockId: VCSBlockId, update: VCSBlockUpdate): Promise<void> {
        console.warn("Currently, blocks cannot be updated because its unused and I cannot be bothered to actually implement that nightmare.")
    }

    public async setBlockVersionIndex(blockId: VCSBlockId, versionIndex: number): Promise<string> {
        const root  = this.resources.getRootBlockFor(blockId)
        const block = await this.getBlock(blockId)
        await block.applyIndex(versionIndex)
        await this.updatePreview(block)
        return await root.getText()
    }

    public async saveCurrentBlockVersion(blockId: VCSBlockId): Promise<VCSTagInfo> {
        throw new Error("Currently, block versions cannot be saved. I will implement that as soon as I can verify that the rest works!")
    }

    public async applyTag(tagId: VCSTagId, blockId: VCSBlockId): Promise<VCSBlockInfo> {
        // TODO: Should the frontend or backend evaluate that blocks and tags fit together? Or do we assume I can apply any tag to any block?
        const tag   = await this.getTag(tagId)
        const block = await this.getBlock(blockId)
        await block.applyTimestamp(tag.timestamp)
        return await block.asBlockInfo(blockId)
    }




    public async lineChanged(blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]> {
        const block = await this.getBlock(blockId)
        const line  = await block.updateLine(change.lineNumber, change.lineText)
        
        await this.updatePreview(block)

        const ids = await line.getBlockIds()
        return ids.map(id => VCSBlockId.createFrom(blockId, id))
    }

    public async linesChanged(blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]> {
        const block = await this.getBlock(blockId)
        const eol   = await block.file.getEol()

        const versions = await block.getActiveHeadVersions()

        //block.resetVersionMerging()

        const startsWithEol = change.insertedText[0] === eol
        const endsWithEol   = change.insertedText[change.insertedText.length - 1] === eol

        const insertedAtStartOfStartLine = change.modifiedRange.startColumn === 1
        const insertedAtEndOfStartLine   = change.modifiedRange.startColumn > versions[change.modifiedRange.startLineNumber - 1].content.length

        const insertedAtEnd   = change.modifiedRange.endColumn > versions[change.modifiedRange.endLineNumber - 1].content.length

        const oneLineModification = change.modifiedRange.startLineNumber === change.modifiedRange.endLineNumber
        const insertOnly          = oneLineModification && change.modifiedRange.startColumn === change.modifiedRange.endColumn

        const pushStartLineDown = insertedAtStartOfStartLine && endsWithEol  // start line is not modified and will be below the inserted lines
        const pushStartLineUp   = insertedAtEndOfStartLine && startsWithEol  // start line is not modified and will be above the inserted lines

        const modifyStartLine = !insertOnly || (!pushStartLineDown && !pushStartLineUp)


        const modifiedRange = {
            startLine: change.modifiedRange.startLineNumber,
            endLine:   change.modifiedRange.endLineNumber
        }

        let vcsLines: LineProxy[] = []
        const modifiedLines = change.lineText.split(eol)

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
                // TODO: merge all line insertions into a single operation for performance reasons!
                await insertLine(modifiedRange.startLine + i, modifiedLines[i])
            }
        }

        await this.updatePreview(block)

        const affectedBlocks = new Set<string>()
        for (const line of affectedLines) {
            const blockIds = await line.getBlockIds()
            blockIds.forEach(id => affectedBlocks.add(id))
        }

        return Array.from(affectedBlocks).map(id => VCSBlockId.createFrom(blockId, id))
    }
}