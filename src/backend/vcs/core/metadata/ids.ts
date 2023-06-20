import { Entity, OneToOne, PrimaryColumn, JoinColumn, PrimaryGeneratedColumn, Relation, Repository } from "typeorm"
import { Block } from "../block"
import { Session } from "../../utils/session"
import { Tag } from "../tag"
import { SubscriptionManager } from "../../../../editor/ui/widgets/subscription-manager"

export class GhostResource extends SubscriptionManager {

    @PrimaryGeneratedColumn()
    public databaseId: number

    @OneToOne(() => GhostId, (id: GhostId) => id.resource, { cascade: true })
    @JoinColumn()
    public id: Relation<GhostId>
}

@Entity()
export class GhostId {

    @PrimaryColumn("text")
    public string: string

    @OneToOne(() => GhostResource, (resource: GhostResource) => resource.id, { cascade: true })
    public resource: Relation<GhostResource>

    public constructor(id: string, resource: GhostResource) {
        this.string = id
        resource.id = this
    }
}

export type SessionId = GhostId
export type BlockId   = GhostId
export type TagId     = GhostId

export class GhostIdManager {

    protected repository: Repository<GhostId>

    private nextId = 0

    public constructor(repository: Repository<GhostId>) {
        this.repository = repository
    }

    protected getNextId(): string {
        const id = `${this.nextId}`
        this.nextId++
        return id
    }

    protected async formatId(id: string, resource: GhostResource): Promise<GhostId> {
        const ghostId = new GhostId(`ghost/${id}`, resource)
        await this.repository.save(ghostId)
        return ghostId
    }

    public async newId(resource: GhostResource): Promise<GhostId> {
        return await this.formatId(this.getNextId(), resource)
    }
}

export class SessionIdManager extends GhostIdManager {
    protected override async formatId(id: string, session: Session): Promise<SessionId> {
        return await super.formatId(`session/${id}`, session)
    }
}

export class BlockIdManager extends GhostIdManager {

    private filePaths = new Map<string, BlockId>()

    protected override async formatId(id: string, block: Block): Promise<BlockId> {
        return await super.formatId(`block/${id}`, block)
    }

    private async filePathToId(filePath: string, block: Block): Promise<BlockId> {
        return await this.formatId(`file/${filePath}`, block)
    }

    public getIdForFilePath(filePath: string): BlockId | undefined {
        return this.filePaths.get(filePath)
    }

    public getFilePathForId(id: BlockId): string | undefined {
        for (let [filePath, blockId] of this.filePaths) {
            if (blockId === id) { return filePath }
        }
        return undefined
    }

    public async newIdFromFilePath(filePath: string, block: Block): Promise<BlockId> {
        if (this.filePaths.has(filePath)) { throw new Error("This file path was already used to create a BlockId!") }
        const id = await this.filePathToId(filePath, block)
        this.filePaths.set(filePath, id)
        return id
    }

    public async newIdFromOrigin(origin: Block, clone: Block): Promise<BlockId> {
        return await this.formatId(`origin/${origin.id}/clone/${this.getNextId()}`, clone)
    }
}

export class TagIdManager extends GhostIdManager {

    public readonly block: Block

    public constructor(repository: Repository<GhostId>, block: Block) {
        super(repository)
        this.block = block
    }

    protected override async formatId(id: string, tag: Tag): Promise<TagId> {
        const ghostId = new GhostId(this.block.id + `/tag/${id}`, tag)
        await this.repository.save(ghostId)
        return ghostId
    }
}