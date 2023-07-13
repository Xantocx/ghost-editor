import { BlockType } from "@prisma/client";
import { MultiLineChange } from "../../../app/components/data/change";
import { VCSFileId, VCSFileData, VCSSessionRequest, VCSSessionId, VCSResponse, VCSSuccess, VCSError, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockData, VCSLineData, LineType, VersionType, VCSVersionData, VCSTagData, VCSTagId } from "../../../app/components/vcs/vcs-rework";
import { DBResourceManager, DBSession, ISessionBlock, ISessionFile, ISessionLine, ISessionTag, ISessionVersion, NewFileInfo, QueryType, ResourceManager, Session } from "../db/utilities";
import { LinkedList, LinkedListNode } from "../utils/linked-list";
import { BlockProxy } from "../db/types";
//import { Block } from "./block";
//import { LineNode } from "./line";
//import { Tag } from "./tag";
//import { LineNodeVersion } from "./version";

class VersionHistory<Version extends LinkedListNode<Version>> extends LinkedList<Version> {

    public get firstVersion(): Version | undefined { return this.first }
    public get lastVersion():  Version | undefined { return this.last }

    public set firstVersion(line: Version) { this.first = line }
    public set lastVersion (line: Version) { this.last  = line }
    
    public getVersions(): Version[] { return this.toArray() }
    
    public constructor(versions?: Version[]) {
        super()

        versions = versions ? versions : []
        const versionCount = versions.length

        if (versionCount > 0) {
            versions.forEach((version, index, versions) => {
                if (index > 0)                { version.previous = versions[index - 1] }
                if (index < versionCount - 1) { version.next     = versions[index + 1] }
            })

            this.firstVersion = versions[0]
            this.lastVersion  = versions[versionCount - 1]
        }
    }
}

type LineHistory = VersionHistory<LineVersion>

export class Line extends LinkedListNode<Line> implements ISessionLine {

    public readonly session:    InMemorySession
    public readonly databaseId: Promise<number>

    public readonly file:    Block
    public readonly type:    LineType

    public history: LineHistory = new VersionHistory()

    public static async save(line: Line): Promise<number> {
        return 0
    }

    public constructor(session: InMemorySession, file: Block, type: LineType, databaseId?: number) {
        super()

        this.file = file
        this.type = type

        this.session    = session
        this.databaseId = databaseId ? Promise.resolve(databaseId) : Line.save(this)
    }

    public getBlockIds(): Promise<string[]> {
        throw new Error("Method not implemented.");
    }
}

export class VirtualLine extends LinkedListNode<VirtualLine> {

    public readonly line:  Line
    public readonly block: Block

    public readonly head: LineVersion

    public constructor(line: Line, block: Block, head: LineVersion) {
        super()

        this.line  = line
        this.block = block
        this.head  = head
    }
}

export class LineVersion extends LinkedListNode<LineVersion> implements ISessionVersion<Line> {

    public readonly session:    InMemorySession
    public readonly databaseId: Promise<number>

    public readonly line:      Line
    public readonly type:      VersionType
    public readonly timestamp: number
    public readonly isActive:  boolean
    public readonly content:   string

    public origin?:      LineVersion
    public sourceBlock?: Block

    public static async save(version: LineVersion): Promise<number> {
        return 0
    }

    public constructor(session: InMemorySession, line: Line, type: VersionType, timestamp: number, isActive: boolean, content: string, databaseId?: number) {
        super()

        this.line      = line
        this.type      = type
        this.timestamp = timestamp
        this.isActive  = isActive
        this.content   = content

        this.session    = session
        this.databaseId = databaseId ? Promise.resolve(databaseId) : LineVersion.save(this)
    }
}

export class Tag implements ISessionTag {

    public readonly session:    InMemorySession
    public readonly databaseId: Promise<number>

    public readonly tagId:     string
    public readonly block:     Block
    public readonly name:      string
    public readonly timestamp: number
    public readonly code:      string

    public static async save(tag: Tag): Promise<number> {
        return 0
    }

    public constructor(session: InMemorySession, tagId: string, block: Block, name: string, timestamp: number, code: string, databaseId?: number) {
        this.tagId     = tagId
        this.block     = block
        this.name      = name
        this.timestamp = timestamp
        this.code      = code

        this.session    = session
        this.databaseId = databaseId ? Promise.resolve(databaseId) : Tag.save(this)
    }
}

class CachedFile {

    public readonly root: Block
    
    public readonly blocks   = new Map<string, Block>()
    public readonly lines    = new Map<number, Line>()
    public readonly versions = new Map<number, LineVersion>()
    public readonly tags     = new Map<string, Tag>()

