import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "../data/change"
//import { BlockType } from "@prisma/client"

// avoid prisma import -> types from this class are used in definition of ELectron Preload file, which cannot include an import to prisma for security reasons
let BlockType: {
    ROOT: 'ROOT',
    INLINE: 'INLINE',
    CLONE: 'CLONE'
};
type BlockType = (typeof BlockType)[keyof typeof BlockType]

export class VCSSessionId {

    public readonly sessionId: string

    public constructor(sessionId: string) {
        this.sessionId = sessionId
    }
}

export class VCSFileId extends VCSSessionId {

    public readonly filePath: string

    public static createFrom(sessionId: VCSSessionId, filePath: string): VCSFileId {
        return new VCSFileId(sessionId.sessionId, filePath)
    }

    public constructor(sessionId: string, filePath: string) {
        super(sessionId)
        this.filePath = filePath
    }
}

export class VCSBlockId extends VCSFileId {

    public readonly blockId: string

    public static createFrom(fileId: VCSFileId, blockId: string): VCSBlockId {
        return new VCSBlockId(fileId.sessionId, fileId.filePath, blockId)
    }

    public constructor(sessionId: string, filePath: string, blockId: string) {
        super(sessionId, filePath)
        this.blockId = blockId
    }
}

export class VCSTagId extends VCSBlockId {

    public readonly tagId: string

    public static createFrom(blockId: VCSBlockId, tagId: string): VCSTagId {
        return new VCSTagId(blockId.sessionId, blockId.filePath, blockId.blockId, tagId)
    }

    public constructor(sessionId: string, filePath: string, blockId: string, tagId: string) {
        super(sessionId, filePath, blockId)
        this.tagId = tagId
    }
}

export class VCSBlockInfo extends VCSBlockId {

    public readonly type:         BlockType
    public          range:        VCSBlockRange

    public readonly versionCount: number
    public readonly versionIndex: number

    public readonly tags:         VCSTagInfo[]

    public constructor(blockId: VCSBlockId, type: BlockType, range: VCSBlockRange, versionCount: number, versionIndex: number, tags: VCSTagInfo[]) {
        super(blockId.sessionId, blockId.filePath, blockId.blockId)

        this.type         = type
        this.range        = range
        this.versionCount = versionCount
        this.versionIndex = versionIndex
        this.tags         = tags
    }
}

export class VCSRootBlockInfo extends VCSBlockInfo {
    public constructor(blockId: VCSBlockId, range: VCSBlockRange, versionCount: number, versionIndex: number, tags: VCSTagInfo[]) {
        super(blockId, BlockType.ROOT, range, versionCount, versionIndex, tags)
    }
}

export class VCSCopyBlockInfo extends VCSBlockInfo {
    public constructor(blockId: VCSBlockId, range: VCSBlockRange, versionCount: number, versionIndex: number, tags: VCSTagInfo[]) {
        super(blockId, BlockType.CLONE, range, versionCount, versionIndex, tags)
    }
}

export class VCSChildBlockInfo extends VCSBlockInfo {
    public constructor(blockId: VCSBlockId, range: VCSBlockRange, versionCount: number, versionIndex: number, tags: VCSTagInfo[]) {
        super(blockId, BlockType.INLINE, range, versionCount, versionIndex, tags)
    }
}

export class VCSTagInfo extends VCSTagId {

    public readonly name:                string
    public readonly text:                string
    public readonly automaticSuggestion: boolean

    public constructor(tagId: VCSTagId, name: string, text: string, automaticSuggestion: boolean) {
        super(tagId.sessionId, tagId.filePath, tagId.blockId, tagId.tagId)

        this.name                = name
        this.text                = text
        this.automaticSuggestion = automaticSuggestion
    }
}

export interface VCSFileLoadingOptions {
    eol:       string
    filePath?: string
    content?:  string
}

export interface VCSBlockRange {
    startLine: number
    endLine:   number
}

export interface VCSBlockUpdate extends VCSBlockRange {}

export interface VCSUnwrappedText {
    blockText: string
    fullText: string
}

export interface VCSRequest<RequestData> {
    requestId:          string
    previousRequestId?: string
    data:               RequestData
}

interface IVCSResponse {
    requestId: string
}

export interface VCSSuccess<ResponseData> extends IVCSResponse {
    response: ResponseData
}

export interface VCSError extends IVCSResponse {
    error: string
}

export type VCSResponse<ResponseData> = VCSSuccess<ResponseData> | VCSError

export interface VCSProvider {

    // creating and closing a session
    createSession(): Promise<VCSSessionId>
    closeSession(sessionId: VCSSessionId): Promise<void>

    // operation on session: loading and unloading a file, making it available for operations
    loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo>  // always returns ID to root block so that editing is immediately possible
    unloadFile(fileId: VCSFileId): Promise<void>

    // accessors to text of block
    getText(blockId: VCSBlockId): Promise<string>
    getUnwrappedText(blockId: VCSBlockId): Promise<VCSUnwrappedText>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    lineChanged (blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]>
    linesChanged(blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]>
    applyChange (blockId: VCSBlockId, change: AnyChange): Promise<VCSBlockId[]>
    applyChanges(blockId: VCSBlockId, changes: ChangeSet): Promise<VCSBlockId[]>

