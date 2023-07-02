import { BlockProxy, FileProxy, TagProxy } from "../db/types"
import { prismaClient } from "../db/client"
import { BlockType, Block, Tag } from "@prisma/client"
import { randomUUID } from "crypto"
import { VCSBlockId, VCSFileId, VCSFileLoadingOptions, VCSRootBlockInfo, VCSSessionCreationRequest, VCSSessionId, VCSSessionRequest, VCSTagId } from "../../../app/components/vcs/vcs-rework"
import { VCSResponse } from "../../../app/components/vcs/vcs-rework"

export class Session {

    public readonly id = randomUUID()
    public readonly resources: ResourceManager
    public readonly queries:   QueryManager   // TODO: Move query manager to ResourceManager? How to handle the inaccessibility of request data otherwise... -> slower: every operation handled by the same queue

    private readonly files  = new Map<string, BlockProxy>() // this may be called files, but refers to the root block for each file - due to the implementation, this name makes most sense though
    private readonly blocks = new Map<string, BlockProxy>() // a cache for previously loaded blocks to speed up performance
    private readonly tags   = new Map<string, TagProxy>()

    public constructor(resourceManager: ResourceManager) {
        this.resources = resourceManager
        this.queries   = new QueryManager(this)
    }

    public async loadFile(options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        const sessionId = this.asId()

        if (options.filePath !== undefined) {
            const filePath = options.filePath!
            const fileId   = VCSFileId.createFrom(sessionId, filePath)

            if (this.files.has(filePath)) {
                return await this.files.get(filePath)!.asBlockInfo(fileId)
            } else {
                const sessions = this.resources.getSessions()
                if (sessions.some(session => session !== this && session.files.has(filePath))) {
                    throw new Error(`Cannot load file ${filePath}! Currently in use by another session.`)
                }

                const rootBlock = await prismaClient.block.findFirst({
                    where: {
                        file: { filePath },
                        type: BlockType.ROOT
                    },
                })

                if (rootBlock) {
                    const block = BlockProxy.createFrom(rootBlock)
                    this.files.set(filePath, block)
                    this.blocks.set(rootBlock.blockId, block)
                    return await block.asBlockInfo(fileId)
                }
            }
        }
        
        // in every other case:
        const { file, rootBlock } = await FileProxy.create(options.filePath, options.eol, options.content)
        this.files.set(file.filePath, rootBlock.block)
        this.blocks.set(rootBlock.blockId, rootBlock.block)

        const fileId = VCSFileId.createFrom(sessionId, file.filePath)
        return await rootBlock.block.asBlockInfo(fileId)
    }

    public unloadFile(fileId: VCSFileId): void {
        this.files.delete(fileId.filePath)
    }

    public getFile(fileId: VCSFileId): FileProxy {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath)!.file
        } else {
            throw new Error("File appears to not have been loaded!")
        }
    }

    public async getBlock(blockId: VCSBlockId): Promise<BlockProxy> {
        const id = blockId.blockId
        if (this.blocks.has(id)) {
            return this.blocks.get(id)!
        } else {
            const block = await prismaClient.block.findFirst({ where: { blockId: id } })
            if (!block) { throw new Error(`Cannot find block for provided block id "${id}"`) }

            const blockProxy = BlockProxy.createFrom(block)
            this.blocks.set(id, blockProxy)

            return blockProxy
        }
    }

    public async getTag(tagId: VCSTagId): Promise<TagProxy> {
        const id = tagId.tagId
        if (this.tags.has(id)) {
            return this.tags.get(id)!
        } else {
            const tag = await prismaClient.tag.findFirst({ where: { tagId: id } })
            if (!tag) { throw new Error(`Cannot find tag for provided tag id "${id}"`) }

            const tagProxy = TagProxy.createFrom(tag)
            this.tags.set(id, tagProxy)

            return tagProxy
        }
    }

    public getRootBlockFor(fileId: VCSFileId): BlockProxy {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath)!
        } else {
            throw new Error(`Cannot return root block for unloaded file ${filePath}!`)
        }
    }

    public async executeQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: Session, data: RequestData) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        return this.queries.executeQuery(request, queryType, query)
    }

    public asId(): VCSSessionId {
        return new VCSSessionId(this.id)
    }

    public close(): void {
        this.resources.closeSession(this.asId())
    }
}

