import { AppDataSource } from "../../db/data-source"
import { SessionId, BlockId, TagId, SessionIdManager, BlockIdManager, TagIdManager, GhostId } from "../core/metadata/ids"
import { Session } from "./session"
import { Block } from "../core/block"
import { Tag } from "../core/tag"
import { Repository } from "typeorm"

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

    /*
    private readonly sessions = new Map<SessionId, Session>()
    private readonly blocks   = new Map<BlockId, Block>()
    private readonly tags     = new Map<TagId, Tag>()
    */

    private readonly sessionRepository: Repository<Session>
    private readonly blockRepository:   Repository<Block>
    private readonly tagRepository:     Repository<Tag>

    private readonly sessionIdManager: SessionIdManager
    private readonly blockIdManager:   BlockIdManager
    private readonly tagIdManagers    = new Map<Block, TagIdManager>()

    //public get blockIds(): BlockId[] { return Array.from(this.blocks.keys()) }
    //public get tagIds():   TagId[]   { return Array.from(this.tags.keys()) }

    public constructor() {
        this.sessionRepository = AppDataSource.getRepository(Session)
        this.blockRepository   = AppDataSource.getRepository(Block)
        this.tagRepository     = AppDataSource.getRepository(Tag)

        const idRepository = AppDataSource.getRepository(GhostId)

        this.sessionIdManager = new SessionIdManager(idRepository)
        this.blockIdManager   = new BlockIdManager(idRepository)
        this.tagRepository.find().then(tags => 
            tags.forEach(tag => 
                this.tagIdManagers.set(tag.block, new TagIdManager(idRepository, tag.block))
            )
        )
    }

    private validateSession(session: Session): boolean { return ResourceValidation.create("Session", session.id !== undefined, this.hasSession(session.id), this.getSession(session.id) === session).evaluate() }
    private validateBlock(block: Block):       boolean { return ResourceValidation.create("Block", block.id !== undefined, this.hasBlock(block.id), this.getBlock(block.id) === block).evaluate() }
    private validateTag(tag: Tag):             boolean { return ResourceValidation.create("Tag", tag.id !== undefined, this.hasTag(tag.id), this.getTag(tag.id) === tag).evaluate() }

    private async newSessionId(session: Session):                     Promise<SessionId> { return await this.sessionIdManager.newId(session) }
    private async newBlockId(block: Block):                           Promise<BlockId>   { return await this.blockIdManager.newId(block) }
    private async newFilePathBlockId(filePath: string, block: Block): Promise<BlockId>   { return await this.blockIdManager.newIdFromFilePath(filePath, block) }
    private async newTagId(block: Block, tag: Tag):                   Promise<TagId>     {
        if (this.hasBlock(block.id)) { return await this.tagIdManagers.get(block)!.newId(tag) }
        else                         { throw new Error("This ResourceManager does not contain the Block required for this Tag!") }
    }

    /*
    public hasSession(sessionId: SessionId): boolean { return this.sessions.has(sessionId) }
    public hasBlock(blockId: BlockId):       boolean { return this.blocks.has(blockId) }
    public hasTag(tagId: BlockId):           boolean { return this.tags.has(tagId) }
    */

    public async getSession(sessionId: SessionId): Promise<Session | undefined> { return await this.sessionRepository.get(sessionId) }
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