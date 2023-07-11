import { SessionId, BlockId, TagId } from "../core/metadata/ids"
import { Resource, ResourceManager } from "./resource-manager"
import { Block, ForkBlock, ForkBlockOptions } from "../core/block"
import { SessionInfo, SessionData } from "../../../app/components/vcs/vcs-provider-old"
import { Tag } from "../core/tag"

export { SessionInfo, SessionData }

export class Session implements Resource {

    public readonly manager: ResourceManager
    public readonly id:      SessionId

    public readonly block: Block
    public readonly tag?:  Tag

    public get blockId():  BlockId            { return this.block.id }
    public get tagId():    TagId  | undefined { return this.tag?.id }
    public get filePath(): string | undefined { return this.block.filePath }

    public static createFromOptions(options: ForkBlockOptions): Session {
        const block = new ForkBlock(options)
        return new Session(block)
    }

    public static createFromBlock(block: Block): Session {
        return new Session(block)
    }

    public static createFromTag(tag: Tag): Session {
        return new Session(tag.block, tag)
    }

    public constructor(block: Block, tag?: Tag) {
        this.manager = block.manager
        // TODO: there might be a cleverer way for this decision, if a free copy of an InlineBlock is still available, for example (content check is required in this case!)
        this.block   = block instanceof ForkBlock && !this.manager.hasSessionForBlockId(block.id) ? block : block.copy()
        this.tag     = tag
        this.id      = this.manager.registerSession(this)

        this.tag?.applyTo(block)
        if (this.tag) { block.onHeadChanged(timestamp => this.tag.timestamp = timestamp) }
    }

    public getInfo(): SessionInfo {
        const session = this
        return {
            sessionId:   session.id,
            blockId:     session.blockId,
            tagId:       session.tagId,
            filePath:    session.filePath,
            sessionData: session.getData()
        }
    }

    public getData(): SessionData {
        const parent = this
        return {
            content:     parent.block.getCurrentText(),
            fullContent: parent.block.getFullText(),
            snapshots:   parent.block.getCompressedChildren()
        }
    }
}