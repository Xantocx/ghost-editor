import { BlockProxy, FileProxy, LineProxy, TagProxy, VersionProxy } from "../db/types"
import { prismaClient } from "../db/client"
import { BlockType, Block, Tag } from "@prisma/client"
import { randomUUID } from "crypto"
import { VCSBlockData, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSFileData, VCSFileId, VCSFileLoadingOptions, VCSLineData, VCSRootBlockInfo, VCSSessionCreationRequest, VCSSessionId, VCSSessionRequest, VCSTagData, VCSTagId, VCSUnwrappedText, VCSVersionData } from "../../../app/components/vcs/vcs-rework"
import { VCSResponse } from "../../../app/components/vcs/vcs-rework"
import { MultiLineChange } from "../../../app/components/data/change"
import { truncate } from "fs"

export interface ISessionFile {}

export interface ISessionBlock<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>> {
    blockId: string
    file:    SessionFile
    type:    BlockType

    asBlockInfo(fileId: VCSFileId): Promise<VCSBlockInfo>
    getChildrenInfo(blockId: VCSBlockId): Promise<VCSBlockInfo[]>

    getText(): Promise<string>
    getUnwrappedText(): Promise<VCSUnwrappedText>

    updateLine(lineNumber: number, content: string): Promise<SessionLine>
    changeLines(fileId: VCSFileId, change: MultiLineChange): Promise<VCSBlockId[]>

    applyIndex(index: number): Promise<SessionVersion[]>
    applyTimestamp(timestamp: number): Promise<SessionVersion[]>
    cloneOutdatedHeads(heads: SessionVersion[]): Promise<void>

    copy(): Promise<ISessionBlock<SessionFile, SessionLine, SessionVersion>>
    createChild(range: VCSBlockRange): Promise<ISessionBlock<SessionFile, SessionLine, SessionVersion> | null>
}

export interface ISessionLine {
    getBlockIds(): Promise<string[]>
}

export interface ISessionVersion<SessionLine extends ISessionLine> {
    line: SessionLine
}

export interface ISessionTag {
    timestamp: number
}

export type NewFileInfo<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>> = { file: { filePath: string; file: SessionFile }; rootBlock: { blockId: string; block: SessionBlock } }

export abstract class Session<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>, SessionTag extends ISessionTag> {

    public readonly id = randomUUID()
    public readonly resources: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>>
    public readonly queries:   QueryManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, this>   // TODO: Move query manager to ResourceManager? How to handle the inaccessibility of request data otherwise... -> slower: every operation handled by the same queue

    private readonly files  = new Map<string, SessionBlock>() // this may be called files, but refers to the root block for each file - due to the implementation, this name makes most sense though
    private readonly blocks = new Map<string, SessionBlock>() // a cache for previously loaded blocks to speed up performance
    private readonly tags   = new Map<string, SessionTag>()

    public constructor(resourceManager: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>>) {
        this.resources = resourceManager
        this.queries   = new QueryManager(this)
    }

    public abstract createSessionFile(filePath: string | undefined, eol: string, content?: string): Promise<NewFileInfo<SessionFile, SessionLine, SessionVersion, SessionBlock>>
    public abstract getRootSessionBlockFor(filePath: string):                                       Promise<SessionBlock | undefined>
    public abstract getSessionBlockFor(blockId: VCSBlockId):                                        Promise<SessionBlock | undefined>
    public abstract getSessionTagFor(tagId: VCSTagId):                                              Promise<SessionTag | undefined>
    public abstract deleteSessionBlock(block: SessionBlock):                                        Promise<void>

    public abstract getFileData(fileId: VCSFileId): Promise<VCSFileData>

