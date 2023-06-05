import { SessionId, BlockId } from "../core/metadata/ids"
import { ResourceManager } from "./resource-manager"
import { Block, ForkBlock } from "../core/block"

export interface SessionInfo {
    sessionId: SessionId,
    blockId: BlockId,
    content: string
}

export class Session {

    public readonly sessionId: SessionId = crypto.randomUUID()
    public readonly block:     Block

    public get blockId(): BlockId { return this.block.id }

    public static createWithNewBlock(manager: ResourceManager, eol: string, options?: { filePath?: string, content?: string }): Session {
        const block = new ForkBlock({ manager, eol, filePath: options?.filePath, content: options?.content })
        return new Session(block)
    }

    public static createFromBlock(block: Block): Session {
        return new Session(block.clone())
    }

    public constructor(block: Block) {
        this.block = block
    }
}