    // create and delete blocks
    copyBlock(blockId: VCSBlockId): Promise<VCSCopyBlockInfo>
    createChild(parentBlockId: VCSBlockId, range: VCSBlockRange): Promise<VCSChildBlockInfo | null>
    deleteBlock(blockId: VCSBlockId): Promise<void>

    // read block data
    getBlockInfo(blockId: VCSBlockId): Promise<VCSBlockInfo>
    getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]>

    // update snapshots
    updateBlock(blockId: VCSBlockId, update: VCSBlockUpdate): Promise<void>
    setBlockVersionIndex(blockId: VCSBlockId, versionIndex: number): Promise<string>

    // tag interface
    saveCurrentBlockVersion(blockId: VCSBlockId): Promise<VCSTagInfo>
    applyTag(tagId: VCSTagId, blockId: VCSBlockId): Promise<VCSBlockInfo>
}

export abstract class BasicVCSProvider implements VCSProvider {

    // creating and closing a session
    public abstract createSession(): Promise<VCSSessionId>
    public abstract closeSession(sessionId: VCSSessionId): Promise<void>

    // operation on session: loading and unloading a file, making it available for operations
    public abstract loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo>  // always returns ID to root block so that editing is immediately possible
    public abstract unloadFile(fileId: VCSFileId): Promise<void>

    // accessors to text of block
    public abstract getText(blockId: VCSBlockId): Promise<string>
    public abstract getUnwrappedText(blockId: VCSBlockId): Promise<VCSUnwrappedText>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    public abstract lineChanged (blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]>
    public abstract linesChanged(blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]>

    public async applyChange(blockId: VCSBlockId, change: AnyChange): Promise<VCSBlockId[]> {
        if (change.changeBehaviour === ChangeBehaviour.Line) {
            return await this.lineChanged(blockId, change as LineChange)
        } else if (change.changeBehaviour === ChangeBehaviour.MultiLine) {
            return await this.linesChanged(blockId, change as MultiLineChange)
        } else {
            throw new Error("Change type unknown.")
        }
    }

    public async applyChanges(blockId: VCSBlockId, changes: ChangeSet): Promise<VCSBlockId[]> {
        const blockIds = []
        for (const change of changes) {
            blockIds.push(await this.applyChange(blockId, change))
        }
        return blockIds.flat()
    }

    // create and delete blocks
    public abstract copyBlock(blockId: VCSBlockId): Promise<VCSCopyBlockInfo>
    public abstract createChild(parentBlockId: VCSBlockId, range: VCSBlockRange): Promise<VCSChildBlockInfo | null>
    public abstract deleteBlock(blockId: VCSBlockId): Promise<void>

    // read block data
    public abstract getBlockInfo(blockId: VCSBlockId): Promise<VCSBlockInfo>
    public abstract getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]>

    // update snapshots
    public abstract updateBlock(blockId: VCSBlockId, update: VCSBlockUpdate): Promise<void>
    public abstract setBlockVersionIndex(blockId: VCSBlockId, versionIndex: number): Promise<string>

    // tag interface
    public abstract saveCurrentBlockVersion(blockId: VCSBlockId): Promise<VCSTagInfo>
    public abstract applyTag(tagId: VCSTagId, blockId: VCSBlockId): Promise<VCSBlockInfo>
}

// server-side interface on which end-points may be mapped
export interface VCSServer extends VCSProvider {}
export abstract class BasicVCSServer extends BasicVCSProvider implements VCSServer {}

// client-side interface which may call server end-points
export interface VCSClient extends VCSProvider {}
export abstract class BasicVCSClient extends BasicVCSProvider implements VCSClient {}

export class VCSSession {

    public readonly client:  VCSClient
    public readonly session: VCSSessionId

    public static async create(client: VCSClient): Promise<VCSSession> {
        const session = await client.createSession()
        return new VCSSession(client, session)
    }

    public constructor(client: VCSClient, session: VCSSessionId) {
        this.client  = client
        this.session = session
    }

    public createFileIdFrom(filePath: string): VCSFileId {
        return VCSFileId.createFrom(this.session, filePath)
    }