export enum QueryType {
    ReadOnly,
    ReadWrite
}

class Query<QueryData, QueryResult> {

    public readonly request:   VCSSessionRequest<QueryData>
    public readonly type:      QueryType

    private readonly manager: QueryManager
    private readonly query:   (session: Session, data: QueryData) => Promise<QueryResult>

    private readonly promise: Promise<VCSResponse<QueryResult>>
    private          resolve: (value: VCSResponse<QueryResult> | PromiseLike<VCSResponse<QueryResult>>) => void
    private          reject:  (reason?: any) => void

    public get session():   Session   { return this.manager.session }
    public get requestId(): string    { return this.request.requestId }
    public get data():      QueryData { return this.request.data }

    public constructor(manager: QueryManager, request: VCSSessionRequest<QueryData>, type: QueryType, query: (session: Session, data: QueryData) => Promise<QueryResult>) {
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

type AnyQuery = Query<any, any>

class QueryManager {

    public readonly session: Session

    private readonly waiting           = new Map<string, { requiredRequestId: string, query: AnyQuery }>
    private readonly ready: AnyQuery[] = []
    private readonly running           = new Map<string, AnyQuery>

    private readonly finishedRequestIds: string[] = []

    public constructor(session: Session) {
        this.session = session
    }

    private setWaiting(query: AnyQuery, requiredRequestId?: string): void {
        if (requiredRequestId) { this.waiting.set(query.requestId, { requiredRequestId, query }) }
        else                   { this.setReady(query) }
    }

    private setReady(query: AnyQuery): void {
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
            if (this.ready[0].type === QueryType.ReadWrite) {
                this.ready[0].execute()
                this.ready.splice(0, 1)
            } else {
                while(this.ready.length > 0 && this.ready[0].type === QueryType.ReadOnly) {
                    this.ready[0].execute()
                    this.ready.splice(0, 1)
                }
            }
        }
    }

    public async executeQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: Session, data: RequestData) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        const newQuery = new Query(this, request, queryType, query)

        this.setWaiting(newQuery, request.previousRequestId)
        this.tryQueries()

        return newQuery.getPromise()
    }

    public queryRunning(query: AnyQuery): void {
        this.waiting.delete(query.requestId)
        const index = this.ready.indexOf(query, 0)
        if (index >= 0) { this.ready.splice(index, 1) }
        this.running.set(query.requestId, query)
    }

    public queryFinished(query: AnyQuery): void {
        this.running.delete(query.requestId)
        this.finishedRequestIds.push(query.requestId)
        this.tryQueries()
    }
}

export class ResourceManager {

    private readonly sessions = new Map<string, Session>()

    public createSession(): VCSSessionId {
        const session = new Session(this)
        this.sessions.set(session.id, session)
        return session.asId()
    }

    public closeSession(sessionId: VCSSessionId): void {
        const id = sessionId.sessionId
        this.sessions.get(id)?.close()
        this.sessions.delete(id)
    }


    public getSessions(): Session[] {
        return Array.from(this.sessions.values())
    }

    public async createQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: Session, data: RequestData) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        let session: Session

        try {
            session = this.getSession(request.sessionId)
        } catch (error) {
            let message: string
            if (error instanceof Error) { message = error.message }
            else                        { message = String(error) }
            return { requestId: request.requestId, error: message }
        }

        return session.executeQuery(request, queryType, query)
    }

    private getSession(sessionId: VCSSessionId): Session {
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