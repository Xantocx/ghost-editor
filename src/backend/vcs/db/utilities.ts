import { BlockProxy, FileProxy, TagProxy } from "../db/types"
import { prismaClient } from "../db/client"
import { BlockType, Block, Tag } from "@prisma/client"
import { randomUUID } from "crypto"
import { VCSBlockId, VCSFileId, VCSFileLoadingOptions, VCSRootBlockInfo, VCSSessionId, VCSTagId } from "../../../app/components/vcs/vcs-rework"
import { VCSResponse, VCSSuccess, VCSError, VCSRequest } from "../../../app/components/vcs/vcs-rework"

export class Session {

    public readonly id = randomUUID()
    public readonly resources: ResourceManager

    private readonly files  = new Map<string, BlockProxy>() // this may be called files, but refers to the root block for each file - due to the implementation, this name makes most sense though
    private readonly blocks = new Map<string, BlockProxy>() // a cache for previously loaded blocks to speed up performance
    private readonly tags   = new Map<string, TagProxy>()

    public constructor(resourceManager: ResourceManager) {
        this.resources = resourceManager
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
        } else {
            const { file, rootBlock } = await FileProxy.create(options.filePath, options.eol, options.content)
            this.files.set(file.filePath, rootBlock.block)
            this.blocks.set(rootBlock.blockId, rootBlock.block)

            const fileId = VCSFileId.createFrom(sessionId, file.filePath)
            return await rootBlock.block.asBlockInfo(fileId)
        }
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

    public asId(): VCSSessionId {
        return new VCSSessionId(this.id)
    }

    public close(): void {
        // does not do anything right now
    }
}

enum QueryType {
    ReadOnly,
    ReadWrite
}

class Query<QueryResult> {

    public readonly requestId: string
    public readonly type:      QueryType

    private readonly manager: QueryManager
    private readonly query:   (session: Session) => Promise<QueryResult>

    private readonly promise: Promise<VCSResponse<QueryResult>>
    private          resolve: (value: VCSResponse<QueryResult> | PromiseLike<VCSResponse<QueryResult>>) => void
    private          reject:  (reason?: any) => void

    public constructor(manager: QueryManager, requestId: string, type: QueryType, query: (session: Session) => Promise<QueryResult>) {
        this.manager   = manager
        this.requestId = requestId
        this.type      = type
        this.query     = query

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
        this.query(this.manager.session)
            .then(response => {
                this.resolve({ requestId, response })
            })
            .catch((error: Error) => {
                this.resolve({ requestId, error: error.message })
            })
    }
}

class QueryManager {

    public readonly session: Session

    private readonly waiting               = new Map<string, { requiredRequestId: string, query: Query<any> }>
    private readonly ready:   Query<any>[] = []
    private readonly running               = new Map<string, Query<any>>

    private readonly finishedRequestIds: string[] = []

    public constructor(session: Session) {
        this.session = session
    }

    private setWaiting(query: Query<any>, requiredRequestId?: string): void {
        if (requiredRequestId) { this.waiting.set(query.requestId, { requiredRequestId, query }) }
        else                   { this.setReady(query) }
    }

    private setReady(query: Query<any>): void {
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

    public async execute<RequestData, QueryResult>(request: VCSRequest<RequestData>, queryType: QueryType, query: (session: Session) => Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        const newQuery = new Query(this, request.requestId, queryType, query)

        this.setWaiting(newQuery, request.previousRequestId)
        this.tryQueries()

        return newQuery.getPromise()
    }

    public queryRunning(query: Query<any>): void {
        this.waiting.delete(query.requestId)
        const index = this.ready.indexOf(query, 0)
        if (index >= 0) { this.ready.splice(index, 1) }
        this.running.set(query.requestId, query)
    }

    public queryFinished(query: Query<any>): void {
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

    public getSession(sessionId: VCSSessionId): Session {
        const id = sessionId.sessionId
        if (this.sessions.has(id)) {
            return this.sessions.get(id)!
        } else {
            throw new Error(`Requested session with ID "${id}" does not exist!`)
        }
    }

    public getSessions(): Session[] {
        return Array.from(this.sessions.values())
    }

    public async loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        return await this.getSession(sessionId).loadFile(options)
    }

    public unloadFile(fileId: VCSFileId): void {
        this.getSession(fileId).unloadFile(fileId)
    }

    public getFile(fileId: VCSFileId): FileProxy {
        return this.getSession(fileId).getFile(fileId)
    }

    public async getBlock(blockId: VCSBlockId): Promise<BlockProxy> {
        return await this.getSession(blockId).getBlock(blockId)
    }

    public async getTag(tagId: VCSTagId): Promise<TagProxy> {
        return await this.getSession(tagId).getTag(tagId)
    }

    public getRootBlockFor(fileId: VCSFileId): BlockProxy {
        return this.getSession(fileId).getRootBlockFor(fileId)
    }

    /*

    private async createSessionFromBlock(block: BlockProxy): Promise<SessionInfo> {

    }

    private async createSessionFromTag(tag: TagProxy): Promise<SessionInfo> {
        
    }

    private async createSession(options: SessionCreationOptions): Promise<SessionInfo> {
        const { file, rootBlock } = await FileProxy.create(options.filePath, options.eol, options.content)
        // Session.create
    }

    
    private async loadSession(options: SessionLoadingOptions): Promise<SessionInfo> {
        const filePath = options.filePath
        const blockId  = options.blockId
        const tagId    = options.tagId

        if (tagId) {
            const tag = await prismaClient.tag.findFirstOrThrow({ 
                where:   { tagId: tagId },
                include: { 
                    block: { 
                        include: {
                            file: true
                        }
                    } 
                }
            })

            const block = tag.block
            const file  = block.file

            if (filePath && file.filePath !== filePath) { throw new Error("The provided file path and the file the provided tag id belongs to do not match.") }
            if (blockId  && block.blockId !== blockId)  { throw new Error("Currently, we do not support the application of tags to blocks other than the ones they were created in.") }

            // TODO: Session.create
        } else if (blockId) {
            const block = await prismaClient.block.findFirstOrThrow({
                where:   { blockId: blockId },
                include: { file: true }
            })

            if (filePath && block.file.filePath !== filePath) { throw new Error("The provided file path and the file the provided tag id belongs to do not match.") }

            // TODO: Session.create
        } else if (filePath) {
            const block = await prismaClient.block.findFirstOrThrow({ where: { file: { filePath }, type: BlockType.ROOT } })
            // TODO: Session.create
        }
    }

    public async startSession(options: SessionOptions): Promise<SessionInfo> {
        if      (options as SessionCreationOptions) { return await this.createSession(options as SessionCreationOptions) }
        else if (options as SessionLoadingOptions)  { return await this.loadSession(options as SessionLoadingOptions) }
        else                                        { throw new Error("Options do not have correct format!") }
    }
    */
}