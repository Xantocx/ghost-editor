import { SessionId, BlockId, TagId, SessionIdManager, BlockIdManager, TagIdManager } from "../core/metadata/ids"
import { Session } from "./session"
import { Block } from "../core/block"
import { Tag } from "../core/tag"

export class ResourceManager {

    private readonly sessions = new Map<SessionId, Session>
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

    private 
    private newBlockId():             BlockId { return this.formatBlockId(this.getNextBlockId()) }
    private newTagId(block: Block):   TagId   { return this.formatTagId(block, this.getNextTagId(block)) }

    private filePathToBlockId(filePath: string):                       BlockId { return this.formatBlockId(`file/${filePath}`) }
    public blockIdMatchesFilePath(blockId: BlockId, filePath: string): boolean { return blockId === this.filePathToBlockId(filePath) }

    public hasBlock(blockId: BlockId): boolean { return this.blocks.has(blockId) }
    public hasTag(tagId: BlockId):     boolean { return this.tags.has(tagId) }

    public getBlock(blockId: BlockId): Block | undefined { return this.blocks.get(blockId) }
    public getTag(tagId: TagId):       Tag   | undefined { return this.tags.get(tagId) }

    public hasBlockForFilePath(filePath: string): boolean           { return this.hasBlock(this.filePathToBlockId(filePath)) }
    public getBlockForFilePath(filePath: string): Block | undefined { return this.getBlock(this.filePathToBlockId(filePath)) }

    public registerBlock(block: Block, filePath?: string): BlockId {
        if (block.id) {
            if (this.hasBlock(block.id)) { 
                if (this.getBlock(block.id) === block) { return }
                else                                   { throw new Error("A different Block is already registered with this ID!") }
            } else                                     { throw new Error("A Block can currently not be registered with two different BlockManagers!") }
        } else if (filePath && this.hasBlockForFilePath(filePath)) {
            throw new Error(`This BlockManager already knows a Block for the path ${filePath}!`)
        }

        const id = filePath ? this.filePathToBlockId(filePath) : this.newBlockId()
        this.blocks.set(id, block)
        this.nextTagIds.set(block, 0)
        block.children.forEach(child => this.registerBlock(child))
        return id
    }

    public registerTag(tag: Tag): TagId {
        this.registerBlock(tag.block)
        const id = this.newTagId(tag.block)
        this.tags.set(id, tag)
        return id
    }
}