    public async loadFile(options: VCSFileLoadingOptions): Promise<VCSBlockSession> {
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
    public readonly block:       VCSBlockId
    public readonly isRootBlock: boolean

    public get client():  VCSClient { return this.session.client }
    public get blockId(): string    { return this.block.blockId }

    public static createFileSession(session: VCSSession, rootBlock: VCSBlockId): VCSBlockSession {
        return new VCSBlockSession(session, rootBlock, true)
    }

    private constructor(hostSession: VCSSession, block: VCSBlockId, isRootBlock: boolean) {
        this.session     = hostSession,
        this.block       = block
        this.isRootBlock = isRootBlock
    }

    public createChildIdFrom(blockId: string): VCSBlockId {
        return VCSBlockId.createFrom(this.block, blockId)
    }

    public async getText(): Promise<string> {
        return await this.client.getText(this.block)
    }

    public async getUnwrappedText(): Promise<VCSUnwrappedText> {
        return await this.client.getUnwrappedText(this.block)
    }

    public async lineChanged(change: LineChange): Promise<VCSBlockId[]> {
        return await this.client.lineChanged(this.block, change)
    }

    public async linesChanged(change: MultiLineChange): Promise<VCSBlockId[]> {
        return await this.client.linesChanged(this.block, change)
    }

    public async applyChange(change: AnyChange): Promise<VCSBlockId[]> {
        return await this.client.applyChange(this.block, change)
    }

    public async applyChanges(changes: ChangeSet): Promise<VCSBlockId[]> {
        return await this.client.applyChanges(this.block, changes)
    }

    public async copyBlock(): Promise<VCSBlockSession> {
        const copyBlock = await this.client.copyBlock(this.block)
        return new VCSBlockSession(this.session, copyBlock, false)
    }

    public async createChild(range: VCSBlockRange): Promise<VCSChildBlockInfo | null> {
        return await this.client.createChild(this.block, range)
    }

    public async getChild(childBlockId: VCSBlockId): Promise<VCSBlockSession> {
        const child = await this.client.getBlockInfo(childBlockId)
        return new VCSBlockSession(this.session, child, false)
    }

    public async deleteChild(childBlockId: VCSBlockId): Promise<void> {
        await this.client.deleteBlock(childBlockId)
    }

    public async getBlockInfo(): Promise<VCSBlockInfo> {
        return await this.client.getBlockInfo(this.block)
    }

    public async getChildInfo(childBlockId: VCSBlockId): Promise<VCSBlockInfo> {
        return await this.client.getBlockInfo(childBlockId)
    }

    public async getChildrenInfo(): Promise<VCSBlockInfo[]> {
        return await this.client.getChildrenInfo(this.block)
    }

    public async updateChildBlock(childBlockId: VCSBlockId, update: VCSBlockUpdate): Promise<void> {
        await this.client.updateBlock(childBlockId, update)
    }

    public async setChildBlockVersionIndex(childBlockId: VCSBlockId, versionIndex: number): Promise<string> {
        return await this.client.setBlockVersionIndex(childBlockId, versionIndex)
    }

    public async saveChildBlockVersion(childBlockId: VCSBlockId): Promise<VCSTagInfo> {
        return await this.client.saveCurrentBlockVersion(childBlockId)
    }

    public async applyTag(tagId: VCSTagId): Promise<VCSBlockInfo> {
        return await this.client.applyTag(tagId, this.block)
    }

    public async applyTagToChild(tagId: VCSTagId, childBlockId: VCSBlockId): Promise<VCSBlockInfo> {
        return await this.client.applyTag(tagId, childBlockId)
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

    public async createSession(): Promise<VCSSessionId> {
        return await this.adapter.createSession()
    }

    public async closeSession(sessionId: VCSSessionId): Promise<void> {
        await this.adapter.closeSession(sessionId)
    }

    public async loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        return await this.adapter.loadFile(sessionId, options)
    }

    public async unloadFile(fileId: VCSFileId): Promise<void> {
        await this.adapter.unloadFile(fileId)
    }

    public async getText(blockId: VCSBlockId): Promise<string> {
        return await this.adapter.getText(blockId)
    }

    public async getUnwrappedText(blockId: VCSBlockId): Promise<VCSUnwrappedText> {
        return await this.adapter.getUnwrappedText(blockId)
    }

    public async lineChanged(blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]> {
        return await this.adapter.lineChanged(blockId, change)
    }

    public async linesChanged(blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]> {
        return await this.adapter.linesChanged(blockId, change)
    }

    public async copyBlock(blockId: VCSBlockId): Promise<VCSCopyBlockInfo> {
        return await this.adapter.copyBlock(blockId)
    }

    public async createChild(parentBlockId: VCSBlockId, range: VCSBlockRange): Promise<VCSChildBlockInfo | null> {
        return await this.adapter.createChild(parentBlockId, range)
    }

    public async deleteBlock(blockId: VCSBlockId): Promise<void> {
        await this.adapter.deleteBlock(blockId)
    }

    public async getBlockInfo(blockId: VCSBlockId): Promise<VCSBlockInfo> {
        return await this.adapter.getBlockInfo(blockId)
    }

    public async getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]> {
        return await this.adapter.getChildrenInfo(blockId)
    }

    public async updateBlock(blockId: VCSBlockId, update: VCSBlockUpdate): Promise<void> {
        await this.adapter.updateBlock(blockId, update)
    }

    public async setBlockVersionIndex(blockId: VCSBlockId, versionIndex: number): Promise<string> {
        return await this.adapter.setBlockVersionIndex(blockId, versionIndex)
    }

    public async saveCurrentBlockVersion(blockId: VCSBlockId): Promise<VCSTagInfo> {
        return await this.adapter.saveCurrentBlockVersion(blockId)
    }

    public async applyTag(tagId: VCSTagId, blockId: VCSBlockId): Promise<VCSBlockInfo> {
        return await this.adapter.applyTag(tagId, blockId)
    }
}