    public constructor(session: InMemorySession, fileData: VCSFileData) {

        const rootData    = fileData.rootBlock
        const blockData   = fileData.blocks
        const lineData    = fileData.lines
        const versionData = lineData.flatMap(line => line.versions)
        const tagData     = blockData.flatMap(block => block.tags)

        this.root = new Block(session, rootData.blockId, fileData.filePath, rootData.type, rootData.databaseId)

        blockData.forEach(block => this.blocks.set(block.blockId, new Block(session, block.blockId, this.root, block.type, block.databaseId)))
        lineData.forEach(line => this.lines.set(line.databaseId, new Line(session, this.root, line.type, line.databaseId)))

        versionData.forEach(version => {
            const line = this.lines.get(version.line.databaseId)!
            this.versions.set(version.databaseId, new LineVersion(session, line, version.type, version.timestamp, version.isActive, version.content, version.databaseId))
        })

        tagData.forEach(tag => {
            const block = this.blocks.get(tag.block.blockId)!
            this.tags.set(tag.tagId, new Tag(session, tag.tagId, block, tag.name, tag.timestamp, tag.code, tag.databaseId))
        })

        this.fillVersions(versionData)
        this.fillLines(lineData)
        this.fillBlocks(blockData)
    }

    private fillVersions(versions: VCSVersionData[]): void {
        versions.forEach(versionData => {
            const version  = this.versions.get(versionData.databaseId)
            if (versionData.origin)      { version.origin      = this.versions.get(versionData.origin!.databaseId) }
            if (versionData.sourceBlock) { version.sourceBlock = this.blocks.get(versionData.sourceBlock!.blockId) }
        })
    }

    private fillLines(lines: VCSLineData[]): void {
        const sortedLines = lines.sort((lineA, lineB) => lineA.position - lineB.position)
        sortedLines.forEach((lineData, index, lines) => {

            const line = this.lines.get(lineData.databaseId)

            if (index > 0)                { line.previous = this.lines.get(lines[index - 1].databaseId)! }
            if (index < lines.length - 1) { line.next     = this.lines.get(lines[index + 1].databaseId)! }

            const sortedVersions = lineData.versions.sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)
            const mappedVersions = sortedVersions.map(version => this.versions.get(version.databaseId)!)
            line.history = new VersionHistory(mappedVersions)
        })
    }

    private fillBlocks(blocks: VCSBlockData[]): void {
        blocks.forEach(blockData => {
            const block = this.blocks.get(blockData.blockId)!

            const sortedHeads = Array.from(blockData.heads).sort((headA, headB) => headA[0].position - headB[0].position)
            const lines = sortedHeads.map(([lineData, versionData]) => {
                const line    = this.lines.get(lineData.databaseId)!
                const version = this.versions.get(versionData.databaseId)!
                return new VirtualLine(line, block, version)
            })

            block.firstLine = lines[0]
            block.lastLine  = lines[lines.length - 1]

            if (blockData.parent) { block.parent = this.blocks.get(blockData.parent!.blockId)! }
            if (blockData.origin) { block.origin = this.blocks.get(blockData.origin!.blockId)! }

            block.tags = blockData.tags.map(tagData => this.tags.get(tagData.tagId)!)
        })
    }
}

export class Block extends LinkedList<VirtualLine> implements ISessionFile, ISessionBlock<Block, Line, LineVersion> {

    public readonly session:    InMemorySession
    public readonly databaseId: Promise<number>

    public readonly blockId: string
    public readonly file:    Block
    public readonly type:    BlockType

    public parent?: Block = undefined
    public origin?: Block = undefined

    public tags: Tag[] = []

    private readonly _filePath?: string = undefined
    public get filePath(): string { return this._filePath ? this._filePath! : this.file.filePath }

    public get firstLine(): VirtualLine | undefined { return this.first }
    public get lastLine():  VirtualLine | undefined { return this.last }

    public set firstLine(line: VirtualLine | undefined) { this.first = line }
    public set lastLine (line: VirtualLine | undefined) { this.last  = line }

    public static async save(block: Block): Promise<number> {
        return 0
    }

    public constructor(session: InMemorySession, blockId: string, file: Block | string, type: BlockType, databaseId?: number) {
        super()

        this.blockId = blockId
        this.type    = type

        if (file instanceof Block) {
            this.file = file
        } else {
            this.file      = this
            this._filePath = file
        }

        this.session    = session
        this.databaseId = databaseId ? Promise.resolve(databaseId) : Block.save(this)
    }

    public asBlockInfo(fileId: VCSFileId): Promise<VCSBlockInfo> {
        throw new Error("Method not implemented.");
    }

