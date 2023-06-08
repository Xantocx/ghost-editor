import { Block } from "../block"

export type GhostId   = string
export type SessionId = GhostId
export type BlockId   = GhostId
export type TagId     = BlockId

export interface Identifiable {
    id: GhostId
}

abstract class IdManager<Id> {

    private nextId = 0

    protected getNextId(): string {
        const id = `${this.nextId}`
        this.nextId++
        return id
    }

    protected formatId(id: string): Id {
        throw new Error("Method not implemented.")
    }

    public newId(): Id {
        return this.formatId(this.getNextId())
    }
}

export class GhostIdManager extends IdManager<GhostId> {
    protected override formatId(id: string): GhostId {
        return `ghost/${id}`
    }
}

export class SessionIdManager extends GhostIdManager {
    protected override formatId(id: string): SessionId {
        return super.formatId(`session/${id}`)
    }
}

export class BlockIdManager extends GhostIdManager {

    private filePaths = new Map<string, BlockId>()

    protected override formatId(id: string): BlockId {
        return super.formatId(`block/${id}`)
    }

    private filePathToId(filePath: string): BlockId {
        return this.formatId(`file/${filePath}`)
    }

    public getFilePathId(filePath: string): BlockId | undefined {
        return this.filePaths.get(filePath)
    }

    public newIdFromFilePath(filePath: string): BlockId {
        if (this.filePaths.has(filePath)) { throw new Error("This file path was already used to create a BlockId!") }
        const id = this.filePathToId(filePath)
        this.filePaths.set(filePath, id)
        return id
    }

    public newIdFromOrigin(origin: Block): BlockId {
        return this.formatId(`origin/${origin.id}/clone/${this.getNextId()}`)
    }
}

export class TagIdManager extends IdManager<TagId> {

    public readonly block: Block

    public constructor(block: Block) {
        super()
        this.block = block
    }

    protected override formatId(id: string): TagId {
        return this.block.id + `/tag/${id}`
    }
}