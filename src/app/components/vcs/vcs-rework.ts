import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "../data/change"
import { BlockType } from "@prisma/client"

export class SessionId {

    public readonly sessionId: string

    public constructor(sessionId: string) {
        this.sessionId = sessionId
    }
}

export class FileId extends SessionId {

    public readonly filePath: string

    public static createFrom(sessionId: SessionId, filePath: string): FileId {
        return new FileId(sessionId.sessionId, filePath)
    }

    public constructor(sessionId: string, filePath: string) {
        super(sessionId)
        this.filePath = filePath
    }
}

export class BlockId extends FileId {

    public readonly blockId: string

    public static createFrom(fileId: FileId, blockId: string): BlockId {
        return new BlockId(fileId.sessionId, fileId.filePath, blockId)
    }

    public constructor(sessionId: string, filePath: string, blockId: string) {
        super(sessionId, filePath)
        this.blockId = blockId
    }
}

export class TagId extends BlockId {

    public readonly tagId: string

    public static createFrom(blockId: BlockId, tagId: string): TagId {
        return new TagId(blockId.sessionId, blockId.filePath, blockId.blockId, tagId)
    }

    public constructor(sessionId: string, filePath: string, blockId: string, tagId: string) {
        super(sessionId, filePath, blockId)
        this.tagId = tagId
    }
}

export class BlockInfo extends BlockId {

    public readonly type:         BlockType
    public readonly range:        BlockRange

    public readonly versionCount: number
    public readonly versionIndex: number

    public readonly tags:         TagInfo[]

    public constructor(blockId: BlockId, type: BlockType, range: BlockRange, versionCount: number, versionIndex: number, tags: TagInfo[]) {
        super(blockId.sessionId, blockId.filePath, blockId.blockId)

        this.type         = type
        this.range        = range
        this.versionCount = versionCount
        this.versionIndex = versionIndex
        this.tags         = tags
    }
}

export class RootBlockInfo extends BlockInfo {
    public constructor(blockId: BlockId, range: BlockRange, versionCount: number, versionIndex: number, tags: TagInfo[]) {
        super(blockId, BlockType.ROOT, range, versionCount, versionIndex, tags)
    }
}

export class CopyBlockInfo extends BlockInfo {
    public constructor(blockId: BlockId, range: BlockRange, versionCount: number, versionIndex: number, tags: TagInfo[]) {
        super(blockId, BlockType.CLONE, range, versionCount, versionIndex, tags)
    }
}

export class ChildBlockInfo extends BlockInfo {
    public constructor(blockId: BlockId, range: BlockRange, versionCount: number, versionIndex: number, tags: TagInfo[]) {
        super(blockId, BlockType.INLINE, range, versionCount, versionIndex, tags)
    }
}

export class TagInfo extends TagId {

    public readonly name:                string
    public readonly text:                string
    public readonly automaticSuggestion: boolean

    public constructor(tagId: TagId, name: string, text: string, automaticSuggestion: boolean) {
        super(tagId.sessionId, tagId.filePath, tagId.blockId, tagId.tagId)

        this.name                = name
        this.text                = text
        this.automaticSuggestion = automaticSuggestion
    }
}

export interface FileLoadingOptions {
    eol:       string
    filePath?: string
    content?:  string
}

export interface BlockRange {
    startLine: number
    endLine:   number
}

export interface BlockUpdate extends BlockRange {}

export interface VCSProvider {

    // creating and closing a session
    createSession(): Promise<SessionId>
    closeSession(sessionId: SessionId): Promise<void>

    // operation on session: loading and unloading a file, making it available for operations
    loadFile(sessionId: SessionId, options: FileLoadingOptions): Promise<RootBlockInfo>  // always returns ID to root block so that editing is immediately possible
    unloadFile(fileId: FileId): Promise<void>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    lineChanged (blockId: BlockId, change: LineChange): Promise<BlockId[]>
    linesChanged(blockId: BlockId, change: MultiLineChange): Promise<BlockId[]>
    applyChange (blockId: BlockId, change: AnyChange): Promise<BlockId[]>
    applyChanges(blockId: BlockId, changes: ChangeSet): Promise<BlockId[]>

    // create and delete blocks
    copyBlock(blockId: BlockId): Promise<CopyBlockInfo>
    createChild(parentBlockId: BlockId, range: BlockRange): Promise<ChildBlockInfo | null>
    deleteBlock(blockId: BlockId): Promise<void>

    // read block data
    getBlockInfo(blockId: BlockId): Promise<BlockInfo>
    getChildrenInfo(blockId: BlockId): Promise<BlockInfo[]>

