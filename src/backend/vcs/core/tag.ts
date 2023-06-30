import { Resource, ResourceManager } from "../utils/resource-manager"
import { TagId, BlockId } from "./metadata/ids"
import { Block } from "./block"
import { Line } from "./line"
import { LineNodeVersion } from "./version"
import { Timestamp } from "./metadata/timestamps"
import { VCSTag } from "../../../app/components/vcs/vcs-provider-old"

export class Tag implements Resource {

    public readonly id:    TagId
    public readonly block: Block

    public timestamp: Timestamp

    public readonly name: string
    public readonly code: string

    public get manager(): ResourceManager { return this.block.manager }
    public get blockId(): BlockId         { return this.block.id }

    constructor(block: Block, timestamp: Timestamp) {
        this.block     = block
        this.timestamp = timestamp

        this.name = `Version ${this.block.tags.size + 1}`
        this.code = this.block.getFullText()

        this.id = this.manager.registerTag(this)
    }

    public applyTo(block: Block): void {
        block.forEach(line => { line.loadTimestamp(this.timestamp) })
    }

    public asTagData(): VCSTag {
        const parent = this
        return {
            blockId:             parent.blockId,
            id:                  parent.id,
            name:                parent.name,
            text:                parent.code,
            automaticSuggestion: false
        }
    }
}