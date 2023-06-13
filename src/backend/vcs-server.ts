import { BrowserWindow } from "electron"

import { VCSSnapshotData, VCSTag } from "../app/components/data/snapshot"
import { IRange } from "../app/components/utils/range"
import { BasicVCSServer, SessionData, SessionId, SessionOptions, SnapshotUUID } from "../app/components/vcs/vcs-provider"
import { LineChange, MultiLineChange } from "../app/components/data/change"

import { ResourceManager } from "./vcs/utils/resource-manager"
import { SessionInfo, Session } from "./vcs/utils/session"
import { Block } from "./vcs/core/block"
import { Line } from "./vcs/core/line"

export class GhostVCSServer extends BasicVCSServer {

    // helper for preview update
    private browserWindow: BrowserWindow | undefined

    private resources = new ResourceManager()

    public constructor(browserWindow?: BrowserWindow) {
        super()
        this.browserWindow = browserWindow
    }

    private getSession(sessionId: SessionId): Session {
        if (this.resources.hasSession(sessionId)) { return this.resources.getSession(sessionId)! }
        else                                      { throw new Error("This session ID is unknown!") }
    }

    private getBlock(sessionId: SessionId): Block { return this.getSession(sessionId).block }

    private updatePreview(block: Block) {
        const versionCounts = block.getActiveLines().map(line => { return line.getVersionCount() })
        this.browserWindow?.webContents.send("update-vcs-preview", block.id, block.getCurrentText(), versionCounts)
    }

    public async startSession(options?: SessionOptions): Promise<SessionInfo> {
        const filePath   = options?.filePath
        const filePathId = this.resources.getBlockIdForFilePath(filePath)
        const blockId    = options?.blockId
        const tagId      = options?.tagId
        const eol        = options?.eol
        const content    = options?.content

        const tag = tagId ? this.resources.getTag(tagId) : undefined
        if (tagId && !tag)   { throw new Error(`Could not find a Tag for the selected Tag ID "${tagId}"!`) }

        // TODO: currently, I will always choose the TagId with highest prio -> in the future, the BlockId might be higher, when the Tags can be applied to different blocks 
        const selectedBlockId = tag ? tag.blockId : (blockId ? blockId : (filePath ? filePathId : undefined))

        // parameter validation (TODO: eventually, the first check might not be needed anymore, if we can apply tags to other blocks)
        if      (tag        && tag.blockId !== selectedBlockId) { throw new Error(`Tag with Block ID "${tag.blockId}" was provided, but was not selected for this session! If you wanted to apply the Tag to another child/parent Block, then this is currently not supported.`) }
        else if (blockId    && blockId     !== selectedBlockId) { throw new Error(`Block ID "${blockId}" incompatible with Tag ID! If you try to apply a Tag to a different parent/child Block, then this is unfortunately currently not supported.`) }
        else if (filePathId && filePathId  !== selectedBlockId) { throw new Error(`ID "${filePathId}" exists for the provided file path, but it is incompatiple withe either the Tag or Block ID provided!`) }
        else if (filePath   && !filePathId  && selectedBlockId) { throw new Error("A file path without existing ID was provided alonside a Tag or Block ID! This cannot be resolved!") }

        // TODO: might be used later when tag is applied on block
        const block = this.resources.getBlock(selectedBlockId)
        if (selectedBlockId && !block) { throw new Error(`Could not find a Block for the selected Block ID "${selectedBlockId}"!`) }

        let session: Session
        if (tag && tag.blockId === block.id) {
            if (content) { console.warn("Right now, we do not support updating the content of an existing tag based on provided content. This will be ignored.") }
            session = Session.createFromTag(tag)
        } else if (block) {
            if (content) { console.warn("Right now, we do not support updating the content of an existing block based on provided content. This will be ignored.") }
            session = Session.createFromBlock(block)
            if (tag) { tag.applyTo(block) }
        } else {
            if (!eol) { throw new Error("The provided options do not allow for the retrieval of an existing Block. To create a new Block, please also provide the EOL sequence!") }
            if (tag)  { console.warn("A Tag cannot be applied on a newly created block, as they are likely unrelated. As such, the Tag will be ignored.") }
            session = Session.createFromOptions({ manager: this.resources, eol, filePath, content })
        }

        return session.getInfo()
    }