    public async loadFile(options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        const sessionId = this.asId()

        if (options.filePath !== undefined) {
            const filePath = options.filePath!
            const fileId   = VCSFileId.createFrom(sessionId, filePath)

            if (this.files.has(filePath)) {
                return await this.files.get(filePath)!.asBlockInfo(fileId)
            } else {
                const sessions = this.resources.getSessions()
                if (sessions.some((session: Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>) => session.id !== this.id && session.files.has(filePath))) {
                    throw new Error(`Cannot load file ${filePath}! Currently in use by another session.`)
                }

                const rootBlock = await this.getRootSessionBlockFor(filePath)

                if (rootBlock) {
                    this.files.set(filePath, rootBlock)
                    this.blocks.set(rootBlock.blockId, rootBlock)
                    return await rootBlock.asBlockInfo(fileId)
                }
            }
        }
        
        // in every other case:
        const { file, rootBlock } = await this.createSessionFile(options.filePath, options.eol, options.content)
        this.files.set(file.filePath, rootBlock.block)
        this.blocks.set(rootBlock.blockId, rootBlock.block)

        const fileId = VCSFileId.createFrom(sessionId, file.filePath)
        return await rootBlock.block.asBlockInfo(fileId)
    }

    public unloadFile(fileId: VCSFileId): void {
        this.files.delete(fileId.filePath)
    }

    public getFile(fileId: VCSFileId): SessionFile {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath)!.file
        } else {
            throw new Error("File appears to not have been loaded!")
        }
    }

    public async getBlock(blockId: VCSBlockId): Promise<SessionBlock> {
        const id = blockId.blockId
        if (this.blocks.has(id)) {
            return this.blocks.get(id)!
        } else {
            const block = await this.getSessionBlockFor(blockId)
            if (!block) { throw new Error(`Cannot find block for provided block id "${id}"`) }
            this.blocks.set(id, block)
            return block
        }
    }

    public async getTag(tagId: VCSTagId): Promise<SessionTag> {
        const id = tagId.tagId
        if (this.tags.has(id)) {
            return this.tags.get(id)!
        } else {
            const tag = await this.getSessionTagFor(tagId)
            if (!tag) { throw new Error(`Cannot find tag for provided tag id "${id}"`) }
            this.tags.set(id, tag)
            return tag
        }
    }

    public getRootBlockFor(fileId: VCSFileId): SessionBlock {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath)!
        } else {
            throw new Error(`Cannot return root block for unloaded file ${filePath}!`)
        }
    }

    public async createQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: this, data: RequestData) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        return this.queries.createQuery(request, queryType, query)
    }

    public async createQueryChain<RequestData, QueryResult>(chainId: string, request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: this, data: RequestData) => Promise<QueryResult>, onChainInterrupt: (session: this) => Promise<void>): Promise<VCSResponse<QueryResult>> {
        return this.queries.createQueryChain(chainId, request, queryType, query, onChainInterrupt)
    }

    public async delete(blockId: VCSBlockId): Promise<void> {
        const block = await this.getBlock(blockId)
        if (block.type === BlockType.ROOT) {
            this.unloadFile(blockId)
        } else {
            await this.deleteSessionBlock(block)
        }
    }

    public asId(): VCSSessionId {
        return new VCSSessionId(this.id)
    }

    public close(): void {
        this.resources.closeSession(this.asId())
    }
}

export class DBSession extends Session<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy> {

    public async createSessionFile(filePath: string | undefined, eol: string, content?: string): Promise<NewFileInfo<FileProxy, LineProxy, VersionProxy, BlockProxy>> {
        return await FileProxy.create(filePath, eol, content)
    }

    public async getRootSessionBlockFor(filePath: string): Promise<BlockProxy> {
        const rootBlock = await prismaClient.block.findFirst({
            where: {
                file: { filePath },
                type: BlockType.ROOT
            },
        })

        return rootBlock ? await this.getSessionBlockFrom(rootBlock) : undefined
    }

    public async getSessionBlockFrom(block: Block): Promise<BlockProxy> {
        return await BlockProxy.getFor(block)
    }

    public async getSessionBlockFor(blockId: VCSBlockId): Promise<BlockProxy | undefined> {
        const block = await prismaClient.block.findFirst({ where: { blockId: blockId.blockId } })
        return block ? await this.getSessionBlockFrom(block) : undefined
    }

    public async getSessionTagFrom(tag: Tag): Promise<TagProxy> {
        return await TagProxy.getFor(tag)
    }

