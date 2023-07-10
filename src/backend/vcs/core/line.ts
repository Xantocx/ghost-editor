import { LinkedListNode } from "../utils/linked-list"
import { BlockId } from "./metadata/ids"
import { Timestamp, TimestampProvider } from "./metadata/timestamps"
import { LineContent, LineNodeVersion } from "./version"
import { LineNodeHistory, LineHistory } from "./history"
import { LinePosition, LineNumber, Block, InlineBlock, ForkBlock } from "./block"
import { ISessionLine } from "../db/utilities"

export enum LineType { 
    Original,
    Inserted
}

interface LineNodeRelations {
    previous?:    LineNode | undefined
    next?:        LineNode | undefined
    knownBlocks?: Block[]
}

// TODO: FIND WAY TO ALLOW FOR INDIVIDUAL TIMETRAVEL + EDITS WITH WORKING FUNCTIONALITY
// This most likely requires merging the headTracking property somehow across all Lines of a LineNode, or reapplying old changes if they do not match the head anymore
export class LineNode extends LinkedListNode<LineNode> implements ISessionLine {

    public          originBlock: Block
    public readonly lineType:    LineType
    public readonly versions:    LineNodeHistory

    public readonly lines        = new Map<Block, Line>()
    public readonly headTracking = new Map<Timestamp, LineNodeVersion>()

    public get isOriginal(): boolean { return this.lineType === LineType.Original }
    public get isInserted(): boolean { return this.lineType === LineType.Inserted }

    public get firstVersion(): LineNodeVersion { return this.versions.firstVersion }
    public get lastVersion():  LineNodeVersion { return this.versions.lastVersion }

    public get originLine(): Line { return this.getLine(this.originBlock) }

    public constructor(originBlock: Block, lineType: LineType, content: LineContent, relations?: LineNodeRelations) {
        super()

        this.originBlock = originBlock
        this.lineType    = lineType
        this.versions    = new LineNodeHistory()

        // guaranteing that the line list is coherent before creating Line mirrors
        if (relations) {
            this.previous = relations.previous
            this.next     = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }

        // This makes sure the line exists and caries the necessary versions
        const originLine = new Line(this, originBlock, { content })
        this.lines.set(originBlock, originLine)

        // TODO: I really don't like the use of a head input in this function as it might lead another programmer to the assumption that you can set the head using this function, but I couldn't think of any better way yet...
        relations?.knownBlocks?.forEach(block => this.addBlock(block, this.firstVersion))
    }

    public getLastTimestamp(): Timestamp { return TimestampProvider.getLastTimestamp() }
    public getNewTimestamp():  Timestamp { return TimestampProvider.getTimestamp() }

    public getPosition():               LinePosition           { return this.getAbsoluteIndex() }
    public getLineNumber(block: Block): LineNumber | undefined { return this.getLine(block)?.getLineNumber() }

    public has(block: Block):        boolean                 { return this.lines.has(block) }
    public getLine(block: Block):    Line | undefined        { return this.lines.get(block) }
    public getHistory(block: Block): LineHistory | undefined { return this.getLine(block)?.history }

    public getBlocks():   Block[]           { return Array.from(this.lines.keys()) }
    public getAffectedBlockIds(): BlockId[] { return this.getBlocks().map(block => block.id) }

    // magic for VCS interface
    public async getBlockIds(): Promise<string[]> { return this.getAffectedBlockIds() }

    public getVersions(): LineNodeVersion[] { return this.versions.getVersions() }

    public getTrackedTimestamps(): Timestamp[] { return Array.from(this.headTracking.keys()) }

    public getLatestTracking(): { timestamp: Timestamp, version: LineNodeVersion } | undefined  {
        const timestamps = this.getTrackedTimestamps()
        const lastTimestamp = timestamps[timestamps.length - 1]
        return { timestamp: lastTimestamp, version: this.headTracking.get(lastTimestamp) }
    }

    public updateHeadTracking(head: LineNodeVersion): void {
        const latestTracking = this.getLatestTracking()
        if (latestTracking.timestamp > head.timestamp || latestTracking.version !== head) {
            this.headTracking.set(this.getNewTimestamp(), head)
        }
    }

    public addBlock(block: Block, head?: LineNodeVersion): Line {
        const currentLine = this.getLine(block)
        if (currentLine) { return currentLine }

        if (block instanceof InlineBlock) {
            const parentLine = this.addBlock(block.parent!, head)
            this.lines.set(block, parentLine)
            return parentLine
        } else if (block instanceof ForkBlock) {
            const headLine = block.origin ? this.getLine(block.origin) : (block.parent ? this.getLine(block.parent) : this.originLine)
            head           = head ? head : headLine.currentVersion
            const line     = new Line(this, block, { head })
            this.lines.set(block, line)
            return line
        } else {
            throw new Error("The provided Block has an unknown subclass and cannot be added!")
        }
    }

