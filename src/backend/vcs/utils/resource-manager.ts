import { SessionId, BlockId, TagId, SessionIdManager, BlockIdManager, TagIdManager, Identifiable } from "../core/metadata/ids"
import { Session } from "./session"
import { Block } from "../core/block"
import { Tag } from "../core/tag"
import { SessionCreationOptions, SessionInfo, SessionLoadingOptions, SessionOptions } from "../../../app/components/vcs/vcs-provider"
import { BlockProxy, FileProxy, TagProxy } from "../db/types"
import { prismaClient } from "../db/client"

export interface Resource extends Identifiable {}

enum ResourceState { Missing, Exists, Conflict }

class ResourceValidation {

    public readonly state:   ResourceState
    public readonly message?: string

    public static create(resourceName: string, hasId: boolean, idIsRegistered: boolean, idMatchesResource: boolean): ResourceValidation {
        if (hasId) {
            if (idIsRegistered) {
                if (idMatchesResource) {
                    return new ResourceValidation(ResourceState.Exists)
                } else {
                    return new ResourceValidation(ResourceState.Conflict, `A different ${resourceName} is already registered with this ID!`)
                }
            } else {
                return new ResourceValidation(ResourceState.Conflict, `A ${resourceName} can currently not be registered with two different ResourceManagers!`)
            }
        } else {
            return new ResourceValidation(ResourceState.Missing)
        }
    }

    private constructor(state: ResourceState, message?: string) {
        this.state   = state
        this.message = message
    }

    public evaluate(): boolean {
        if      (this.state === ResourceState.Missing)  { return true }
        else if (this.state === ResourceState.Exists)   { return false }
        else if (this.state === ResourceState.Conflict) { throw new Error(this.message ? this.message : "The current Resource is not compatiple with this ResourceManager!") }
        else                                            { throw new Error("This ResourceValidation is invalid and cannot be evaluated!") }
    }
}

export class ResourceManager {

    private readonly sessions = new Map<SessionId, Session>()
    private readonly blocks   = new Map<BlockId, Block>()
    private readonly tags     = new Map<TagId, Tag>()

    private readonly sessionIdManager = new SessionIdManager()
    private readonly blockIdManager   = new BlockIdManager()
    private readonly tagIdManagers    = new Map<Block, TagIdManager>()

    public get blockIds(): BlockId[] { return Array.from(this.blocks.keys()) }
    public get tagIds():   TagId[]   { return Array.from(this.tags.keys()) }

    public constructor(options?: { blocks?: Block[], tags?: Tag[] }) {
        options?.blocks?.forEach(block => this.registerBlock(block))
        options?.tags?.forEach(  tag   => this.registerTag(tag))
    }

    private validateSession(session: Session): boolean { return ResourceValidation.create("Session", session.id !== undefined, this.hasSession(session.id), this.getSession(session.id) === session).evaluate() }
    private validateBlock(block: Block):       boolean { return ResourceValidation.create("Block", block.id !== undefined, this.hasBlock(block.id), this.getBlock(block.id) === block).evaluate() }
    private validateTag(tag: Tag):             boolean { return ResourceValidation.create("Tag", tag.id !== undefined, this.hasTag(tag.id), this.getTag(tag.id) === tag).evaluate() }

    private newSessionId():                       SessionId { return this.sessionIdManager.newId() }
    private newBlockId():                         BlockId   { return this.blockIdManager.newId() }
    private newFilePathBlockId(filePath: string): BlockId   { return this.blockIdManager.newIdFromFilePath(filePath) }
    private newTagId(block: Block):               TagId     {
        if (this.hasBlock(block.id)) { return this.tagIdManagers.get(block)!.newId() }
        else                         { throw new Error("This ResourceManager does not contain the Block required for this Tag!") }
    }

    public hasSession(sessionId: SessionId): boolean { return this.sessions.has(sessionId) }
    public hasBlock(blockId: BlockId):       boolean { return this.blocks.has(blockId) }
    public hasTag(tagId: BlockId):           boolean { return this.tags.has(tagId) }

    public getSession(sessionId: SessionId): Session | undefined { return this.sessions.get(sessionId) }
    public getBlock(blockId: BlockId):       Block   | undefined { return this.blocks.get(blockId) }
    public getTag(tagId: TagId):             Tag     | undefined { return this.tags.get(tagId) }

    public hasSessionForBlockId(blockId: BlockId): boolean {
        const sessions = Array.from(this.sessions.values())
        return sessions.find(session => session.blockId === blockId) !== undefined
    }

    public getBlockIdForFilePath(filePath: string): BlockId | undefined {
        return this.blockIdManager.getIdForFilePath(filePath)
    }

    public getFilePathForBlock(block: Block): string | undefined {
        return this.blockIdManager.getFilePathForId(block.id)
    }

    public hasBlockForFilePath(filePath: string): boolean {
        const id = this.getBlockIdForFilePath(filePath)
        return id ? this.hasBlock(id) : false
    }

    public getBlockForFilePath(filePath: string): Block | undefined {
        const id = this.getBlockIdForFilePath(filePath)
        return id ? this.getBlock(id) : undefined
    }

    public registerSession(session: Session): SessionId {
        if (!this.validateSession(session)) { return }

        this.registerBlock(session.block)
        const id = this.newSessionId()
        this.sessions.set(id, session)
        return id
    }

    public registerBlock(block: Block, filePath?: string): BlockId {
        if      (!this.validateBlock(block)) { return } 
        else if (filePath && this.hasBlockForFilePath(filePath)) {
            throw new Error(`This BlockManager already knows a Block for the path ${filePath}!`)
        }

        const id = filePath ? this.newFilePathBlockId(filePath) : this.newBlockId()
        this.blocks.set(id, block)
        this.tagIdManagers.set(block, new TagIdManager(block))
        block.children.forEach(child => this.registerBlock(child))
        return id
    }

    public registerClonedBlock(block: Block): BlockId {
        if      (!this.validateBlock(block)) { return } 
        else if (!block.isCloned)            { throw new Error("This Block is not cloned, and can as such not be registered as a cloned Block!") }

        const id = this.blockIdManager.newIdFromOrigin(block.origin!)
        this.blocks.set(id, block)
        this.tagIdManagers.set(block, new TagIdManager(block))
        block.children.forEach(child => this.registerBlock(child))
        return id
    }

    public registerTag(tag: Tag): TagId {
        if (!this.validateTag(tag)) { return }

        this.registerBlock(tag.block)
        const id = this.newTagId(tag.block)
        this.tags.set(id, tag)
        return id
    }

    public closeSession(sessionId: SessionId): void {
        this.sessions.delete(sessionId)
    }
}



class DBResourceManager {

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
            const block = await prismaClient.block.findFirstOrThrow({ where:   { file: { filePath }, isRoot: true } })
            // TODO: Session.create
        }
    }

    public async startSession(options: SessionOptions): Promise<SessionInfo> {
        if      (options as SessionCreationOptions) { return await this.createSession(options as SessionCreationOptions) }
        else if (options as SessionLoadingOptions)  { return await this.loadSession(options as SessionLoadingOptions) }
        else                                        { throw new Error("Options do not have correct format!") }
    }
}