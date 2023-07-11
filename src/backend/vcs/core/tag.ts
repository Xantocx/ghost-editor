import { Resource, ResourceManager } from "../utils/resource-manager"
import { TagId, BlockId } from "./metadata/ids"
import { Block } from "./block"
import { Line } from "./line"
import { LineNodeVersion } from "./version"
import { Timestamp } from "./metadata/timestamps"
import { VCSTag } from "../../../app/components/vcs/vcs-provider-old"
import { ISessionTag } from "../db/utilities"
import { VCSBlockId, VCSTagId, VCSTagInfo } from "../../../app/components/vcs/vcs-rework"

export class Tag implements Resource, ISessionTag {

    public readonly id:    TagId
    public readonly block: Block

    public timestamp: Timestamp

    public readonly name: string
    public readonly code: string

    public get blockId(): BlockId         { return this.block.id }

    constructor(block: Block, timestamp: Timestamp) {
        this.id        = 
        this.block     = block
        this.timestamp = timestamp

        this.name = `Version ${this.block.tags.size + 1}`
        this.code = this.block.getFullText()
    }

    public applyTo(block: Block): void {
        block.forEach(line => { line.loadTimestamp(this.timestamp) })
    }

    public asTagInfo(blockId: VCSBlockId): VCSTagInfo {
        return new VCSTagInfo(VCSTagId.createFrom(blockId, this.id), this.name, this.code, false)
    }
}