    public async closeSession(sessionId: SessionId): Promise<void> {
        this.resources.closeSession(sessionId)
    }

    public async updatePath(sessionId: SessionId, filePath: string): Promise<void> {
        console.log("UPDATING FILE PATH IS NOT IMPLEMNETED")
        //this.file.filePath = filePath
    }

    public async cloneToPath(sessionId: SessionId, filePath: string): Promise<void> {
        console.log("CLONE TO PATH NOT IMPLEMENTED")
    }

    public async reloadSessionData(sessionId: string): Promise<SessionData> {
        this.updatePreview(this.getBlock(sessionId))
        return this.getSession(sessionId).getData()
    }

    public async createSnapshot(sessionId: SessionId, range: IRange): Promise<VCSSnapshotData | null> {
        const block = this.getBlock(sessionId)
        return block.createChild(range)?.compressForParent()
    }

    public async deleteSnapshot(sessionId: SessionId, uuid: string): Promise<void> {
        const block = this.getBlock(sessionId)
        block.deleteChild(uuid)
    }

    public async getSnapshot(sessionId: SessionId, uuid: string): Promise<VCSSnapshotData> {
        const block = this.getBlock(sessionId)
        return block.getChild(uuid).compressForParent()
    }

    public async getSnapshots(sessionId: SessionId): Promise<VCSSnapshotData[]> {
        const block = this.getBlock(sessionId)
        return block.getCompressedChildren()
    }

    public async updateSnapshot(sessionId: SessionId, snapshot: VCSSnapshotData): Promise<void> {
        const block = this.getBlock(sessionId)
        block.updateChild(snapshot)
    }

    public async applySnapshotVersionIndex(sessionId: SessionId, uuid: SnapshotUUID, versionIndex: number): Promise<string> {
        const block = this.getBlock(sessionId)
        block.getChild(uuid).applyIndex(versionIndex)
        this.updatePreview(block)
        return block.getCurrentText()
    }

    public async lineChanged(sessionId: SessionId, change: LineChange): Promise<SnapshotUUID[]> {
        const block = this.getBlock(sessionId)
        const line = block.updateLine(change.lineNumber, change.lineText)
        this.updatePreview(block)
        return line.getAffectedBlockIds()
    }

    public async linesChanged(sessionId: SessionId, change: MultiLineChange): Promise<SnapshotUUID[]> {
        const block = this.getBlock(sessionId)

        block.resetVersionMerging()


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

        let vcsLines: Line[] = []
        const modifiedLines = change.lineText.split(block.eol)

        if (modifyStartLine) {
            vcsLines = block.getLineRange(modifiedRange)
        } else {
            // TODO: pushStartDown case not handled well yet, line tracking is off
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }
        


        let affectedLines: Line[] = []
        function deleteLine(line: Line): void {
            line.delete()
            affectedLines.push(line)
        }

        function updateLine(line: Line, newContent: string): void {
            line.update(newContent)
            affectedLines.push(line)
        }

        function insertLine(lineNumber: number, content: string): void {
            const line = block.insertLine(lineNumber, content)
            affectedLines.push(line)
        }



        for (let i = vcsLines.length - 1; i >= modifiedLines.length; i--) {
            const line = vcsLines.at(i)
            deleteLine(line)
        }

        /*
        // inverse deletion order
        for (let i = modifiedLines.length; i < vcsLines.length; i++) {
            const line = vcsLines.at(i)
            deleteLine(line)
        }
        */

        if (modifyStartLine) { updateLine(vcsLines.at(0), modifiedLines[0]) }

        for (let i = 1; i < modifiedLines.length; i++) {
            if (i < vcsLines.length) {
                const line = vcsLines.at(i)
                updateLine(line, modifiedLines[i])
            } else {
                insertLine(modifiedRange.startLine + i, modifiedLines[i])
            }
        }

        this.updatePreview(block)

        return affectedLines.map(line => line.getAffectedBlockIds()).flat()
    }

    public async saveCurrentVersion(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSTag> {
        const block = this.getBlock(sessionId)
        const snapshot = block.getChild(uuid)
        return snapshot.createTag()
    }
}