import { LinkedListNode } from "../utils/linked-list"
import { Timestamp } from "./metadata/timestamps"
import { Block } from "./block"
import { LineNode, Line } from "./line"
import { LineHistory, LineNodeHistory } from "./history"
import { Column, Entity, JoinColumn, OneToOne, Relation, OneToMany, ManyToOne } from "typeorm"

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

@Entity()
export class LineNodeVersion extends LinkedListNode<LineNodeVersion> {

    @OneToOne(() => LineNode)
    @JoinColumn()
    public readonly node: LineNode

    @Column()
    public readonly timestamp: Timestamp

    @Column()
    public readonly isActive: boolean

    @Column()
    public content: LineContent

    @ManyToOne(() => LineNodeVersion, (version: LineNodeVersion) => version.clones, { nullable: true })
    public readonly origin?: Relation<LineNodeVersion>

    @OneToMany(() => LineNodeVersion, (version: LineNodeVersion) => version.origin)
    private readonly clones: Relation<LineNodeVersion[]>

    public get versions(): LineNodeHistory { return this.node.versions }

    public get isClone(): boolean { return this.origin ? true : false }

    public get isFirst(): boolean { return this.versions.firstVersion === this }
    public get isLast():  boolean { return this.versions.lastVersion  === this }

    public get isPreInsertion(): boolean { return this.node.isInserted &&  this.isFirst }
    public get isDeletion():     boolean { return !this.isActive       && !this.isFirst }

    public constructor(node: LineNode, timestamp: Timestamp, isActive: boolean, content: LineContent, relations?: LineNodeVersionRelations) {
        super()

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

    public isHeadOf(block: Block): boolean { return this.getHistory(block).head === this }

    public isLatestVersion(block: Block): boolean {
        const trackedTimestamps = this.getHistory(block).getTrackedTimestamps()
        const greatestTrackedTimestamp = trackedTimestamps.length > 0 ? trackedTimestamps[trackedTimestamps.length - 1] : 0
        return this.isLast && this.timestamp >= greatestTrackedTimestamp
    }

    public insertionState(block: Block): InsertionState {

        const isPreInsertion = this.isPreInsertion
        const isDeletion     = this.isDeletion
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
    public update(content: LineContent): void { this.content = content }

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