import { SubscriptionManager } from "../../../editor/ui/widgets/mouse-tracker";
import { Disposable } from "../../../editor/utils/types";
import { ChangeSet, LineChange, MultiLineChange, AnyChange, ChangeBehaviour } from "../data/change"
//import { BlockType } from "@prisma/client"

// avoid prisma import -> types from this class are used in definition of ELectron Preload file, which cannot include an import to prisma for security reasons
let BlockType: {
    ROOT:   'ROOT',
    INLINE: 'INLINE',
    CLONE:  'CLONE'
};
export type BlockType = (typeof BlockType)[keyof typeof BlockType]

let LineType: {
    ORIGINAL: 'ORIGINAL',
    INSERTED: 'INSERTED'
}; 
export type LineType = (typeof LineType)[keyof typeof LineType]

let VersionType: {
    IMPORTED:      'IMPORTED',
    PRE_INSERTION: 'PRE_INSERTION',
    INSERTION:     'INSERTION',
    CLONE:         'CLONE',
    CHANGE:        'CHANGE',
    DELETION:      'DELETION'
};
export type VersionType = (typeof VersionType)[keyof typeof VersionType]

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
    public readonly timestamp:           number
    public readonly text:                string
    public readonly automaticSuggestion: boolean

    public constructor(tagId: VCSTagId, name: string, timestamp: number, text: string, automaticSuggestion: boolean) {
        super(tagId.sessionId, tagId.filePath, tagId.blockId, tagId.tagId)

        this.name                = name
        this.timestamp           = timestamp
        this.text                = text
        this.automaticSuggestion = automaticSuggestion
    }
}

export interface VCSDatabaseData {
    databaseId?: number
}

export class VCSFileData extends VCSFileId implements VCSDatabaseData {

    public readonly databaseId: number
    public readonly eol:         string

    public rootBlock: VCSBlockData

    public lines:  VCSLineData[]  = []
    public blocks: VCSBlockData[] = []

    public constructor(databaseId: number, fileId: VCSFileId, eol: string) {
        super(fileId.sessionId, fileId.filePath)
        this.databaseId = databaseId
        this.eol        = eol
    }
}

export class VCSBlockData extends VCSBlockId implements VCSDatabaseData {

    public readonly databaseId: number

    public readonly file:  VCSFileData
    public readonly type:  BlockType

    public heads:   Map<VCSLineData, VCSVersionData>
    public parent?: VCSBlockData
    public origin?: VCSBlockData

    public tags: VCSTagData[] = []

    public constructor(databaseId: number, blockId: string, file: VCSFileData, type: BlockType) {
        super(file.sessionId, file.filePath, blockId)
        this.databaseId = databaseId
        this.file       = file
        this.type       = type
    }
}

export class VCSLineData extends VCSFileId implements VCSDatabaseData {

    public readonly databaseId: number

    public readonly file:     VCSFileData
    public readonly type:     LineType
    public readonly position: number

    public versions: VCSVersionData[] = []

    public constructor(databaseId: number, file: VCSFileData, type: LineType, position: number) {
        super(file.sessionId, file.filePath)
        this.databaseId = databaseId
        this.type       = type
        this.file       = file
        this.position   = position
    }
}

export class VCSVersionData extends VCSFileId implements VCSDatabaseData {

    public readonly databaseId: number

    public readonly line:      VCSLineData
    public readonly type:      VersionType
    public readonly timestamp: number
    public readonly isActive:  boolean
    public readonly content:   string

    public sourceBlock?: VCSBlockData
    public origin?:      VCSVersionData

    public constructor(databaseId: number, line: VCSLineData, type: VersionType, timestamp: number, isActive: boolean, content: string, sourceBlock: VCSBlockData | undefined, origin: VCSVersionData | undefined) {
        super(line.sessionId, line.filePath)
        this.databaseId  = databaseId
        this.line        = line
        this.type        = type
        this.isActive    = isActive
        this.timestamp   = timestamp
        this.content     = content
        this.sourceBlock = sourceBlock
        this.origin      = origin
    }
}