    public async getSessionTagFor(tagId: VCSTagId): Promise<TagProxy> {
        const tag = await prismaClient.tag.findFirst({ where: { tagId: tagId.tagId } })
        return tag ? await this.getSessionTagFrom(tag) : undefined
    }

    public async deleteSessionBlock(block: BlockProxy): Promise<void> {
        await prismaClient.block.delete({ where: { id: block.id }})
    }

    public async getFileData(fileId: VCSFileId): Promise<VCSFileData> {
        const fileProxy = this.getFile(fileId)
        const file      = await prismaClient.file.findUniqueOrThrow({
            where:   { id: fileProxy.id },
            include: {
                lines: {
                    include: {
                        versions: {
                            orderBy: {
                                timestamp: "asc"
                            }
                        }
                    },
                    orderBy: {
                        order: "asc"
                    }
                },
                blocks: {
                    include: {
                        lines: {
                            select: {
                                id: true,
                                versions: {
                                    select: {
                                        id:        true,
                                        timestamp: true
                                    },
                                    orderBy: {
                                        timestamp: "asc"
                                    }
                                } 
                            },
                            orderBy: {
                                order: "asc"
                            }
                        },
                        head: true,
                        tags: {
                            orderBy: {
                                timestamp: "asc"
                            }
                        }
                    }
                }
            }
        })

        const fileData = new VCSFileData(file.id, fileId, file.eol)

        // map lines, add to file
        const lineData = new Map(file.lines.map((line, index) => [line.id, new VCSLineData(line.id, fileData, line.type, index)]))
        fileData.lines = Array.from(lineData.values())

        // map blocks, add to file -> lacks heads, parent, origin, tags
        const blockData    = new Map(file.blocks.map(block => [block.id, new VCSBlockData(block.id, block.blockId, fileData, block.type)]))
        const blocks       = Array.from(blockData.values())
        fileData.rootBlock = blocks.find(block => block.type === BlockType.ROOT)!
        fileData.blocks    = blocks

        // map versions, add to line -> lacks origin
        const versions = file.lines.flatMap(line => {
            const lineInfo    = lineData.get(line.id)
            lineInfo.versions = line.versions.map(version => {
                const sourceBlock = version.sourceBlockId ? blockData.get(version.sourceBlockId)! : undefined
                return new VCSVersionData(version.id, lineInfo, version.type, version.timestamp, version.isActive, version.content, sourceBlock, undefined)
            })
            return lineInfo.versions
        })
        const versionData = new Map(versions.map(version => [version.databaseId, version]))

        // complete versions with origin
        file.lines.forEach(line => line.versions.forEach(version => {
            if (version.originId) { versionData.get(version.id)!.origin = versionData.get(version.originId)! }
        }))

        // complete blocks with heads, origin, parent, and tags
        file.blocks.forEach(block => {
            const blockInfo     = blockData.get(block.id)!
            const headTimestamp = block.head.timestamp

            blockInfo.heads = new Map(block.lines.map(line => {
                const lineInfo = lineData.get(line.id)!
                const version  = line.versions.find((version, index, versions) => { return version.timestamp <= headTimestamp && (index + 1 < versions.length ? headTimestamp < versions[index + 1].timestamp : true) })!
                return [lineInfo, versionData.get(version.id)!]
            }))

            if (block.parentId) { blockInfo.parent = blockData.get(block.parentId)! }
            if (block.originId) { blockInfo.origin = blockData.get(block.originId)! }

            blockInfo.tags = block.tags.map(tag => new VCSTagData(tag.id, tag.tagId, blockInfo, tag.name, tag.timestamp, tag.code))
        })

        // return complete file data
        return fileData
    }
}

export enum QueryType {
    Silent,    // Queries that do not affect the database
    ReadOnly,
    ReadWrite
}

class Query<QueryData, QueryResult, SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>, Manager extends QueryManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>> {

    public readonly request:   VCSSessionRequest<QueryData>
    public readonly type:      QueryType

    private readonly manager: Manager
    private readonly query:   (session: QuerySession, data: QueryData) => Promise<QueryResult>

