import { Column, Entity, ManyToOne, Relation } from "typeorm"
import { ResourceManager } from "../utils/resource-manager"
import { TagId, BlockId, GhostResource } from "./metadata/ids"
import { Block } from "./block"
import { Line } from "./line"
import { LineNodeVersion } from "./version"
import { Timestamp } from "./metadata/timestamps"
import { VCSTag } from "../../../app/components/data/snapshot"

@Entity()
export class Tag extends GhostResource {

    @ManyToOne(() => Block, (block: Block) => block.tags, { cascade: true })
    public readonly block: Relation<Block>

    @Column()
    public timestamp: Timestamp

    @Column("text")
    public readonly name: string
    @Column("text")
    public readonly code: string

    public get manager(): ResourceManager { return this.block.manager }
    public get blockId(): BlockId         { return this.block.id }

    constructor(block: Block, timestamp: Timestamp) {
        super()

        this.block     = block
        this.timestamp = timestamp

        this.name = `Version ${this.block.tags.length + 1}`
        this.code = this.block.getFullText()

        this.id = this.manager.registerTag(this)
    }

    public applyTo(block: Block): void {
        block.forEach(line => { line.loadTimestamp(this.timestamp) })
    }

    public asTagData(): VCSTag {
        const parent = this
        return {
            blockId:             parent.blockId.string,
            id:                  parent.id.string,
            name:                parent.name,
            text:                parent.code,
            automaticSuggestion: false
        }
    }
}