    // update snapshots
    updateBlock(blockId: BlockId, update: BlockUpdate): Promise<void>
    setBlockVersionIndex(blockId: BlockId, versionIndex: number): Promise<string>

    // tag interface
    saveCurrentBlockVersion(blockId: BlockId): Promise<TagInfo>
}

export abstract class BasicVCSProvider implements VCSProvider {

    // creating and closing a session
    public abstract createSession(): Promise<SessionId>
    public abstract closeSession(sessionId: SessionId): Promise<void>

    // operation on session: loading and unloading a file, making it available for operations
    public abstract loadFile(sessionId: SessionId, options: FileLoadingOptions): Promise<RootBlockInfo>  // always returns ID to root block so that editing is immediately possible
    public abstract unloadFile(fileId: FileId): Promise<void>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    public abstract lineChanged (blockId: BlockId, change: LineChange): Promise<BlockId[]>
    public abstract linesChanged(blockId: BlockId, change: MultiLineChange): Promise<BlockId[]>

    public async applyChange(blockId: BlockId, change: AnyChange): Promise<BlockId[]> {
        if (change.changeBehaviour === ChangeBehaviour.Line) {
            return await this.lineChanged(blockId, change as LineChange)
        } else if (change.changeBehaviour === ChangeBehaviour.MultiLine) {
            return await this.linesChanged(blockId, change as MultiLineChange)
        } else {
            throw new Error("Change type unknown.")
        }
    }

    public async applyChanges(blockId: BlockId, changes: ChangeSet): Promise<BlockId[]> {
        const blockIds = []
        for (const change of changes) {
            blockIds.push(await this.applyChange(blockId, change))
        }
        return blockIds.flat()
    }

    // create and delete blocks
    public abstract copyBlock(blockId: BlockId): Promise<CopyBlockInfo>
    public abstract createChild(parentBlockId: BlockId, range: BlockRange): Promise<ChildBlockInfo | null>
    public abstract deleteBlock(blockId: BlockId): Promise<void>

    // read block data
    public abstract getBlockInfo(blockId: BlockId): Promise<BlockInfo>
    public abstract getChildrenInfo(blockId: BlockId): Promise<BlockInfo[]>

    // update snapshots
    public abstract updateBlock(blockId: BlockId, update: BlockUpdate): Promise<void>
    public abstract setBlockVersionIndex(blockId: BlockId, versionIndex: number): Promise<string>

    // tag interface
    public abstract saveCurrentBlockVersion(blockId: BlockId): Promise<TagInfo>
}

// server-side interface on which end-points may be mapped
export interface VCSServer extends VCSProvider {}
export abstract class BasicVCSServer extends BasicVCSProvider implements VCSServer {}

// client-side interface which may call server end-points
export interface VCSClient extends VCSProvider {}
export abstract class BasicVCSClient extends BasicVCSProvider implements VCSClient {}

export class VCSSession {

    public readonly client:  VCSClient
    public readonly session: SessionId

    public static async create(client: VCSClient): Promise<VCSSession> {
        const session = await client.createSession()
        return new VCSSession(client, session)
    }

    public constructor(client: VCSClient, session: SessionId) {
        this.client  = client
        this.session = session
    }

    public async loadFile(options: FileLoadingOptions): Promise<VCSBlockSession> {
        const blockInfo = await this.client.loadFile(this.session, options)
        return VCSBlockSession.createFileSession(this, blockInfo)
    }

    // WARNING: This will also close all active block sessions belonging to this session! Any further operation on them will fail!
    public async close(): Promise<void> {
        await this.client.closeSession(this.session)
    }
}

export class VCSBlockSession {

    public readonly session:     VCSSession
    public readonly block:       BlockId
    public readonly isRootBlock: boolean

    public get client(): VCSClient { return this.session.client }

    public static createFileSession(session: VCSSession, rootBlock: BlockId): VCSBlockSession {
        return new VCSBlockSession(session, rootBlock, true)
    }

    private constructor(hostSession: VCSSession, block: BlockId, isRootBlock: boolean) {
        this.session     = hostSession,
        this.block       = block
        this.isRootBlock = isRootBlock
    }

    public async lineChanged (change: LineChange): Promise<BlockId[]> {
        return await this.client.lineChanged(this.block, change)
    }

    public async linesChanged(change: MultiLineChange): Promise<BlockId[]> {
        return await this.client.linesChanged(this.block, change)
    }

    public async applyChange(change: AnyChange): Promise<BlockId[]> {
        return await this.client.applyChange(this.block, change)
    }

    public async applyChanges(changes: ChangeSet): Promise<BlockId[]> {
        return await this.client.applyChanges(this.block, changes)
    }

