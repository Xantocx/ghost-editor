import { SessionId, BlockId } from "../core/metadata/ids"
import { Resource, ResourceManager } from "./resource-manager"
import { Block, ForkBlock } from "../core/block"
import { SessionInfo, SessionData } from "../../../app/components/vcs/vcs-provider"

export { SessionInfo, SessionData }

export class Session implements Resource {

    public readonly manager: ResourceManager
    public readonly id:      SessionId

    public readonly block: Block

    public get blockId(): BlockId { return this.block.id }

    public static createWithNewBlock(manager: ResourceManager, eol: string, options?: { filePath?: string, content?: string }): Session {
        const block = new ForkBlock({ manager, eol, filePath: options?.filePath, content: options?.content })
        return new Session(block)
    }

    public static createFromBlock(block: Block): Session {
        return new Session(block)
    }

    public constructor(block: Block) {
        this.manager = block.manager
        // TODO: there might be a cleverer way for this decision, if a free copy of an InlineBlock is still available, for example (content check is required in this case!)
        this.block   = block instanceof ForkBlock && !this.manager.hasSessionForBlockId(block.id) ? block : block.clone()

        this.id = this.manager.registerSession(this)
    }

    public getData(): SessionData {
        const parent = this
        return {
            content:   parent.block.getCurrentText(),
            snapshots: parent.block.getCompressedChildren()
        }
    }
}