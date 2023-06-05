import { Resource, ResourceManager } from "../utils/resource-manager"
import { TagId, BlockId } from "./metadata/ids"
import { Block } from "./block"
import { Line } from "./line"
import { LineNodeVersion } from "./version"

export class Tag implements Resource {

    public readonly id: TagId

    public readonly block:    Block
    public readonly versions: Map<Line, LineNodeVersion>

    public get manager(): ResourceManager { return this.block.manager }
    public get blockId(): BlockId         { return this.block.id }

    constructor(block: Block, versions?: Map<Line, LineNodeVersion>) {
        this.block    = block
        this.versions = versions ? versions : new Map<Line, LineNodeVersion>()

        this.id = this.manager.registerTag(this)
    }

    public has(line: Line): boolean {
        return this.versions.has(line)
    }

    public get(line: Line): LineNodeVersion {
        return this.versions.get(line)
    }

    public set(line: Line, version: LineNodeVersion): void {
        this.versions.set(line, version)
    }

    public delete(line: Line): boolean {
        return this.versions.delete(line)
    }

    public applyTo(block: Block): void {
        block.forEach(line => {
            if (this.has(line)) {
                this.get(line).apply(block)
            } else if (this.block?.contains(line)) {
                if (line.isInserted) { line.history.firstVersion.apply(block) }
                else                 { throw new Error("This tag does not allow for valid manipulation of this line. Potentially it was not defined correctly.") }
            }
        })
    }
}