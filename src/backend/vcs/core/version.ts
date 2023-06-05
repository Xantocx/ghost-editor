import { Timestamp } from "./metadata/timestamps"
import { Block } from "./block"
import { LineNode, Line } from "./line"
import { LineHistory } from "./history"

export type LineContent = string

export enum InsertionState {
    Normal,
    PreInsertion,
    PreInsertionEngaged,
    PreInsertionReleased,
    Deletion
}

interface LineNodeVersionRelations {
    origin?:   LineNodeVersion | undefined
    previous?: LineNodeVersion | undefined
    next?:     LineNodeVersion | undefined
}

export class LineNodeVersion extends LinkedListNode<LineNodeVersion> {

    public readonly node: LineNode

    public readonly timestamp: Timestamp
    public readonly isActive:  boolean
    public          content:   LineContent

    public  readonly origin?: LineNodeVersion   = undefined
    private readonly clones:  LineNodeVersion[] = []

    public get isClone(): boolean { return this.origin ? true : false }

    public constructor(node: LineNode, timestamp: Timestamp, isActive: boolean, content: LineContent, relations?: LineNodeVersionRelations) {
        super(node.versions)

        this.node      = node
        this.timestamp = timestamp
        this.isActive  = isActive
        this.content   = content

        if (relations) {
            this.origin   = relations.origin
            this.previous = relations.previous
            this.next     = relations.next

            if (this.origin)   { this.origin.clones.push(this) }
            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public getLine(block: Block):    Line        { if (this.node.has(block)) { return this.node.getLine(block)! } else { throw new Error("There is no Line for the required block!") } }
    public getHistory(block: Block): LineHistory { return this.getLine(block).history }

    public isHeadOf(block: Block):  boolean { return this.getHistory(block).head         === this }
    public isFirstOf(block: Block): boolean { return this.getHistory(block).firstVersion === this }
    public isLastOf(block: Block):  boolean { return this.getHistory(block).lastVersion  === this }

    public isPreInsertion(block: Block): boolean { return this.getLine(block).isInserted && this.isFirstOf(block) }
    public isDeletion(block: Block):     boolean { return !this.isActive && !this.isFirstOf(block) }

    public isLatestVersion(block: Block): boolean {
        const trackedTimestamps = this.getHistory(block).getTrackedTimestamps()
        const greatestTrackedTimestamp = trackedTimestamps.length > 0 ? trackedTimestamps[trackedTimestamps.length - 1] : 0
        return this.isLastOf(block) && this.timestamp >= greatestTrackedTimestamp
    }

    public insertionState(block: Block): InsertionState {

        const isPreInsertion = this.isPreInsertion(block)
        const isDeletion     = this.isDeletion(block)
        const isHead         = this.isHeadOf(block)
        const nextIsHead     = this.next?.isHeadOf(block)

        if      (!isPreInsertion && !isDeletion)   { return InsertionState.Normal }
        else if (!isPreInsertion &&  isDeletion)   { return InsertionState.Deletion }
        else if ( isPreInsertion && !isDeletion)   {
            if  (!isHead         && !nextIsHead) { return InsertionState.PreInsertion }
            if  ( isHead         && !nextIsHead) { return InsertionState.PreInsertionEngaged }
            if  (!isHead         &&  nextIsHead) { return InsertionState.PreInsertionReleased }
            else                                             { throw new Error("Unexpected behaviour: Only one LineNodeVersion should be head at any given time!") }
        } else                                               { throw new Error("Unexpected behaviour: A LineNodeVersion should not be able to be pre-insertion and deletion at the same time!") }
    }

    public apply(block: Block):          void { this.getHistory(block).updateHead(this) }
    public update(content: LineContent): void {  this.content = content }

    public applyTo(block: Block): void {
        const currentLine = this.getLine(block)
        block.forEach(line => {
            if (line === currentLine) {
                this.apply(block)
            } else {
                line.loadTimestamp(this.timestamp)
            }
        })
    }

    public clone(timestamp: Timestamp, relations?: LineNodeVersionRelations): LineNodeVersion {
        if (!relations?.origin) { relations.origin = this }
        return new LineNodeVersion(this.node, timestamp, this.isActive, this.content, relations)
    }
}

// TODO: Maybe build this as a convenience wrapper in a similar style as I created NodeLines and Lines
export class LineVersion {

    public readonly nodeVersion: LineNodeVersion
    public readonly block:       Block

    public constructor(nodeVersion: LineNodeVersion, block: Block) {
        this.nodeVersion = nodeVersion
        this.block       = block
    }
}