    private readonly promise: Promise<VCSResponse<QueryResult>>
    private          resolve: (value: VCSResponse<QueryResult> | PromiseLike<VCSResponse<QueryResult>>) => void
    private          reject:  (reason?: any) => void

    public get session():   QuerySession { return this.manager.session }
    public get requestId(): string       { return this.request.requestId }
    public get data():      QueryData    { return this.request.data }

    public constructor(manager: Manager, request: VCSSessionRequest<QueryData>, type: QueryType, query: (session: QuerySession, data: QueryData) => Promise<QueryResult>) {
        this.manager = manager
        this.request = request
        this.type    = type
        this.query   = query

        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve
            this.reject  = reject
        })
    }

    public getPromise(): Promise<VCSResponse<QueryResult>> {
        return this.promise
    }

    public execute(): void {

        this.manager.queryRunning(this)

        const requestId  = this.requestId
        this.query(this.session, this.data)
            .then(response => {
                this.manager.queryFinished(this)
                this.resolve({ requestId, response })
            })
            .catch((error: Error) => {
                throw error // handle errors in the backend for debugging
                this.manager.queryFinished(this)
                this.resolve({ requestId, error: error.message })
            })
    }
}

type AnyQuery<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>, Manager extends QueryManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>>        = Query<any, any, SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, Manager>
type AnyWaitingQuery<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>, Manager extends QueryManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>> = { requiredRequestId: string, query: AnyQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, Manager> }

class QueryManager<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>> {

    public readonly session: QuerySession

    private readonly waiting                                                                                                   = new Map<string, AnyWaitingQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, this>>()
    private readonly ready: AnyQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, this>[] = []
    private readonly running                                                                                                   = new Map<string, AnyQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, this>>()

    private readonly finishedRequestIds: string[] = []

    private currentQueryChain?:     string                              = undefined
    private breakingChainCallback?: (session: QuerySession) => Promise<void> = undefined

    public constructor(session: QuerySession) {
        this.session = session
    }

    private setWaiting(query: AnyQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, this>, requiredRequestId?: string): void {
        if (requiredRequestId) { this.waiting.set(query.requestId, { requiredRequestId, query }) }
        else                   { this.setReady(query) }
    }

    private setReady(query: AnyQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, this>): void {
        this.waiting.delete(query.requestId)
        this.ready.push(query)
    }

    private tryQueries(): void {
        const waitingQueries = Array.from(this.waiting.values())
        waitingQueries.forEach(({ requiredRequestId, query }) => {
            if (this.finishedRequestIds.includes(requiredRequestId)) {
                const index = this.finishedRequestIds.indexOf(requiredRequestId, 0)
                if (index >= 0) { this.finishedRequestIds.splice(index, 1) }
                this.setReady(query)
            }
        })

        if (this.ready.length > 0) {
            const firstType = this.ready[0].type 
            if (firstType === QueryType.ReadWrite) {
                this.ready[0].execute()
                this.ready.splice(0, 1)
            } else {
                while(this.ready.length > 0 && this.ready[0].type !== QueryType.ReadWrite) {
                    this.ready[0].execute()
                    this.ready.splice(0, 1)
                }
            }
        }
    }