    public async copyBlock(): Promise<VCSBlockSession> {
        const copyBlock = await this.client.copyBlock(this.block)
        return new VCSBlockSession(this.session, copyBlock, false)
    }

    public async createChild(range: BlockRange): Promise<ChildBlockInfo | null> {
        return await this.client.createChild(this.block, range)
    }

    public async deleteChild(childBlockId: BlockId): Promise<void> {
        await this.client.deleteBlock(childBlockId)
    }

    public async getBlockInfo(): Promise<BlockInfo> {
        return await this.client.getBlockInfo(this.block)
    }

    public async getChildInfo(childBlockId: BlockId): Promise<BlockInfo> {
        return await this.client.getBlockInfo(childBlockId)
    }

    public async getChildrenInfo(): Promise<BlockInfo[]> {
        return await this.client.getChildrenInfo(this.block)
    }

    public async updateChildBlock(childBlockId: BlockId, update: BlockUpdate): Promise<void> {
        await this.client.updateBlock(childBlockId, update)
    }

    public async setChildBlockVersionIndex(childBlockId: BlockId, versionIndex: number): Promise<string> {
        return await this.client.setBlockVersionIndex(childBlockId, versionIndex)
    }

    public async saveChildBlockVersion(childBlockId: BlockId): Promise<TagInfo> {
        return await this.client.saveCurrentBlockVersion(childBlockId)
    }

    public async close(): Promise<void> {
        if (this.isRootBlock) {
            this.client.unloadFile(this.block)
        } else {
            // QUESTION: Should copy blocks be deleted?
            // await this.client.deleteBlock(this.block)
        }
    }
}

// adapter that allows to build an adaptable server with varying backend
export interface VCSAdapter extends VCSProvider {}
export abstract class BasicVCSAdapter extends BasicVCSProvider implements VCSAdapter {}

// support interface to allow for constructor typing of adapters
export interface VCSAdapterClass<Adapter extends VCSAdapter> {
    new(): Adapter
}

// adaptable server with varying backend implemented as an adapter
export class AdaptableVCSServer<Adapter extends VCSAdapter> extends BasicVCSServer implements VCSServer {
    
    public readonly adapter: Adapter

    public static create<Adapter extends VCSAdapter>(adapterClass: VCSAdapterClass<Adapter>): AdaptableVCSServer<Adapter> {
        const adapter = new adapterClass()
        return new this(adapter)
    }

    public constructor(adapter: Adapter) {
        super()
        this.adapter = adapter
    }

    public async createSession(): Promise<SessionId> {
        return await this.adapter.createSession()
    }

    public async closeSession(sessionId: SessionId): Promise<void> {
        await this.adapter.closeSession(sessionId)
    }

    public async loadFile(sessionId: SessionId, options: FileLoadingOptions): Promise<RootBlockInfo> {
        return await this.adapter.loadFile(sessionId, options)
    }

    public async unloadFile(fileId: FileId): Promise<void> {
        await this.adapter.unloadFile(fileId)
    }

    public async lineChanged(blockId: BlockId, change: LineChange): Promise<BlockId[]> {
        return await this.adapter.lineChanged(blockId, change)
    }

    public async linesChanged(blockId: BlockId, change: MultiLineChange): Promise<BlockId[]> {
        return await this.adapter.linesChanged(blockId, change)
    }

    public async copyBlock(blockId: BlockId): Promise<CopyBlockInfo> {
        return await this.adapter.copyBlock(blockId)
    }

    public async createChild(parentBlockId: BlockId, range: BlockRange): Promise<ChildBlockInfo | null> {
        return await this.adapter.createChild(parentBlockId, range)
    }

    public async deleteBlock(blockId: BlockId): Promise<void> {
        await this.adapter.deleteBlock(blockId)
    }

    public async getBlockInfo(blockId: BlockId): Promise<BlockInfo> {
        return await this.adapter.getBlockInfo(blockId)
    }

    public async getChildrenInfo(blockId: BlockId): Promise<BlockInfo[]> {
        return await this.adapter.getChildrenInfo(blockId)
    }

    public async updateBlock(blockId: BlockId, update: BlockUpdate): Promise<void> {
        await this.adapter.updateBlock(blockId, update)
    }

    public async setBlockVersionIndex(blockId: BlockId, versionIndex: number): Promise<string> {
        return await this.adapter.setBlockVersionIndex(blockId, versionIndex)
    }

    public async saveCurrentBlockVersion(blockId: BlockId): Promise<TagInfo> {
        return await this.adapter.saveCurrentBlockVersion(blockId)
    }
}