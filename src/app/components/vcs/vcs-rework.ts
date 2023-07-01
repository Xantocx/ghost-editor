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
    createSession(request: VCSRequest<void>): Promise<VCSResponse<VCSSessionId>>
    closeSession(request: VCSRequest<{ sessionId: VCSSessionId }>): Promise<VCSResponse<void>>

    // operation on session: loading and unloading a file, making it available for operations
    loadFile(request: VCSRequest<{ sessionId: VCSSessionId, options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>>  // always returns ID to root block so that editing is immediately possible
    unloadFile(request: VCSRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>>

    // accessors to text of block
    getText(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>>
    getUnwrappedText(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSUnwrappedText>>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    lineChanged (request: VCSRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>>
    linesChanged(request: VCSRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>>
    applyChange (request: VCSRequest<{ blockId: VCSBlockId, change: AnyChange }>): Promise<VCSResponse<VCSBlockId[]>>
    applyChanges(request: VCSRequest<{ blockId: VCSBlockId, changes: ChangeSet }>): Promise<VCSResponse<VCSBlockId[]>>

    // create and delete blocks
    copyBlock(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>>
    createChild(request: VCSRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo | null>>
    deleteBlock(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>>

    // read block data
    getBlockInfo(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
    getChildrenInfo(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>>

    // update snapshots
    updateBlock(request: VCSRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>>
    setBlockVersionIndex(request: VCSRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>>

    // tag interface
    saveCurrentBlockVersion(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>>
    applyTag(request: VCSRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
}

export abstract class BasicVCSProvider implements VCSProvider {

    // creating and closing a session
    public abstract createSession(request: VCSRequest<void>): Promise<VCSResponse<VCSSessionId>>
    public abstract closeSession(request: VCSRequest<{ sessionId: VCSSessionId }>): Promise<VCSResponse<void>>

    // operation on session: loading and unloading a file, making it available for operations
    public abstract loadFile(request: VCSRequest<{ sessionId: VCSSessionId, options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>>  // always returns ID to root block so that editing is immediately possible
    public abstract unloadFile(request: VCSRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>>

    // accessors to text of block
    public abstract getText(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>>
    public abstract getUnwrappedText(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSUnwrappedText>>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    public abstract lineChanged(request: VCSRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>>
    public abstract linesChanged(request: VCSRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>>

    public async applyChange(request: VCSRequest<{ blockId: VCSBlockId, change: AnyChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        const { blockId, change } = request.data
        if (change.changeBehaviour === ChangeBehaviour.Line) {
            return await this.lineChanged(request as VCSRequest<{ blockId: VCSBlockId, change: LineChange }>)
        } else if (change.changeBehaviour === ChangeBehaviour.MultiLine) {
            return await this.linesChanged(request as VCSRequest<{ blockId: VCSBlockId, change: MultiLineChange }>)
        } else {
            throw new Error("Change type unknown.")
        }
    }

    public async applyChanges(request: VCSRequest<{ blockId: VCSBlockId, changes: ChangeSet }>): Promise<VCSResponse<VCSBlockId[]>> {
        const { blockId, changes } = request.data

        let subIdCount = 0
        let previousRequestId = request.previousRequestId
        const changeResponses: Promise<VCSResponse<VCSBlockId[]>>[] = []
        for (const change of changes) {
            const requestId = request.requestId + ":apply-changes-sub-request-" + subIdCount++
            const changeRequest = { requestId: requestId, previousRequestId, data: { blockId, change } }
            changeResponses.push(this.applyChange(changeRequest))
            previousRequestId = requestId
        }

        const responses = await Promise.all(changeResponses)

        if (responses.length > 0) {
            const error = responses.find(response => response as VCSError) as VCSError
            if (error) {
                return error
            } else {
                const successfulResponses = responses as VCSSuccess<VCSBlockId[]>[]
                return { requestId: request.requestId, response: successfulResponses.flatMap(response => response.response) }
            }
        } else {
            return { requestId: request.requestId, response: [] }
        }
    }

    // create and delete blocks
    public abstract copyBlock(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>>
    public abstract createChild(request: VCSRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo | null>>
    public abstract deleteBlock(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>>

    // read block data
    public abstract getBlockInfo(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
    public abstract getChildrenInfo(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>>

    // update snapshots
    public abstract updateBlock(request: VCSRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>>
    public abstract setBlockVersionIndex(request: VCSRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>>

    // tag interface
    public abstract saveCurrentBlockVersion(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>>
    public abstract applyTag(request: VCSRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
}

// server-side interface on which end-points may be mapped
export interface VCSServer extends VCSProvider {}
export abstract class BasicVCSServer extends BasicVCSProvider implements VCSServer {}

// client-side interface which may call server end-points
export interface VCSClient extends VCSProvider {}
export abstract class BasicVCSClient extends BasicVCSProvider implements VCSClient {}

export class VCSUnwrappedClient {

    public readonly client: VCSClient

    private currentRequestId?: number = undefined

    public constructor(client: VCSClient) {
        this.client = client
    }

    private createRequest<RequestType>(args: RequestType): VCSRequest<RequestType> {
        const lastRequestId   = this.currentRequestId
        this.currentRequestId = this.currentRequestId ? this.currentRequestId + 1 : 0
        return { requestId: `${this.currentRequestId}`, previousRequestId: `${lastRequestId}`, data: args }
    }

    private async unwrapResponse<ResponseType>(request: Promise<VCSResponse<ResponseType>>): Promise<ResponseType> {
        return request.then(response => {
            const result = response as VCSSuccess<ResponseType>
            const error  = response as VCSError

            if      (result) { return result.response }
            else if (error)  { throw new Error(error.error) }
            else             { throw new Error("Could not match response type!") }
        })
    }

    public async createSession(): Promise<VCSSessionId> {
        const request = this.createRequest(null)
        return await this.unwrapResponse(this.client.createSession(request))
    }

    public async closeSession(sessionId: VCSSessionId): Promise<void> {
        const request = this.createRequest({ sessionId })
        return await this.unwrapResponse(this.client.closeSession(request))
    }

    public async loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        const request = this.createRequest({ sessionId, options })
        return await this.unwrapResponse(this.client.loadFile(request))
    }

    public async unloadFile(fileId: VCSFileId): Promise<void> {
        const request = this.createRequest({ fileId })
        return await this.unwrapResponse(this.client.unloadFile(request))
    }

    public async getText(blockId: VCSBlockId): Promise<string> {
        const request = this.createRequest({ blockId })
        return await this.unwrapResponse(this.client.getText(request))
    }

    public async getUnwrappedText(blockId: VCSBlockId): Promise<VCSUnwrappedText> {
        const request = this.createRequest({ blockId })
        return await this.unwrapResponse(this.client.getUnwrappedText(request))
    }

    public async lineChanged(blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]> {
        const request = this.createRequest({ blockId, change })
        return await this.unwrapResponse(this.client.lineChanged(request))
    }

    public async linesChanged(blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]> {
        const request = this.createRequest({ blockId, change })
        return await this.unwrapResponse(this.client.linesChanged(request))
    }

    public async applyChange(blockId: VCSBlockId, change: AnyChange): Promise<VCSBlockId[]> {
        const request = this.createRequest({ blockId, change })
        return await this.unwrapResponse(this.client.applyChange(request))
    }

    public async applyChanges(blockId: VCSBlockId, changes: ChangeSet): Promise<VCSBlockId[]> {
        const request = this.createRequest({ blockId, changes })
        return await this.unwrapResponse(this.client.applyChanges(request))
    }

    public async copyBlock(blockId: VCSBlockId): Promise<VCSCopyBlockInfo> {
        const request = this.createRequest({ blockId })
        return await this.unwrapResponse(this.client.copyBlock(request))
    }

    public async createChild(parentBlockId: VCSBlockId, range: VCSBlockRange): Promise<VCSChildBlockInfo | null> {
        const request = this.createRequest({ parentBlockId, range })
        return await this.unwrapResponse(this.client.createChild(request))
    }

    public async deleteBlock(blockId: VCSBlockId): Promise<void> {
        const request = this.createRequest({ blockId })
        return await this.unwrapResponse(this.client.deleteBlock(request))
    }

    public async getBlockInfo(blockId: VCSBlockId): Promise<VCSBlockInfo> {
        const request = this.createRequest({ blockId })
        return await this.unwrapResponse(this.client.getBlockInfo(request))
    }

    public async getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]> {
        const request = this.createRequest({ blockId })
        return await this.unwrapResponse(this.client.getChildrenInfo(request))
    }

    public async updateBlock(blockId: VCSBlockId, update: VCSBlockUpdate): Promise<void> {
        const request = this.createRequest({ blockId, update })
        return await this.unwrapResponse(this.client.updateBlock(request))
    }

    public async setBlockVersionIndex(blockId: VCSBlockId, versionIndex: number): Promise<string> {
        const request = this.createRequest({ blockId, versionIndex })
        return await this.unwrapResponse(this.client.setBlockVersionIndex(request))
    }

    public async saveCurrentBlockVersion(blockId: VCSBlockId): Promise<VCSTagInfo> {
        const request = this.createRequest({ blockId })
        return await this.unwrapResponse(this.client.saveCurrentBlockVersion(request))
    }

    public async applyTag(tagId: VCSTagId, blockId: VCSBlockId): Promise<VCSBlockInfo> {
        const request = this.createRequest({ tagId, blockId })
        return await this.unwrapResponse(this.client.applyTag(request))
    }
}

export class VCSSession {

    public readonly client:  VCSUnwrappedClient
    public readonly session: VCSSessionId

    public static async create(client: VCSClient): Promise<VCSSession> {
        const unwrappedClient = new VCSUnwrappedClient(client)
        const session = await unwrappedClient.createSession()
        return new VCSSession(unwrappedClient, session)
    }

    public constructor(client: VCSUnwrappedClient, session: VCSSessionId) {
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

    public get client():  VCSUnwrappedClient { return this.session.client }
    public get blockId(): string             { return this.block.blockId }

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

    public async createSession(request: VCSRequest<void>): Promise<VCSResponse<VCSSessionId>> {
        return await this.adapter.createSession(request)
    }

    public async closeSession(request: VCSRequest<{ sessionId: VCSSessionId }>): Promise<VCSResponse<void>> {
        return await this.adapter.closeSession(request)
    }

    public async loadFile(request: VCSRequest<{ sessionId: VCSSessionId, options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>> {
        return await this.adapter.loadFile(request)
    }

    public async unloadFile(request: VCSRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>> {
        return await this.adapter.unloadFile(request)
    }

    public async getText(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await this.adapter.getText(request)
    }

    public async getUnwrappedText(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSUnwrappedText>> {
        return await this.adapter.getUnwrappedText(request)
    }

    public async lineChanged(request: VCSRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.adapter.lineChanged(request)
    }

    public async linesChanged(request: VCSRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.adapter.linesChanged(request)
    }

    public async copyBlock(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>> {
        return await this.adapter.copyBlock(request)
    }

    public async createChild(request: VCSRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo | null>> {
        return await this.adapter.createChild(request)
    }

    public async deleteBlock(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>> {
        return await this.adapter.deleteBlock(request)
    }

    public async getBlockInfo(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await this.adapter.getBlockInfo(request)
    }

    public async getChildrenInfo(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>> {
        return await this.adapter.getChildrenInfo(request)
    }

    public async updateBlock(request: VCSRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>> {
        return await this.adapter.updateBlock(request)
    }

    public async setBlockVersionIndex(request: VCSRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>> {
        return await this.adapter.setBlockVersionIndex(request)
    }

    public async saveCurrentBlockVersion(request: VCSRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>> {
        return await this.adapter.saveCurrentBlockVersion(request)
    }

    public async applyTag(request: VCSRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await this.adapter.applyTag(request)
    }
}