    public getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]> {
        throw new Error("Method not implemented.");
    }

    public getText(): Promise<string> {
        throw new Error("Method not implemented.");
    }

    public updateLine(lineNumber: number, content: string): Promise<Line> {
        throw new Error("Method not implemented.");
    }

    public changeLines(fileId: VCSFileId, change: MultiLineChange): Promise<VCSBlockId[]> {
        throw new Error("Method not implemented.");
    }
    
    public applyIndex(index: number): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public applyTimestamp(timestamp: number): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public cloneOutdatedHeads(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public copy(): Promise<ISessionBlock<Block, Line, LineVersion>> {
        throw new Error("Method not implemented.");
    }

    public createChild(range: VCSBlockRange): Promise<ISessionBlock<Block, Line, LineVersion>> {
        throw new Error("Method not implemented.");
    }

    public delete(): void {
        throw new Error("Method not implemented.");
    }
}































export class InMemoryResourceManager extends ResourceManager<Block, Line, LineVersion, Block, Tag, InMemorySession> {
    public constructor() { super(InMemorySession) }
}

export class InMemorySession extends Session<Block, Line, LineVersion, Block, Tag> {

    private readonly databaseResources: DBResourceManager
    private readonly databaseSessionId: VCSSessionId

    private readonly cachedFiles = new Map<string, CachedFile>()

    private currentRequestId?: number = undefined

    public constructor(manager: InMemoryResourceManager) {
        super(manager)

        this.databaseResources = new DBResourceManager()
        this.databaseSessionId         = this.databaseResources.createSession()
    }

    private getNextIds(): { requestId: string, previousRequestId?: string } {
        const lastRequestId   = this.currentRequestId
        this.currentRequestId = this.currentRequestId !== undefined ? this.currentRequestId + 1 : 0
        return { requestId: `${this.currentRequestId!}`, previousRequestId: lastRequestId !== undefined ? `${lastRequestId}` : undefined }
    }

    private createSessionRequest<RequestType>(args: RequestType): VCSSessionRequest<RequestType> {
        const { requestId, previousRequestId } = this.getNextIds()
        return { sessionId: this.databaseSessionId, requestId, previousRequestId, data: args }
    }

    private async createDatabaseQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: DBSession, data: RequestData) => Promise<QueryResult>): Promise<QueryResult> {
        const response = await this.databaseResources.createQuery(request, queryType, query)
        const result   = response as VCSSuccess<QueryResult>
        const error    = response as VCSError

        // NOTE: seemingly I can always cast to an interface, so this seems to be safer than just checking if the cast worked
        if (error.error) { throw new Error(error.error) }
        else             { return result.response }
    }

    public async createSessionFile(filePath: string | undefined, eol: string, content?: string): Promise<NewFileInfo<Block, Line, LineVersion, Block>> {
        const request  = this.createSessionRequest({ filePath, eol, content })
        const fileData = await this.createDatabaseQuery(request, QueryType.ReadWrite, async (session, options) => {
            const blockInfo = await session.loadFile(options)
            return await session.getFileData(blockInfo)
        })

        const cachedFile = new CachedFile(this, fileData)
        const rootBlock  = cachedFile.root

        this.cachedFiles.set(rootBlock.filePath, cachedFile)

        return { file: { filePath: fileData.filePath, file: rootBlock }, rootBlock: { blockId: rootBlock.blockId, block: rootBlock } }
    }

    public async getRootSessionBlockFor(filePath: string): Promise<Block | undefined> {
        if (this.cachedFiles.has(filePath)) {
            return this.cachedFiles.get(filePath)!.root
        } else {
            return undefined
        }
    }

    public async getSessionBlockFor(blockId: VCSBlockId): Promise<Block | undefined> {
        const filePath = blockId.filePath
        const id       = blockId.blockId

        if (this.cachedFiles.has(filePath)) {
            return this.cachedFiles.get(filePath)!.blocks.get(id)
        } else {
            return undefined
        }
    }

    public async getSessionTagFor(tagId: VCSTagId): Promise<Tag | undefined> {
        const filePath = tagId.filePath
        const id       = tagId.tagId

        if (this.cachedFiles.has(filePath)) {
            return this.cachedFiles.get(filePath)!.tags.get(id)
        } else {
            return undefined
        }
    }

    public async deleteSessionBlock(block: Block): Promise<void> {
        block.delete()

        const blockId = new VCSBlockId(this.databaseSessionId.sessionId, block.filePath, block.blockId)
        const request = this.createSessionRequest(blockId)
        await this.createDatabaseQuery(request, QueryType.ReadWrite, async (session, blockId) => {
            const blockProxy = await session.getBlock(blockId)
            await session.deleteSessionBlock(blockProxy)
        })
    }

    public async getFileData(fileId: VCSFileId): Promise<VCSFileData> {
        throw new Error("In-memory file data extraction currently not usable.");
    }

}