export class VCSTagData extends VCSTagId implements VCSDatabaseData {

    public readonly databaseId: number

    public readonly block:     VCSBlockData
    public readonly name:      string
    public readonly timestamp: number
    public readonly code:      string

    public constructor(databaseId: number, tagId: string, block: VCSBlockData, name: string, timestamp: number, code: string) {
        super(block.sessionId, block.filePath, block.blockId, tagId)
        this.databaseId = databaseId
        this.block      = block
        this.name       = name
        this.timestamp  = timestamp
        this.code       = code
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

export enum VCSRequestType {
    SessionManagement,
    Silent,
    ReadOnly,
    ReadWrite
}

export enum VCSOperation {
    CreateSession,
    CloseSession,
    WaitForCurrentRequests,
    LoadFile,
    UnloadFile,
    GetText,
    GetRootText,
    LineChanged,
    LinesChanged,
    ApplyChange,
    ApplyChanges,
    CopyBlock,
    CreateChild,
    DeleteBlock,
    GetBlockInfo,
    GetChildrenInfo,
    UpdateBlock,
    SetBlockVersionIndex,
    SaveCurrentBlockVersion,
    ApplyTag
}

export const VCSOperationTypes = new Map<VCSOperation, VCSRequestType>([
    [VCSOperation.CreateSession,           VCSRequestType.SessionManagement],
    [VCSOperation.CloseSession,            VCSRequestType.SessionManagement],
    [VCSOperation.WaitForCurrentRequests,  VCSRequestType.Silent],
    [VCSOperation.LoadFile,                VCSRequestType.ReadWrite],
    [VCSOperation.UnloadFile,              VCSRequestType.ReadOnly],
    [VCSOperation.GetText,                 VCSRequestType.ReadOnly],
    [VCSOperation.GetRootText,             VCSRequestType.ReadOnly],
    [VCSOperation.LineChanged,             VCSRequestType.ReadWrite],
    [VCSOperation.LinesChanged,            VCSRequestType.ReadWrite],
    [VCSOperation.ApplyChange,             VCSRequestType.ReadWrite],
    [VCSOperation.ApplyChanges,            VCSRequestType.ReadWrite],
    [VCSOperation.CopyBlock,               VCSRequestType.ReadWrite],
    [VCSOperation.CreateChild,             VCSRequestType.ReadWrite],
    [VCSOperation.DeleteBlock,             VCSRequestType.ReadWrite],
    [VCSOperation.GetBlockInfo,            VCSRequestType.ReadOnly],
    [VCSOperation.GetChildrenInfo,         VCSRequestType.ReadOnly],
    [VCSOperation.UpdateBlock,             VCSRequestType.ReadWrite],
    [VCSOperation.SetBlockVersionIndex,    VCSRequestType.ReadWrite],
    [VCSOperation.SaveCurrentBlockVersion, VCSRequestType.ReadWrite],
    [VCSOperation.ApplyTag,                VCSRequestType.ReadWrite],
])

export interface IVCSRequest<RequestData> {
    requestId:          string
    data:               RequestData
}

export interface VCSSessionCreationRequest extends IVCSRequest<void> {}

export interface VCSSessionRequest<RequestData> extends IVCSRequest<RequestData> {
    sessionId:          VCSSessionId
    previousRequestId?: string
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
    createSession(request: VCSSessionCreationRequest): Promise<VCSResponse<VCSSessionId>>
    closeSession(request: VCSSessionRequest<void>): Promise<VCSResponse<void>>
    waitForCurrentRequests(request: VCSSessionRequest<void>): Promise<VCSResponse<void>>

    // operation on session: loading and unloading a file, making it available for operations
    loadFile(request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>>  // always returns ID to root block so that editing is immediately possible
    unloadFile(request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>>

    // accessors to text of block
    getText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>>
    getRootText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    lineChanged (request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>>
    linesChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>>
    applyChange (request: VCSSessionRequest<{ blockId: VCSBlockId, change: AnyChange }>): Promise<VCSResponse<VCSBlockId[]>>
    applyChanges(request: VCSSessionRequest<{ blockId: VCSBlockId, changes: ChangeSet }>): Promise<VCSResponse<VCSBlockId[]>>

    // create and delete blocks
    copyBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>>
    createChild(request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo | null>>
    deleteBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>>

    // read block data
    getBlockInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
    getChildrenInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>>

    // update snapshots
    updateBlock(request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>>
    setBlockVersionIndex(request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>>

    // tag interface
    saveCurrentBlockVersion(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>>
    applyTag(request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
}

export abstract class BasicVCSProvider implements VCSProvider {

    // creating and closing a session
    public abstract createSession(request: VCSSessionCreationRequest): Promise<VCSResponse<VCSSessionId>>
    public abstract closeSession(request: VCSSessionRequest<void>): Promise<VCSResponse<void>>
    public abstract waitForCurrentRequests(request: VCSSessionRequest<void>): Promise<VCSResponse<void>>

    // operation on session: loading and unloading a file, making it available for operations
    public abstract loadFile(request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>>  // always returns ID to root block so that editing is immediately possible
    public abstract unloadFile(request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>>

    // accessors to text of block
    public abstract getText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>>
    public abstract getRootText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>>

    // edit interface on blocks -> each operation returns the ID for all blocks that got affected by an edit
    public abstract lineChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>>
    public abstract linesChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>>

    public async applyChange(request: VCSSessionRequest<{ blockId: VCSBlockId, change: AnyChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        const { blockId: _, change } = request.data
        if (change.changeBehaviour === ChangeBehaviour.Line) {
            return await this.lineChanged(request as VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>)
        } else if (change.changeBehaviour === ChangeBehaviour.MultiLine) {
            return await this.linesChanged(request as VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>)
        } else {
            throw new Error("Change type unknown.")
        }
    }

    // TODO: this was a great idea in the old, in-memory version of this tool, for databases, this is a bit too inefficient
    public async applyChanges(request: VCSSessionRequest<{ blockId: VCSBlockId, changes: ChangeSet }>): Promise<VCSResponse<VCSBlockId[]>> {
        const { blockId, changes } = request.data

        let subIdCount = 0
        let previousRequestId = request.previousRequestId
        const changeResponses: Promise<VCSResponse<VCSBlockId[]>>[] = []
        for (let i = 0; i < changes.length; i++) {
            const requestId = i + 1 < changes.length ? request.requestId + ":apply-changes-sub-request-" + subIdCount++ : request.requestId
            const changeRequest = { sessionId: request.sessionId, requestId, previousRequestId, data: { blockId, change: changes[i] } }
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
    public abstract copyBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>>
    public abstract createChild(request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo | null>>
    public abstract deleteBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>>

    // read block data
    public abstract getBlockInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
    public abstract getChildrenInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>>

    // update snapshots
    public abstract updateBlock(request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>>
    public abstract setBlockVersionIndex(request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>>

    // tag interface
    public abstract saveCurrentBlockVersion(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>>
    public abstract applyTag(request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>>
}

// server-side interface on which end-points may be mapped
export interface VCSServer extends VCSProvider {}
export abstract class BasicVCSServer extends BasicVCSProvider implements VCSServer {}

// client-side interface which may call server end-points
export interface VCSClient extends VCSProvider {}
export abstract class BasicVCSClient extends BasicVCSProvider implements VCSClient {}

export class VCSUnwrappedClient extends SubscriptionManager {

    public readonly client: VCSClient

    private currentRequestId?: number = undefined

    private readonly requestCallbacks: { requestTypes?: { include?: VCSRequestType[], exclude?: VCSRequestType[] }, operations?: { include?: VCSOperation[], exclude?: VCSOperation[] }, callback: () => void }[] = []

    public constructor(client: VCSClient) {
        super()
        this.client = client
    }

    private getNextIds(): { requestId: string, previousRequestId?: string } {
        const lastRequestId   = this.currentRequestId
        this.currentRequestId = this.currentRequestId !== undefined ? this.currentRequestId + 1 : 0
        return { requestId: `${this.currentRequestId!}`, previousRequestId: lastRequestId !== undefined ? `${lastRequestId}` : undefined }
    }

    private createSessionRequest<RequestType>(sessionId: VCSSessionId, args: RequestType): VCSSessionRequest<RequestType> {
        const { requestId, previousRequestId } = this.getNextIds()
        return { sessionId, requestId, previousRequestId, data: args }
    }

    private requestSent(operationType: VCSOperation): void {
        const requestType = VCSOperationTypes.get(operationType)!
        this.requestCallbacks.forEach(({ requestTypes, operations, callback }) => {

            const includeRequestTypes = requestTypes?.include ? new Set(requestTypes.include) : new Set(Object.values(VCSRequestType).filter(v => typeof v === "number") as VCSRequestType[])
            const excludeRequestTypes = requestTypes?.exclude ? new Set(requestTypes.exclude) : new Set<VCSRequestType>()

            const includeOperations   = operations?.include   ? new Set(operations.include)   : new Set(Object.values(VCSOperation).filter(v => typeof v === "number") as VCSOperation[])
            const excludeOperations   = operations?.exclude   ? new Set(operations.exclude)   : new Set<VCSOperation>()

            excludeRequestTypes.forEach(requestType => includeRequestTypes.delete(requestType))
            excludeOperations.forEach(operation => includeOperations.delete(operation))

            if (includeRequestTypes.has(requestType) && includeOperations.has(operationType)) {
                callback()
            }
        })
    }

    private async unwrapResponse<ResponseType>(request: Promise<VCSResponse<ResponseType>>, type: VCSOperation): Promise<ResponseType> {
        if (type !== undefined) { this.requestSent(type) }

        const response = await request

        const result = response as VCSSuccess<ResponseType>
        const error  = response as VCSError

        // NOTE: seemingly I can always cast to an interface, so this seems to be safer than just checking if the cast worked
        if (error.error) { throw new Error(error.error) }
        else             { return result.response }
    }

    public async createSession(): Promise<VCSSessionId> {
        const request = { requestId: "session-creation", data: null }
        return await this.unwrapResponse(this.client.createSession(request), VCSOperation.CreateSession)
    }

    public async closeSession(sessionId: VCSSessionId): Promise<void> {
        const request = this.createSessionRequest(sessionId, null)
        return await this.unwrapResponse(this.client.closeSession(request), VCSOperation.CloseSession)
    }

    public async waitForCurrentRequests(sessionId: VCSSessionId): Promise<void> {
        const request = this.createSessionRequest(sessionId, null)
        return await this.unwrapResponse(this.client.waitForCurrentRequests(request), VCSOperation.WaitForCurrentRequests)
    }

    public async loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        const request = this.createSessionRequest(sessionId, { options })
        return await this.unwrapResponse(this.client.loadFile(request), VCSOperation.LoadFile)
    }

    public async unloadFile(fileId: VCSFileId): Promise<void> {
        const request = this.createSessionRequest(fileId, { fileId })
        return await this.unwrapResponse(this.client.unloadFile(request), VCSOperation.UnloadFile)
    }

    public async getText(blockId: VCSBlockId): Promise<string> {
        const request = this.createSessionRequest(blockId, { blockId })
        return await this.unwrapResponse(this.client.getText(request), VCSOperation.GetText)
    }

    public async getRootText(blockId: VCSBlockId): Promise<string> {
        const request = this.createSessionRequest(blockId, { blockId })
        return await this.unwrapResponse(this.client.getRootText(request), VCSOperation.GetRootText)
    }

    public async lineChanged(blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]> {
        const request = this.createSessionRequest(blockId, { blockId, change })
        return await this.unwrapResponse(this.client.lineChanged(request), VCSOperation.LineChanged)
    }

    public async linesChanged(blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]> {
        const request = this.createSessionRequest(blockId, { blockId, change })
        return await this.unwrapResponse(this.client.linesChanged(request), VCSOperation.LinesChanged)
    }

    public async applyChange(blockId: VCSBlockId, change: AnyChange): Promise<VCSBlockId[]> {
        const request = this.createSessionRequest(blockId, { blockId, change })
        return await this.unwrapResponse(this.client.applyChange(request), VCSOperation.ApplyChange)
    }

    public async applyChanges(blockId: VCSBlockId, changes: ChangeSet): Promise<VCSBlockId[]> {
        const request = this.createSessionRequest(blockId, { blockId, changes })
        return await this.unwrapResponse(this.client.applyChanges(request), VCSOperation.ApplyChanges)
    }

    public async copyBlock(blockId: VCSBlockId): Promise<VCSCopyBlockInfo> {
        const request = this.createSessionRequest(blockId, { blockId })
        return await this.unwrapResponse(this.client.copyBlock(request), VCSOperation.CopyBlock)
    }

    public async createChild(parentBlockId: VCSBlockId, range: VCSBlockRange): Promise<VCSChildBlockInfo | null> {
        const request = this.createSessionRequest(parentBlockId, { parentBlockId, range })
        return await this.unwrapResponse(this.client.createChild(request), VCSOperation.CreateChild)
    }

    public async deleteBlock(blockId: VCSBlockId): Promise<void> {
        const request = this.createSessionRequest(blockId, { blockId })
        return await this.unwrapResponse(this.client.deleteBlock(request), VCSOperation.DeleteBlock)
    }

    public async getBlockInfo(blockId: VCSBlockId): Promise<VCSBlockInfo> {
        const request = this.createSessionRequest(blockId, { blockId })
        return await this.unwrapResponse(this.client.getBlockInfo(request), VCSOperation.GetBlockInfo)
    }

    public async getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]> {
        const request = this.createSessionRequest(blockId, { blockId })
        return await this.unwrapResponse(this.client.getChildrenInfo(request), VCSOperation.GetChildrenInfo)
    }

    public async updateBlock(blockId: VCSBlockId, update: VCSBlockUpdate): Promise<void> {
        const request = this.createSessionRequest(blockId, { blockId, update })
        return await this.unwrapResponse(this.client.updateBlock(request), VCSOperation.UpdateBlock)
    }

    public async setBlockVersionIndex(blockId: VCSBlockId, versionIndex: number): Promise<string> {
        const request = this.createSessionRequest(blockId, { blockId, versionIndex })
        return await this.unwrapResponse(this.client.setBlockVersionIndex(request), VCSOperation.SetBlockVersionIndex)
    }

    public async saveCurrentBlockVersion(blockId: VCSBlockId): Promise<VCSTagInfo> {
        const request = this.createSessionRequest(blockId, { blockId })
        return await this.unwrapResponse(this.client.saveCurrentBlockVersion(request), VCSOperation.SaveCurrentBlockVersion)
    }

    public async applyTag(tagId: VCSTagId, blockId: VCSBlockId): Promise<VCSBlockInfo> {
        const request = this.createSessionRequest(blockId, { tagId, blockId })
        return await this.unwrapResponse(this.client.applyTag(request), VCSOperation.ApplyTag)
    }


    public onRequestSend(callback: () => void, filter?: { requestTypes?: { include?: VCSRequestType[], exclude?: VCSRequestType[] }, operations?: { include?: VCSOperation[], exclude?: VCSOperation[] } }): Disposable {

        const requestCallback = { requestTypes: filter.requestTypes, operations: filter.operations, callback }
        this.requestCallbacks.push(requestCallback)

        const parent = this
        return this.addSubscription({
            dispose() {
                const index = parent.requestCallbacks.indexOf(requestCallback, 0)
                if (index > -1) { parent.requestCallbacks.splice(index, 1) }
            },
        })
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

    public async waitForCurrentRequests(): Promise<void> {
        await this.client.waitForCurrentRequests(this.session)
    }

    public onRequestSend(callback: () => void, filter?: { requestTypes?: { include?: VCSRequestType[], exclude?: VCSRequestType[] }, operations?: { include?: VCSOperation[], exclude?: VCSOperation[] } }): Disposable {
        return this.client.onRequestSend(callback, filter)
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

    public async waitForCurrentRequests(): Promise<void> {
        await this.session.waitForCurrentRequests()
    }

    public async getText(): Promise<string> {
        return await this.client.getText(this.block)
    }

    public async getRootText(): Promise<string> {
        return await this.client.getRootText(this.block)
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

    public async copyBlock(blockId: VCSBlockId): Promise<VCSBlockSession> {
        const copyBlock = await this.client.copyBlock(blockId)
        return new VCSBlockSession(this.session, copyBlock, false)
    }

    public async copy(): Promise<VCSBlockSession> {
        return await this.copyBlock(this.block)
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

    public onRequestSend(callback: () => void, filter?: { requestTypes?: { include?: VCSRequestType[], exclude?: VCSRequestType[] }, operations?: { include?: VCSOperation[], exclude?: VCSOperation[] } }): Disposable {
        return this.client.onRequestSend(callback, filter)
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

    public async createSession(request: VCSSessionCreationRequest): Promise<VCSResponse<VCSSessionId>> {
        return await this.adapter.createSession(request)
    }

    public async closeSession(request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await this.adapter.closeSession(request)
    }

    public async waitForCurrentRequests(request: VCSSessionRequest<void>): Promise<VCSResponse<void>> {
        return await this.adapter.waitForCurrentRequests(request)
    }

    public async loadFile(request: VCSSessionRequest<{ options: VCSFileLoadingOptions }>): Promise<VCSResponse<VCSRootBlockInfo>> {
        return await this.adapter.loadFile(request)
    }

    public async unloadFile(request: VCSSessionRequest<{ fileId: VCSFileId }>): Promise<VCSResponse<void>> {
        return await this.adapter.unloadFile(request)
    }

    public async getText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await this.adapter.getText(request)
    }

    public async getRootText(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<string>> {
        return await this.adapter.getRootText(request)
    }

    public async lineChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: LineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.adapter.lineChanged(request)
    }

    public async linesChanged(request: VCSSessionRequest<{ blockId: VCSBlockId, change: MultiLineChange }>): Promise<VCSResponse<VCSBlockId[]>> {
        return await this.adapter.linesChanged(request)
    }

    public async copyBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSCopyBlockInfo>> {
        return await this.adapter.copyBlock(request)
    }

    public async createChild(request: VCSSessionRequest<{ parentBlockId: VCSBlockId, range: VCSBlockRange }>): Promise<VCSResponse<VCSChildBlockInfo | null>> {
        return await this.adapter.createChild(request)
    }

    public async deleteBlock(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<void>> {
        return await this.adapter.deleteBlock(request)
    }

    public async getBlockInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await this.adapter.getBlockInfo(request)
    }

    public async getChildrenInfo(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo[]>> {
        return await this.adapter.getChildrenInfo(request)
    }

    public async updateBlock(request: VCSSessionRequest<{ blockId: VCSBlockId, update: VCSBlockUpdate }>): Promise<VCSResponse<void>> {
        return await this.adapter.updateBlock(request)
    }

    public async setBlockVersionIndex(request: VCSSessionRequest<{ blockId: VCSBlockId, versionIndex: number }>): Promise<VCSResponse<string>> {
        return await this.adapter.setBlockVersionIndex(request)
    }

    public async saveCurrentBlockVersion(request: VCSSessionRequest<{ blockId: VCSBlockId }>): Promise<VCSResponse<VCSTagInfo>> {
        return await this.adapter.saveCurrentBlockVersion(request)
    }

    public async applyTag(request: VCSSessionRequest<{ tagId: VCSTagId, blockId: VCSBlockId }>): Promise<VCSResponse<VCSBlockInfo>> {
        return await this.adapter.applyTag(request)
    }
}