    public removeBlock(block: Block, deleting?: boolean): Block[] {
        if (block === this.originBlock) {
            // TODO: Test this behaviour
            if (block.parent) { 
                this.addBlock(block.parent!)
                this.originBlock = block.parent!
            }
            else { 
                this.delete()
            }
        } else if (deleting) {
            return this.lines.delete(block) ? [block] : []
        }
    }

    public delete(): Block[] {
        const blocks = this.getBlocks()
        this.remove()
        return blocks
    }
}

interface LineRelations {
    previous?:    Line | undefined
    next?:        Line | undefined
    knownBlocks?: Block[]
}

export class Line extends LinkedListNode<Line>  {

    public readonly node:    LineNode
    public readonly block:   Block
    public readonly history: LineHistory

    public get previous(): Line | undefined { return this.node.previous?.getLine(this.block) }
    public get next():     Line | undefined { return this.node.next?.getLine(this.block) }

    public set previous(line: Line | undefined) { this.node.previous = line?.node }
    public set next    (line: Line | undefined) { this.node.next     = line?.node }

    public get versions(): LineNodeHistory { return this.node.versions }

    public get lineType():   LineType { return this.node.lineType }
    public get isOriginal(): boolean  { return this.node.isOriginal }
    public get isInserted(): boolean  { return this.node.isInserted }

    public get isActive():       boolean     { return this.history.isActive }
    public get currentVersion(): LineNodeVersion { return this.history.head }
    public get currentContent(): LineContent { return this.currentVersion.content }

    public static create(originBlock: Block, lineType: LineType, content: LineContent, relations?: LineRelations): Line {
        return new LineNode(originBlock, lineType, content, {
            previous:    relations?.previous?.node,
            next:        relations?.next?.node,
            knownBlocks: relations?.knownBlocks
        }).getLine(originBlock)
    }

    public constructor(node: LineNode, block: Block, setup?: { content?: LineContent, head?: LineNodeVersion }) {
        super()
        this.node    = node
        this.block   = block
        this.history = new LineHistory(this, this.versions, setup)
    }

    public getPosition():         LinePosition { return this.node.getPosition() }
    public getVersionCount():     number       { return this.history.getVersionCount() }
    public getAffectedBlockIds(): BlockId[]    { return this.node.getAffectedBlockIds() }

    public getPreviousActiveLine(): Line | undefined { return this.findPreviousIn(this.block, line => line.isActive) }
    public getNextActiveLine():     Line | undefined { return this.findNextIn    (this.block, line => line.isActive) }

    public getLineNumber(): LineNumber | null { 
        if (!this.isActive) { return null }
        const previous = this.getPreviousActiveLine()
        return previous ? previous.getLineNumber() + 1 : 1
    }

    // Will only update head tracking for this one specific line
    public updateHeadTracking(): void {
        this.node.updateHeadTracking(this.history.head)
    }

    public loadTimestamp(timestamp: Timestamp): LineNodeVersion {
        return this.history.loadTimestamp(timestamp)
    }

    public update(content: LineContent): LineNodeVersion {
        if (content === this.currentContent) { return this.history.head }

        // TODO: always merge trailing whitespace versions -> when time-traveling between changes, this merging might not always result in the same end-state, but the difference is minor
        const previousContent             = this.currentVersion.previous?.content
        const previousContentEqual        = previousContent?.trimEnd() === this.currentContent.trimEnd()
        const onlyTrailingWhitespaceAdded = content.trimEnd()          === this.currentContent.trimEnd()
        const mergeWhitespace             = previousContent !== undefined && previousContentEqual && onlyTrailingWhitespaceAdded

        if      (mergeWhitespace)                           { return this.history.updateCurrentVersion(content) }
        else if (this.block.getLastModifiedLine() === this) { return this.history.updateCurrentVersion(content) }

        return this.history.createNewVersion(true, content)
    }

    public delete(): LineNodeVersion {
        return this.history.deleteLine()
    }

    public getLineFor(block: Block):                      Line | undefined { return this.node.getLine(block) }
    public addBlock(block: Block):                        Line             { return this.node.addBlock(block) }
    public removeBlock(block: Block, deleting?: boolean): Block[]          { return this.node.removeBlock(block, deleting) }
}