    public createNewQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: QuerySession, data: RequestData) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        const newQuery = new Query(this, request, queryType, query)

        this.setWaiting(newQuery, request.previousRequestId)
        this.tryQueries()

        return newQuery.getPromise()
    }

    private startQueryChain(chainId: string, onChainInterrupt: (session: QuerySession) => Promise<void>): void {
        this.currentQueryChain     = chainId
        this.breakingChainCallback = onChainInterrupt
    }

    private async breakQueryChain(): Promise<void> {
        if (this.currentQueryChain !== undefined) {
            await this.breakingChainCallback(this.session)
            this.currentQueryChain     = undefined
            this.breakingChainCallback = undefined   
        }
    }

    public async createQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: QuerySession, data: RequestData) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        if (queryType === QueryType.ReadWrite) { await this.breakQueryChain() }
        return this.createNewQuery(request, queryType, query)
    }

    // WARNING: Right now, query chains are only interrupted by new chains of unchained readwrite queries, assuming that we can always read inbetween a chain!!!
    public async createQueryChain<RequestData, QueryResult>(chainId: string, request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: QuerySession, data: RequestData) => Promise<QueryResult>, onChainInterrupt: (session: QuerySession) => Promise<void>): Promise<VCSResponse<QueryResult>> {
        if (this.currentQueryChain !== chainId) {
            console.log("Start Chain: " + chainId)
            await this.breakQueryChain()
            this.startQueryChain(chainId, onChainInterrupt)
        }
        
        return this.createNewQuery(request, queryType, query)
    }

    public queryRunning(query: AnyQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, this>): void {
        this.waiting.delete(query.requestId)
        const index = this.ready.indexOf(query, 0)
        if (index >= 0) { this.ready.splice(index, 1) }
        this.running.set(query.requestId, query)
    }

    public queryFinished(query: AnyQuery<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession, this>): void {
        this.running.delete(query.requestId)
        this.finishedRequestIds.push(query.requestId)
        this.tryQueries()
    }
}

export class ResourceManager<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionLine, SessionVersion>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>> {

    private readonly sessionConstructor: new (manager: this) => QuerySession
    private readonly sessions = new Map<string, QuerySession>()

    public constructor(sessionConstructor: new (manager: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>) => QuerySession) {
        this.sessionConstructor = sessionConstructor
    }

    public createSession(): VCSSessionId {
        const session = new this.sessionConstructor(this)
        this.sessions.set(session.id, session)
        return session.asId()
    }

    public closeSession(sessionId: VCSSessionId): void {
        const id = sessionId.sessionId
        this.sessions.get(id)?.close()
        this.sessions.delete(id)
    }


    public getSessions(): QuerySession[] {
        return Array.from(this.sessions.values())
    }

    public async createQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: QuerySession, data: RequestData) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        let session: QuerySession

        try {
            session = this.getSession(request.sessionId)
        } catch (error) {
            let message: string
            if (error instanceof Error) { message = error.message }
            else                        { message = String(error) }
            return { requestId: request.requestId, error: message }
        }

        return session.createQuery(request, queryType, query)
    }

    public async createQueryChain<RequestData, QueryResult>(chainId: string, request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: QuerySession, data: RequestData) => Promise<QueryResult>, onChainInterrupt: (session: QuerySession) => Promise<void>): Promise<VCSResponse<QueryResult>> {
        let session: QuerySession

        try {
            session = this.getSession(request.sessionId)
        } catch (error) {
            let message: string
            if (error instanceof Error) { message = error.message }
            else                        { message = String(error) }
            return { requestId: request.requestId, error: message }
        }

        return session.createQueryChain(chainId, request, queryType, query, onChainInterrupt)
    }

    private getSession(sessionId: VCSSessionId): QuerySession {
        const id = sessionId.sessionId
        if (this.sessions.has(id)) {
            return this.sessions.get(id)!
        } else {
            throw new Error(`Requested session with ID "${id}" does not exist!`)
        }
    }

    /*
    private async loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        return await this.getSession(sessionId).loadFile(options)
    }

    private unloadFile(fileId: VCSFileId): void {
        this.getSession(fileId).unloadFile(fileId)
    }

    private getFile(fileId: VCSFileId): FileProxy {
        return this.getSession(fileId).getFile(fileId)
    }

    private async getBlock(blockId: VCSBlockId): Promise<BlockProxy> {
        return await this.getSession(blockId).getBlock(blockId)
    }

    private async getTag(tagId: VCSTagId): Promise<TagProxy> {
        return await this.getSession(tagId).getTag(tagId)
    }

    private getRootBlockFor(fileId: VCSFileId): BlockProxy {
        return this.getSession(fileId).getRootBlockFor(fileId)
    }
    */
}

export class DBResourceManager extends ResourceManager<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy, DBSession> {
    public constructor() { super(DBSession) }
}