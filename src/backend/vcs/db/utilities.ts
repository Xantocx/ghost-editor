import { SessionCreationOptions, SessionData, SessionInfo, SessionLoadingOptions, SessionOptions } from "../../../app/components/vcs/vcs-provider"
import { BlockProxy, FileProxy, TagProxy } from "../db/types"
import { prismaClient } from "../db/client"
import { BlockType, Block, Tag } from "@prisma/client"
import { randomUUID } from "crypto"
import { BlockId, FileId, FileLoadingOptions, RootBlockInfo, SessionId } from "../../../app/components/vcs/vcs-rework"

export class Session {

    public readonly id = randomUUID()
    public readonly resources: ResourceManager

    private readonly files  = new Map<string, BlockProxy>() // this may be called files, but refers to the root block for each file - due to the implementation, this name makes most sense though
    private readonly blocks = new Map<string, BlockProxy>() // a cache for previously loaded blocks to speed up performance

    public constructor(resourceManager: ResourceManager) {
        this.resources = resourceManager
    }

    public async loadFile(options: FileLoadingOptions): Promise<RootBlockInfo> {
        const sessionId = this.asId()

        if (options.filePath !== undefined) {
            const filePath = options.filePath!
            const fileId   = FileId.createFrom(sessionId, filePath)

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

            const fileId = FileId.createFrom(sessionId, file.filePath)
            return await rootBlock.block.asBlockInfo(fileId)
        }
    }

    public unloadFile(fileId: FileId): void {
        this.files.delete(fileId.filePath)
    }

    public getFile(fileId: FileId): FileProxy {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath)!.file
        } else {
            throw new Error("File appears to not have been loaded!")
        }
    }

    public async getBlock(blockId: BlockId): Promise<BlockProxy> {
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

    public getRootBlockFor(fileId: FileId): BlockProxy {
        const filePath = fileId.filePath
        if (this.files.has(filePath)) {
            return this.files.get(filePath)!
        } else {
            throw new Error(`Cannot return root block for unloaded file ${filePath}!`)
        }
    }

    public asId(): SessionId {
        return new SessionId(this.id)
    }

    public close(): void {
        // does not do anything right now
    }
}

export class ResourceManager {

    private readonly sessions = new Map<string, Session>()

    public createSession(): SessionId {
        const session = new Session(this)
        this.sessions.set(session.id, session)
        return session.asId()
    }

    public closeSession(sessionId: SessionId): void {
        const id = sessionId.sessionId
        this.sessions.get(id)?.close()
        this.sessions.delete(id)
    }

    public getSession(sessionId: SessionId): Session {
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

    public async loadFile(sessionId: SessionId, options: FileLoadingOptions): Promise<RootBlockInfo> {
        return await this.getSession(sessionId).loadFile(options)
    }

    public unloadFile(fileId: FileId): void {
        this.getSession(fileId).unloadFile(fileId)
    }

    public getFile(fileId: FileId): FileProxy {
        return this.getSession(fileId).getFile(fileId)
    }

    public async getBlock(blockId: BlockId): Promise<BlockProxy> {
        return await this.getSession(blockId).getBlock(blockId)
    }

    public getRootBlockFor(fileId: FileId): BlockProxy {
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