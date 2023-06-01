import { BrowserWindow } from "electron"
import { VCSSnapshotData, VCSVersion } from "./src/app/components/data/snapshot"
import { IRange } from "./src/app/components/utils/range"
import { BasicVCSServer, SessionId, SessionOptions, SnapshotUUID } from "./src/app/components/vcs/vcs-provider"
import { LineChange, MultiLineChange } from "./src/app/components/data/change"
import * as crypto from "crypto"

type Timestamp = number
class TimestampProvider {

    private static nextTimestamp: Timestamp = 0

    public static setupNextTimestamp(timestamp: Timestamp): void {
        this.nextTimestamp = timestamp
    }

    public static getTimestamp(): Timestamp {
        const timestamp = this.nextTimestamp
        this.nextTimestamp++
        return timestamp
    }
}

abstract class LinkedListNode<Node extends LinkedListNode<Node>> {

    public readonly list?: LinkedList<Node>

    private _previous?: Node = undefined
    private _next?:     Node = undefined

    public get previous(): Node { return this._previous }
    public get next():     Node { return this._next }

    public set previous(node: Node) { this._previous = node }
    public set next    (node: Node) { this._next     = node }

    private get first(): Node | undefined { return this.list?.first }
    private get last():  Node | undefined { return this.list?.last }

    public get isFirst(): boolean { return this.isEqualTo(this.first) }
    public get isLast():  boolean { return this.isEqualTo(this.last) }

    public constructor(list?: LinkedList<Node>) {
        this.list = list
    }

    // hack to allow for comparison with this
    private isEqualTo(node: LinkedListNode<Node> | undefined): boolean { return this === node }

    public getIndex():             number { return this.previous && !this.isFirst ? this.previous.getIndex() + 1     : 0 }
    public getPreviousNodeCount(): number { return this.getIndex() }
    public getNextNodeCount():     number { return this.next     && !this.isLast  ? this.next.getNextNodeCount() + 1 : 0 }

    public getAbsoluteIndex(): number { return this.previous ? this.previous.getAbsoluteIndex() + 1 : 0 }

    public findPrevious(check: (previous: Node) => boolean): Node | undefined {
        let previous = this.previous

        while (previous && previous !== this.first) {
            if (check(previous)) { return previous }
            previous = previous.previous
        }

        return previous && previous === this.first && check(previous) ? previous : undefined
    }

    public findNext(check: (next: Node) => boolean): Node | undefined {
        let next = this.next

        while (next && next !== this.last) {
            if (check(next)) { return next }
            next = next.next
        }
        
        return next && next === this.last && check(next) ? next : undefined
    }

    public remove(): void {
        if (this.previous) { this.previous.next = this.next }
        if (this.next)     { this.next.previous = this.previous }
    }
}

abstract class LinkedList<Node extends LinkedListNode<Node>> {

    public first?: Node
    public last?:  Node

    public get hasFirst():      boolean { return this.first ? true : false }
    public get hasLast():       boolean { return this.last  ? true : false }
    public get isInitialized(): boolean { return this.hasFirst && this.hasLast }

    public getLength(): number  { return this.last.getIndex() + 1 }

    public contains(node: Node): boolean { 
        return this.find(testedNode => testedNode === node) ? true : false 
    }

    public forEach(callback: (node: Node, index: number) => void): void {
        let node = this.first
        let index = 0

        while (node && node !== this.last) {
            callback(node, index)
            node = node.next
            index++
        }

        if (node && node === this.last) { callback(this.last, index) }
    }

    public find(check: (node: Node, index: number) => boolean): Node | undefined {
        let node = this.first
        let index = 0

        while (node && node !== this.last) {
            if (check(node, index)) { return node }
            node = node.next
            index++
        }

        return node && node === this.last && check(this.last, index) ? this.last : undefined
    }

    public findReversed(check: (node: Node, index: number) => boolean): Node | undefined {
        let node  = this.last
        let index = node.getIndex()

        while (node && node !== this.first) {
            if (check(node, index)) { return node }
            node = node.previous
            index--
        }

        return node && node === this.first && check(node, index) ? node : undefined
    }

    public map<Mapped>(map: (node: Node, index: number, nodes: Node[]) => Mapped): Mapped[] {
        return this.toArray().map(map)
    }

    public flatMap<Mapped>(map: (node: Node, index: number, nodes: Node[]) => Mapped | Mapped[]): Mapped[] {
        return this.toArray().flatMap(map)
    }

    public filter(check: (node: Node, index: number, nodes: Node[]) => boolean): Node[] {
        return this.toArray().filter(check)
    }

    public toArray(): Node[] {
        const array: Node[] = []
        this.forEach(node => array.push(node))
        return array
    }
}

enum LineType { Original, Inserted }
type LineContent = string

interface LineRelations {
    previous?:    Line | undefined
    next?:        Line | undefined
    knownBlocks?: Block[]
}

interface BlockLineRelations {
    previous?:    BlockLine | undefined
    next?:        BlockLine | undefined
    knownBlocks?: Block[]
}

// TODO: FIND WAY TO ALLOW FOR INDIVIDUAL TIMETRAVEL + EDITS WITH WORKING FUNCTIONALITY
// This most likely requires merging the headTracking property somehow across all Lines of a BlockLine, or reapplying old changes if they do not match the head anymore
class BlockLine extends LinkedListNode<BlockLine> {

    public readonly originBlock: Block
    public readonly lineType:    LineType
    public readonly versions:    VersionHistory<LineVersion>

    public readonly lines = new Map<Block, Line>()

    public get isOriginal(): boolean  { return this.lineType === LineType.Original }
    public get isInserted(): boolean  { return this.lineType === LineType.Inserted }

    public get originLine(): Line { return this.getLine(this.originBlock) }

    public constructor(originBlock: Block, lineType: LineType, content: LineContent, relations?: BlockLineRelations) {
        super()

        this.originBlock = originBlock
        this.lineType    = lineType
        this.versions    = new VersionHistory<LineVersion>()

        const originLine = new Line(this, originBlock, { content })
        this.lines.set(originBlock, originLine)

        relations?.knownBlocks?.forEach(block => this.addBlock(block))

        if (relations) {
            this.previous = relations.previous
            this.next     = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public getPosition():               LinePosition           { return this.getAbsoluteIndex() }
    public getLineNumber(block: Block): LineNumber | undefined { return this.getLine(block)?.getLineNumber() }

    public has(block: Block):     boolean          { return this.lines.has(block) }
    public getLine(block: Block): Line | undefined { return this.lines.get(block) }

    public getBlocks():   Block[]   { return Array.from(this.lines.keys()) }
    public getBlockIds(): BlockId[] { return this.getBlocks().map(block => block.blockId) }

    public getVersions(): LineVersion[] { return this.versions.getVersions() }

    public addBlock(block: Block): Line {
        const currentLine = this.getLine(block)
        if (currentLine) { return currentLine }

        if (block instanceof InlineBlock) {
            const parentLine = this.getLine(block.parent!)
            this.lines.set(block, parentLine)
            return parentLine
        } else if (block instanceof ForkBlock) {
            const head = block.parent ? this.getLine(block.parent).currentVersion : this.originLine.currentVersion
            const line = new Line(this, block, { head })
            this.lines.set(block, line)
            return line
        } else {
            throw new Error("The provided Block has an unknown subclass and cannot be added!")
        }
    }

    public removeBlock(block: Block, deleting?: boolean): Block[] {
        if (block === this.originBlock) {
            return this.delete()
        } else if (deleting) {
            return this.lines.delete(block) ? [block] : []
        }
    }

    public delete(): Block[] {
        this.remove()
        return this.getBlocks()
    }
}

class Line extends LinkedListNode<Line>  {

    public readonly blockLine:  BlockLine
    public readonly block:      Block
    public readonly history:    LineHistory

    public get previous(): Line | undefined { return this.blockLine.previous?.getLine(this.block) }
    public get next():     Line | undefined { return this.blockLine.next?.getLine(this.block) }

    public set previous(line: Line | undefined) { this.blockLine.previous = line?.blockLine }
    public set next    (line: Line | undefined) { this.blockLine.next     = line?.blockLine }

    public get versions(): VersionHistory<LineVersion> { return this.blockLine.versions }

    public get lineType():   LineType { return this.blockLine.lineType }
    public get isOriginal(): boolean  { return this.blockLine.isOriginal }
    public get isInserted(): boolean  { return this.blockLine.isInserted }

    public get isActive():       boolean     { return this.history.isActive }
    public get currentVersion(): LineVersion { return this.history.head }
    public get currentContent(): LineContent { return this.currentVersion.content }

    public static create(originBlock: Block, lineType: LineType, content: LineContent, relations?: LineRelations): Line {
        return new BlockLine(originBlock, lineType, content, {
            previous:    relations?.previous?.blockLine,
            next:        relations?.next?.blockLine,
            knownBlocks: relations?.knownBlocks
        }).getLine(originBlock)
    }

    public constructor(blockLine: BlockLine, block: Block, setup?: { content?: LineContent, head?: LineVersion }) {
        super(block)

        this.blockLine = blockLine
        this.block    = block
        this.history  = new LineHistory(this, this.versions, setup)
    }

    public getPosition():         LinePosition { return this.blockLine.getPosition() }
    public getVersionCount():     number       { return this.history.getVersionCount() }
    public getAffectedBlockIds(): BlockId[]    { return this.blockLine.getBlockIds() }

    public getPreviousActiveLine(): Line | undefined { return this.findPrevious(line => line.isActive) }
    public getNextActiveLine():     Line | undefined { return this.findNext    (line => line.isActive) }

    public getLineNumber(): LineNumber | null { 
        if (!this.isActive) { return null }
        const previous = this.getPreviousActiveLine()
        return previous ? previous.getLineNumber() + 1 : 1
    }

    public loadTimestamp(timestamp: Timestamp): LineVersion {
        return this.history.loadTimestamp(timestamp)
    }

    public cloneCurrentVersion(): LineVersion {
        return this.history.cloneHeadToEnd()
    }

    public update(content: LineContent): LineVersion {
        if (content === this.currentContent)      { return this.history.head }
        if (this.block.getLastModifiedLine() === this) { return this.history.updateCurrentVersion(content) }
        return this.history.createNewVersion(true, content)
    }

    public delete(): LineVersion {
        return this.history.deleteLine()
    }

    public getLineFor(block: Block):                      Line | undefined { return this.blockLine.getLine(block) }
    public addBlock(block: Block):                        Line             { return this.blockLine.addBlock(block) }
    public removeBlock(block: Block, deleting?: boolean): Block[]          { return this.blockLine.removeBlock(block, deleting) }
}


class VersionHistory<Version extends LinkedListNode<Version>> extends LinkedList<Version> {

    public get firstVersion(): Version | undefined { return this.first }
    public get lastVersion():  Version | undefined { return this.last }

    public set firstVersion(line: Version) { this.first = line }
    public set lastVersion (line: Version) { this.last  = line }  
    
    public getVersions(): Version[] { return this.toArray() }
}


class LineHistory {

    public readonly line: Line
    public readonly versions: VersionHistory<LineVersion>

    private _head: LineVersion
    private headTracking = new Map<Timestamp, LineVersion>()

    public  get head(): LineVersion { return this._head }
    private set head(version: LineVersion) { this._head = version } 

    public get firstVersion(): LineVersion | undefined { return this.versions.firstVersion }
    public get lastVersion():  LineVersion | undefined { return this.versions.lastVersion }

    public set firstVersion(line: LineVersion) { this.versions.firstVersion = line }
    public set lastVersion (line: LineVersion) { this.versions.lastVersion  = line }

    public get isActive(): boolean  { return this.head.isActive }

    public constructor(line: Line, versions: VersionHistory<LineVersion>, setup?: { content?: LineContent, head?: LineVersion }) {
        this.line = line
        this.versions = versions

        const content = setup?.content
        const head    = setup?.head

        // empty strings count as "false"
        if      (content !== undefined && head)        { console.warn("You attempt to initialize this version history and set its head which is incompatiple in a single operation. Head will be ignored.") }
        else if (head && !this.versions.isInitialized) { throw new Error("Cannot set head for an uninitialized version history! Please initialize history first.") }

        if      (content !== undefined) { this.setupContent(content) }
        else if (head)                  { this.updateHead(head) }
        else if (this.lastVersion)      { this.updateHead(this.lastVersion) }
        else                            { throw new Error("Cannot set head as no acceptable version is available!") }

        this.head = this.lastVersion
    }

    private setupContent(content: LineContent): void {
        if (this.versions.isInitialized) { throw new Error("This line is already setup with initial content! This process cannot be preformed multiple times.") }

        if (this.line.isOriginal) {
            this.firstVersion = new LineVersion(this, this.getNewTimestamp(), true, content)
            this.lastVersion  = this.firstVersion
        } else if (this.line.isInserted) {
            this.firstVersion = new LineVersion(this, this.getNewTimestamp(), false, "")
            this.lastVersion  = new LineVersion(this, this.getNewTimestamp(), true, content, { previous: this.firstVersion })
        } else {
            throw new Error(`Cannot create LineHistory for line with type "${this.line.lineType}"!`)
        }

        this.head = this.lastVersion
    }

    private getNewTimestamp():      Timestamp   { return TimestampProvider.getTimestamp() }
    public  getTrackedTimestamps(): Timestamp[] { return Array.from(this.headTracking.keys()) }

    public getVersions():     LineVersion[] { return this.versions.getVersions() }
    public getVersionCount(): number        { return this.versions.getLength() }

    public updateHead(version: LineVersion): void {
        if (version.isHead) { return }
        this.head = version
        this.headTracking.set(this.getNewTimestamp(), version)
    }

    /*
    public getVersion(timestamp: Timestamp): LineVersion {

        console.log("----------------")
        console.log("Searched Timestamp: " + timestamp)

        const version = this.getVersionDebug(timestamp)

        console.log("Found Timestamp: " + version?.timestamp)
        console.log("Position: " + version?.line?.getIndex())
        console.log("Line Content: " + version?.content)
        console.log("----------------")

        return version
    }
    */

    public getVersion(timestamp: Timestamp): LineVersion {
        if (this.line.isInserted && this.firstVersion.timestamp > timestamp) {
            return this.firstVersion
        } else {
            const version = this.versions.findReversed(version => { return version.timestamp <= timestamp })

            // search backwards through the keys (aka timestamps) of the tracked timestamps and find the biggest timestamp bigger than the previously found one, but smaller or equal to the searched one
            const trackedTimestamps = this.getTrackedTimestamps()
            for (let i = trackedTimestamps.length - 1; i >= 0; i--) {
                const trackedTimestamp = trackedTimestamps[i]
                if (trackedTimestamp > version.timestamp && trackedTimestamp <= timestamp) {
                    return this.headTracking.get(trackedTimestamp)
                }
            }
    
            return version
        }
    }

    public loadTimestamp(timestamp: Timestamp): LineVersion {
        if (this.head.timestamp < timestamp && this.head.isLatestVersion()) {
            return this.head
        } else {
            const version = this.getVersion(timestamp)
            version.apply()
            return version
        }
    }

    public cloneHeadToEnd(): LineVersion {
        this.lastVersion = this.head.clone(this.getNewTimestamp(), { previous: this.lastVersion })
        this.head        = this.lastVersion
        return this.head
    }

    public createNewVersion(isActive: boolean, content: LineContent): LineVersion {
        if (this.head !== this.lastVersion) { this.cloneHeadToEnd() }

        this.lastVersion = new LineVersion(this, this.getNewTimestamp(), isActive, content, { previous: this.lastVersion })
        this.head        = this.lastVersion

        return this.head
    }

    public updateCurrentVersion(content: LineContent): LineVersion {
        this.head.update(content)
        return this.head
    }

    public deleteLine(): LineVersion {
        return this.createNewVersion(false, "")
    }
}

interface LineVersionRelations {
    origin?: LineVersion | undefined
    previous?: LineVersion | undefined
    next?: LineVersion | undefined
}

enum InsertionState {
    Normal,
    PreInsertion,
    PreInsertionEngaged,
    PreInsertionReleased,
    Deletion
}

class LineVersion extends LinkedListNode<LineVersion> {

    public readonly history: LineHistory

    public readonly timestamp: Timestamp
    public readonly isActive:  boolean
    public          content:   LineContent

    public  readonly origin?: LineVersion   = undefined
    private readonly clones:  LineVersion[] = []

    public get line(): Line { return this.history.line }

    public          get isHead():  boolean { return this.history.head         === this }
    public override get isFirst(): boolean { return this.history.firstVersion === this }
    public override get isLast():  boolean { return this.history.lastVersion  === this }

    public get isPreInsertion(): boolean { return this.line.isInserted && this.isFirst }
    public get isDeletion():     boolean { return !this.isActive && !this.isFirst }

    public get insertionState(): InsertionState {
        if      (!this.isPreInsertion && !this.isDeletion)   { return InsertionState.Normal }
        else if (!this.isPreInsertion &&  this.isDeletion)   { return InsertionState.Deletion }
        else if ( this.isPreInsertion && !this.isDeletion)   {
            if  (!this.isHead         && !this.next?.isHead) { return InsertionState.PreInsertion }
            if  ( this.isHead         && !this.next?.isHead) { return InsertionState.PreInsertionEngaged }
            if  (!this.isHead         &&  this.next?.isHead) { return InsertionState.PreInsertionReleased }
            else                                             { throw new Error("Unexpected behaviour: Only one LineVersion should be head at any given time!") }
        } else                                               { throw new Error("Unexpected behaviour: A LineVersion should not be able to be pre-insertion and deletion at the same time!") }
    }

    public get isClone(): boolean { return this.origin ? true : false }

    public constructor(history: LineHistory, timestamp: Timestamp, isActive: boolean, content: LineContent, relations?: LineVersionRelations) {
        super(history.versions)

        this.history = history
        
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

    public isLatestVersion(): boolean {
        const trackedTimestamps = this.history.getTrackedTimestamps()
        const greatestTrackedTimestamp = trackedTimestamps.length > 0 ? trackedTimestamps[trackedTimestamps.length - 1] : 0
        return this.isLast && this.timestamp >= greatestTrackedTimestamp
    }

    public apply():                      void { this.history.updateHead(this) }
    public update(content: LineContent): void {  this.content = content }

    public applyTo(block: Block): void {
        block.forEach(line => {
            if (line === this.line) {
                this.apply()
            } else {
                line.loadTimestamp(this.timestamp)
            }
        })
    }

    public clone(timestamp: Timestamp, relations?: LineVersionRelations): LineVersion {
        if (!relations?.origin) { relations.origin = this }
        return new LineVersion(this.history, timestamp, this.isActive, this.content, relations)
    }
}

interface LineRange {
    startLine: number,
    endLine: number
}


type EOLSymbol    = string
type LinePosition = number  // absolute position within the root block, counting for both, visible and hidden lines
type LineNumber   = number  // line number within the editor, if this line is displayed
















type ChildBlock  = InlineBlock
type ClonedBlock = ForkBlock

abstract class Block extends LinkedList<Line> {

    public blockId:   BlockId
    public provider?: BlockProvider

    public isClone:   boolean = false
    public isDeleted: boolean = false

    public eol: EOLSymbol

    public parent?: Block
    public children = new Map<BlockId, ChildBlock>()
    public tags     = new Map<TagId, Tag>()

    public    enableVersionMerging: boolean     = false
    protected lastModifiedLine:     Line | null = null

    public get firstLine(): Line | undefined { return this.first }
    public get lastLine():  Line | undefined { return this.last }

    public set firstLine(line: Line | undefined) { this.first = line }
    public set lastLine (line: Line | undefined) { this.last  = line }



    // -------------------------------- Line Data Accessors ---------------------------------------

    public getFirstPosition(): LinePosition { return this.firstLine.getPosition() }
    public getLastPosition():  LinePosition { return this.lastLine.getPosition() }

    public getFirstLineNumber(): LineNumber { return this.getFirstActiveLine().getLineNumber() }
    public getLastLineNumber():  LineNumber { return this.getLastActiveLine().getLineNumber() }

    public getFirstLineNumberInParent(): LineNumber | null {
        if (!this.parent) { throw new Error("This Block does not have a parent! You cannot calculate its first line number in its parent.") }
        const parentLine = this.firstLine.getLineFor(this.parent)
        const activeLine = parentLine.isActive ? parentLine : parentLine.getNextActiveLine()
        const lineNumber = activeLine && this.containsPosition(activeLine.getPosition()) ? activeLine.getLineNumber() : null

        if (!lineNumber) { throw new Error("This indicates that this child is not visible in the parent! Such children are currently not handled well.") }

        return lineNumber
    }

    public getLastLineNumberInParent(): LineNumber | null {
        if (!this.parent) { throw new Error("This Block does not have a parent! You cannot calculate its last line number in its parent.") }
        const parentLine = this.lastLine.getLineFor(this.parent)
        const activeLine = parentLine.isActive ? parentLine : parentLine.getPreviousActiveLine()
        const lineNumber = activeLine && this.containsPosition(activeLine.getPosition()) ? activeLine.getLineNumber() : null

        if (!lineNumber) { throw new Error("This indicates that this child is not visible in the parent! Such children are currently not handled well.") }

        return lineNumber
    }

    public getFirstActiveLine(): Line | null { return this.firstLine.isActive ? this.firstLine : this.firstLine.getNextActiveLine() }
    public getLastActiveLine():  Line | null { return this.lastLine.isActive  ? this.lastLine  : this.lastLine.getPreviousActiveLine() }

    public getLineCount():       number        { return this.getLength() }
    public getActiveLineCount(): number | null { return this.getLastLineNumber() }

    public getLines():       Line[] { return this.toArray() }
    public getActiveLines(): Line[] { return this.filter(line => line.isActive) }

    public getLineContent(): LineContent[] { return this.getActiveLines().map(line => line.currentContent) }
    public getCurrentText(): string        { return this.getLineContent().join(this.eol) }
    public getFullText():    string        { return this.parent ? this.parent.getFullText() : this.getCurrentText() }
    
    public getVersions(): LineVersion[] { return this.flatMap(line => line.history.getVersions()) }



    public addToLines():                        Line[]  { return this.map(line => line.addBlock(this)) }
    public removeFromLines(deleting?: boolean): Block[] { return this.flatMap(line => line.removeBlock(this, deleting)) }



    // TODO: make sure this is actually working correctly
    public getLastModifiedLine(): Line | null { return this.lastModifiedLine }
    public setupVersionMerging(line: Line): void { if (this.enableVersionMerging) { this.lastModifiedLine = line } }
    public resetVersionMerging(): void { this.lastModifiedLine = null }



    public lineNumberToPosition(lineNumber: LineNumber): LinePosition {
        if (!this.containsLineNumber(lineNumber)) { throw new Error("Cannot convert invalid line number to position!") }
        return this.getLineByLineNumber(lineNumber).getPosition()
    }

    public positionToLineNumber(position: LinePosition): LineNumber {
        if (!this.containsPosition(position)) { throw new Error("Cannot convert invalid position to line number!") }
        return this.getLineByPosition(position).getLineNumber()
    }



    public containsPosition(position: LinePosition):   boolean { return this.getFirstPosition()   <= position   && position   <= this.getLastPosition() }
    public containsLineNumber(lineNumber: LineNumber): boolean { return this.getFirstLineNumber() <= lineNumber && lineNumber <= this.getLastLineNumber() }

    public containsRange(range: LineRange): boolean {
        const containsStart = this.containsLineNumber(range.startLine)
        const containsEnd   = this.containsLineNumber(range.endLine)
        return range.startLine <= range.endLine && containsStart && containsEnd
    }

    public overlapsWith(range: LineRange): boolean {
        return this.getFirstLineNumber() <= range.endLine && this.getLastLineNumber() >= range.startLine
    }



    public getLineByPosition(position: LinePosition): Line {
        if (!this.containsPosition(position)) { throw new Error(`Cannot read line for invalid position ${position}!`) }

        const line = this.find(line => line.getPosition() === position)
        if (!line) { throw new Error(`Could not find line for valid position ${position}!`) }

        return line
    }

    public getLineByLineNumber(lineNumber: LineNumber): Line {
        if (!this.containsLineNumber(lineNumber)) { throw new Error(`Cannot read line for invalid line number ${lineNumber}!`) }

        const line = this.find(line => line.getLineNumber() === lineNumber)
        if (!line) { throw new Error(`Could not find line for valid line number ${lineNumber}!`) }

        return line
    }

    public getLineRange(range: LineRange): Line[] {
        if (!this.containsRange(range)) { throw new Error(`Cannot read lines for invalid range ${range}`) }
        
        const lines = []

        let   current = this.getLineByLineNumber(range.startLine)
        const end     = this.getLineByLineNumber(range.endLine)

        while (current !== end) {
            lines.push(current)
            current = current.getNextActiveLine()
        }
        lines.push(end)

        return lines
    }

    protected setLineList(firstLine: Line, lastLine: Line): void {
        this.firstLine = firstLine
        this.lastLine  = lastLine
    }


    // --------------------------------- Edit Mechanics ----------------------------------------

    public insertLine(lineNumber: LineNumber, content: LineContent): Line {
        this.resetVersionMerging()

        const lastLineNumber     = this.getLastLineNumber()
        const newLastLine        = lastLineNumber + 1
        const adjustedLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)

        const includedChildren = this.getChildrenByLineNumber(Math.min(adjustedLineNumber,     lastLineNumber))
        const expandedChildren = this.getChildrenByLineNumber(Math.min(adjustedLineNumber - 1, lastLineNumber))
        const affectedChildren = Array.from(new Set(includedChildren.concat(expandedChildren)))

        let createdLine: Line

        if (adjustedLineNumber === 1) {
            const firstActive = this.getFirstActiveLine()
            createdLine = Line.create(this, LineType.Inserted, content, { 
                previous:    firstActive.previous,
                next:        firstActive,
                knownBlocks: affectedChildren
            })

            if (!createdLine.previous) { 
                this.firstLine = createdLine
            }
        } else if (adjustedLineNumber === newLastLine) {
            const lastActive  = this.getLastActiveLine()
            createdLine = Line.create(this, LineType.Inserted, content, { 
                previous:    lastActive,
                next:        lastActive.next,
                knownBlocks: affectedChildren
            })

            if (!createdLine.next) { 
                this.lastLine = createdLine
            }
        } else {
            const currentLine = this.getLineByLineNumber(adjustedLineNumber)
            createdLine  = Line.create(this, LineType.Inserted, content, { 
                previous:    currentLine.previous, 
                next:        currentLine,
                knownBlocks: affectedChildren
            })
        }

        expandedChildren.forEach(child => {
            const snapshotData = child.compressForParent()
            const lineNumber   = createdLine.getLineNumber()
            if (snapshotData._endLine < lineNumber) {
                snapshotData._endLine = lineNumber
                child.updateInParent(snapshotData)
            }
        })

        return createdLine
    }

    public insertLines(lineNumber: LineNumber, content: LineContent[]): Line[] {
        return content.map((content, index) => {
            return this.insertLine(lineNumber + index, content)
        })
    }

    public updateLine(lineNumber: LineNumber, content: LineContent): Line {
        const line = this.getLineByLineNumber(lineNumber)
        line.update(content)

        this.setupVersionMerging(line)

        return line
    }

    public updateLines(lineNumber: LineNumber, content: LineContent[]): Line[] {
        this.resetVersionMerging()

        const lines = this.getLineRange({ startLine: lineNumber, endLine: lineNumber + content.length - 1 })
        lines.forEach((line, index) => line.update(content[index]))
        return lines
    }

    public deleteLine(lineNumber: LineNumber): Line {
        this.resetVersionMerging()

        const line = this.getLineByLineNumber(lineNumber)
        line.delete()
        return line
    }

    public deleteLines(range: LineRange): Line[] {
        const lines = this.getLineRange(range)
        lines.forEach(line => line.delete())
        return lines
    }

    // -------------------------- Children Mechanics ---------------------------

    public createChild(range: IRange): ChildBlock | null {

        const lineRange = { startLine: range.startLineNumber, endLine: range.endLineNumber }
        const overlappingSnapshot = this.getChildren().find(snapshot => snapshot.overlapsWith(lineRange))

        if (overlappingSnapshot) { 
            console.warn("Could not create snapshot due to overlap!")
            return null
        }

        const firstLine = this.getLineByLineNumber(range.startLineNumber)
        const lastLine  = this.getLineByLineNumber(range.endLineNumber)
        const child     = new InlineBlock({ eol: this.eol, 
                                            parent: this, 
                                            firstLine, 
                                            lastLine, 
                                            provider: this.provider, 
                                            enableVersionMerging: this.enableVersionMerging
                                          })

        this.addChild(child)

        return child
    }

    public addChild(block: ChildBlock): void {
        this.children.set(block.blockId, block)
    }

    public getChild(blockId: BlockId): ChildBlock {
        if (!this.children.has(blockId)) { throw new Error(`Child Block with ID ${blockId} does not exist!`) }
        return this.children.get(blockId)
    }

    public getChildren(): ChildBlock[] { 
        return Array.from(this.children.values())
    }

    public getChildrenByPosition(position: LinePosition): ChildBlock[] {
        return this.getChildren().filter(child => child.containsPosition(position))
    }

    public getChildrenByLineNumber(lineNumber: LineNumber): ChildBlock[] {
        const position = this.lineNumberToPosition(lineNumber)
        return this.getChildrenByPosition(position)
    }

    public updateChild(update: VCSSnapshotData): ChildBlock {
        const child = this.getChild(update.uuid)
        child.updateInParent(update)
        return child
    }

    public deleteChild(blockId: BlockId): void {
        this.getChild(blockId).delete()
        this.children.delete(blockId)
    }

    public delete(): Block[] {

        this.removeFromLines(true)
        this.parent?.children.delete(this.blockId)

        this.firstLine = undefined
        this.lastLine  = undefined

        const deletedBlocks = this.getChildren().flatMap(child => child.delete())
        deletedBlocks.push(this)

        this.isDeleted = true

        return deletedBlocks
    }



    // ---------------------- SNAPSHOT FUNCTIONALITY ------------------------

    public getHeads(): LineVersion[] { return this.map(line => line.currentVersion) }

    public getOriginalLineCount(): number { return this.filter(line => !line.isInserted).length }
    public getUserVersionCount():  number { return this.getUnsortedTimeline().length - this.getOriginalLineCount() + 1 }

    protected getUnsortedTimeline(): LineVersion[] {
        // isPreInsertion to avoid choosing versions following on a pre-insertion-version, as we simulate those.
        // Same for origin -> cloned versions are not displayed, and are just there for correct code structure
        return this.getVersions().filter(version => { return !version.previous?.isPreInsertion /*&& !version.origin*/ } )
    }

    protected getTimeline(): LineVersion[] {
        return this.getUnsortedTimeline().sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)
    }

    // WARNING: This function is a bit wild. It assumes we cannot have any pre-insertion versions as current version, as those are invisible, and thus "not yet existing" (the lines, that is).
    // As a result it filters those. This function should ONLY BE USED WHEN YOU KNOW WHAT YOU DO. One example of that is the getCurrentVersionIndex, where the understanding of this
    // function is used to extract the timeline index that should be visualized by the UI.
    private getCurrentVersion(): LineVersion {
        return this.getHeads().filter(head          => !head.isPreInsertion)
                              .sort( (headA, headB) => headB.timestamp - headA.timestamp)[0]
    }

    public getCurrentVersionIndex(): number {
        // establish correct latest hand in the timeline: as we do not include insertion version, but only pre-insertion, those are set to their related pre-insertion versions
        let currentVersion = this.getCurrentVersion()
        if (currentVersion.previous?.isPreInsertion) { currentVersion = currentVersion.previous }   // I know, this is wild. The idea is that we cannot have invisible lines as the current
                                                                                                    // version. At the same time the pre-insertion versions are the only ones present in
                                                                                                    // the timeline by default, because I can easily distinguished for further manipulation.
        //if (currentVersion.origin)                   { currentVersion = currentVersion.next }

        const timeline = this.getTimeline()
        const index = timeline.indexOf(currentVersion, 0)

        if (index < 0) { throw new Error("Latest head not in timeline!") }

        return index
    }

    // THIS is the actual latest version in the timeline that is currently active. Unfortunately, there is no other easy way to calculate that...
    public getLatestVersion(): LineVersion {
        return this.getTimeline()[this.getCurrentVersionIndex()]
    }

    public applyIndex(targetIndex: number): void {
        // The concept works as follow: I create a timeline from all versions, sorted by timestamp. Then I limit the selecteable versions to all versions past the original file creation
        // (meaning versions that were in the file when loading it into the versioning are ignored), except for the last one (to recover the original state of a snapshot). This means the
        // index provided by the interface will be increased by the amount of such native lines - 1. This index will then select the version, which will be applied on all lines directly.
        // There are no clones anymore for deleted or modified lines (besides when editing past versions, cloning edited versions to the end). The trick to handle inserted lines works as
        // follows: I still require a deactiveated and an activated version with the actual contet. However, the timeline will only contain the deactivated one, the pre-insertion line.
        // When this line gets chosen by the user, I can decide how to process it: If it is already the head, the user likely meant to actually see the content of this line and I just apply
        // the next line with content. If it is currently not the head, the user likely meant to disable it, so it will be applied directly.
        // the only larger difficulty arises when the user decides to select this line, and then moves the selected index one to the left. This operation will trigger the version prior to
        // the actual insertion and can be completely unrelated. However, when leaving the insertion version, what the user really wants to do is hide it again. This can be checked by checking
        // the next version for each index, and it if is a pre-insertion version, then check wether the next version of it (the enabled one with actual content) is currently head. If that's the
        // case, then just apply the next version, aka the pre-insertion version, to hide it again.
        // The great thing about this method is, that, if the user jumps to the insertion version, it will be handled logically, even if the jump came from non-adjacent versions.

        this.resetVersionMerging()
        const timeline = this.getTimeline()

        targetIndex += this.getOriginalLineCount() - 1
        if (targetIndex < 0 || targetIndex >= timeline.length) { throw new Error(`Target index ${targetIndex} out of bounds for timeline of length ${timeline.length}!`) }

        let   selectedVersion = timeline[targetIndex] // actually targeted version
        let   previousVersion = targetIndex - 1 >= 0              ? timeline[targetIndex - 1] : undefined
        let   nextVersion     = targetIndex + 1 < timeline.length ? timeline[targetIndex + 1] : undefined
        const latestVersion   = timeline[this.getCurrentVersionIndex()]

        // TO CONSIDER:
        // If I edit a bunch of lines not all in a snapshot, and then rewind the changes, only changing the previously untouched lines, then the order will remain intakt (thanks to head tracking)
        // but it can happen that the order of edits is weird (e.g., when one of these still original lines gets deleted, it immediately disappears instead of first being displayed).
        // This is because I do not clone these lines that were never edited. Thus, all changes are instant. This can be good, but it feels different from the average editing experience
        // that involves clones. I should think what the best course of action would be here...

        // Default case
        let version: LineVersion = selectedVersion

        // If the previous version is selected and still on pre-insertion, disable pre-insertion
        // I am not sure if this case will ever occur, or is just transitively solved by the others... maybe I can figure that out at some point...
        if (previousVersion === latestVersion && previousVersion.insertionState === InsertionState.PreInsertionEngaged) { version = previousVersion.next }
        // If the next version is selected and still on post-insertion, then set it to pre-insertion
        else if (nextVersion === latestVersion && nextVersion.insertionState === InsertionState.PreInsertionReleased)   { version = nextVersion }
        // If the current version is pre-insertion, skip the pre-insertion phase if necessary
        else if (selectedVersion.isPreInsertion && (selectedVersion.isHead || nextVersion?.isHead))                     { version = selectedVersion.next }

        console.log(this.getCurrentText())

        version.applyTo(this)
    }

    public updateInParent(range: VCSSnapshotData): Block[] {
        if (!this.parent) { throw new Error("This Block does not have a parent! You cannot update its range within its parent.") }
        if (!this.parent.containsLineNumber(range._startLine)) { throw new Error("Start line is not in range of parent!") }
        if (!this.parent.containsLineNumber(range._endLine))   { throw new Error("End line is not in range of parent!") }

        const oldFirstLineNumber = this.getFirstLineNumber()
        const oldLastLineNumber  = this.getLastLineNumber()

        this.removeFromLines()
        const newFirstLine = this.parent.getLineByLineNumber(range._startLine)
        const newLastLine  = this.parent.getLineByLineNumber(range._endLine)
        this.setLineList(newFirstLine, newLastLine)

        const newFirstLineNumber = this.getFirstLineNumber()
        const newLastLineNumber  = this.getLastLineNumber()

        const updatedBlocks = this.getChildren().flatMap(child => {

            const firstLineNumber = child.getFirstLineNumberInParent()
            const lastLineNumber  = child.getLastLineNumberInParent()

            if (firstLineNumber === oldFirstLineNumber || lastLineNumber === oldLastLineNumber) {
                const childRange = child.compressForParent()

                childRange._startLine = firstLineNumber === oldFirstLineNumber ? newFirstLineNumber : childRange._startLine
                childRange._endLine   = lastLineNumber  === oldLastLineNumber  ? newLastLineNumber  : childRange._endLine

                if (childRange._startLine > childRange._endLine) {  
                    return child.delete()
                } else {
                    return child.updateInParent(childRange)
                }
            } else {
                return []
            }
        })

        updatedBlocks.push(this)
        return updatedBlocks
    }

    public compressForParent(): VCSSnapshotData {
        const parent = this
        return {
            uuid:         parent.blockId,
            _startLine:   parent.getFirstLineNumberInParent(),
            _endLine:     parent.getLastLineNumberInParent(),
            versionCount: parent.getUserVersionCount(),
            versionIndex: parent.getCurrentVersionIndex()
        }
    }

    public getCompressedChildren(): VCSSnapshotData[] {
        return this.getChildren().map(child => child.compressForParent())
    }



    // ---------------------- TAG FUNCTIONALITY ------------------------

    protected createCurrentTag(): Tag {
        const heads = new Map<Line, LineVersion>()
        this.forEach(line => heads.set(line, line.currentVersion))
        return new Tag(this, heads)
    }

    public createTag(): VCSVersion {

        const tag = this.createCurrentTag()
        this.tags.set(tag.id, tag)

        return {
            blockId:             this.blockId,
            uuid:                tag.id,
            name:                `Version ${this.tags.size}`,
            text:                this.getFullText(),
            automaticSuggestion: false
        }
    }

    public loadTag(id: TagId): string {
        const tag = this.tags.get(id)
        tag.applyTo(this)
        return this.getFullText()
    }

    public getTextForVersion(id: TagId): string {
        const recoveryPoint = this.createCurrentTag()
        const text          = this.loadTag(id)

        recoveryPoint.applyTo(this)

        return text
    }



    public clone(): ClonedBlock {
        return new ForkBlock(this)
    }
}



interface InlineBlockOptions { 
    eol:                   EOLSymbol
    parent:                Block
    firstLine:             Line
    lastLine:              Line
    provider?:             BlockProvider
    enableVersionMerging?: boolean
}

class InlineBlock extends Block {

    public constructor(options: InlineBlockOptions) {
        super()

        this.blockId              = BlockProvider.newBlockId()
        this.provider             = options.provider
        this.eol                  = options.eol
        this.parent               = options.parent
        this.firstLine            = options.firstLine
        this.lastLine             = options.lastLine
        this.enableVersionMerging = options.enableVersionMerging ? options.enableVersionMerging : false

        this.addToLines()
        this.provider.register(this)
    }
}


interface ForkBlockOptions { 
    eol:                   EOLSymbol
    filePath?:             string
    parent?:               Block
    firstLine?:            BlockLine
    lastLine?:             BlockLine
    content?:              string
    provider?:             BlockProvider 
    enableVersionMerging?: boolean
}

class ForkBlock extends Block {

    public static create(eol: EOLSymbol, content: string, options?: { filePath?: string, provider?: BlockProvider }): ForkBlock {
        return new ForkBlock({ eol, filePath: options?.filePath, content, provider: options?.provider })
    }

    public constructor(options: ForkBlockOptions | Block) {
        super()

        const blockOptions = options as ForkBlockOptions
        const clonedBlock  = options as Block

        let firstBlockLine: BlockLine | undefined = undefined
        let lastBlockLine:  BlockLine | undefined = undefined

        if (blockOptions) {
            this.blockId              = BlockProvider.createBlockIdFromFilePath(blockOptions.filePath)
            this.provider             = blockOptions.provider
            this.eol                  = blockOptions.eol
            this.parent               = blockOptions.parent
            this.enableVersionMerging = blockOptions.enableVersionMerging ? blockOptions.enableVersionMerging : false

            firstBlockLine = blockOptions.firstLine
            lastBlockLine  = blockOptions.lastLine

            const content = blockOptions.content
            if      (!firstBlockLine && !lastBlockLine) { this.setContent(content ? content : "") }
            else if (content)                           { throw new Error("You cannot set a first or last line and define content at the same time, as this will lead to conflicts in constructing a block.") }
        
            this.provider.register(this)
        } else if (clonedBlock) {
            this.blockId              = clonedBlock.blockId
            this.isDeleted            = clonedBlock.isDeleted
            this.provider             = clonedBlock.provider
            this.eol                  = clonedBlock.eol
            this.parent               = clonedBlock.parent
            this.children             = clonedBlock.children
            this.tags                 = clonedBlock.tags
            this.enableVersionMerging = clonedBlock.enableVersionMerging
            this.isClone              = true

            firstBlockLine            = clonedBlock.firstLine?.blockLine
            lastBlockLine             = clonedBlock.lastLine?.blockLine
        }

        if      ( firstBlockLine && !lastBlockLine) { lastBlockLine  = firstBlockLine }
        else if (!firstBlockLine &&  lastBlockLine) { firstBlockLine = lastBlockLine }

        if (firstBlockLine && lastBlockLine) { this.setBlockList(firstBlockLine, lastBlockLine) }
    }

    protected override setLineList(firstLine: Line, lastLine: Line): void {
        this.setBlockList(firstLine.blockLine, lastLine.blockLine)
    }

    private setBlockList(firstBlockLine: BlockLine, lastBlockLine: BlockLine) {
        const lines: Line[]  = []

        let current = firstBlockLine
        while (current && current !== lastBlockLine) {
            lines.push(current.addBlock(this))
            current = current.next
        }

        if (current && current === lastBlockLine) { lines.push(current.addBlock(this)) }

        if (lines.length > 0) {
            this.firstLine = lines[0]
            this.lastLine  = lines[lines.length - 1]
        }
    }

    public setContent(content: string): void {
        const lineStrings = content.split(this.eol)
        const lines = lineStrings.map(content => Line.create(this, LineType.Original, content))
        this.setLines(lines)
    }

    public setLines(lines: Line[]): void {
        this.removeFromLines(true)

        const lineCount = lines.length
        let  previous: Line | undefined = undefined
        lines.forEach((current: Line, index: number) => {
            current.previous = previous
            if (index + 1 < lineCount) { current.next = lines[index + 1] }
            previous = current
            current.addBlock(this)
        })

        this.firstLine = lineCount > 0 ? lines[0]             : undefined
        this.lastLine  = lineCount > 0 ? lines[lineCount - 1] : undefined
    }
}


type BlockId = string
type TagId   = string

class BlockProvider {

    private readonly blocks = new Map<BlockId, Block>()

    public constructor(blocks?: Block[]) {
        blocks?.forEach(block => { this.register(block) })
    }

    public static newBlockId():                             BlockId { return crypto.randomUUID() }
    public static createBlockIdFromFilePath(path?: string): BlockId { return path ? this.convertFilePathToBlockId(path) : this.newBlockId() }
    public static convertFilePathToBlockId(path: string):   BlockId { return path }

    public register(block: Block): void {
        this.blocks.set(block.blockId, block)
        block.children.forEach(child => this.register(child))
    }

    public getBlock(blockId: BlockId): Block | undefined {
        return this.blocks.get(blockId)
    }
}


class Tag {

    public readonly id: TagId = crypto.randomUUID()

    protected readonly block:    Block
    protected readonly versions: Map<Line, LineVersion>

    constructor(block: Block, versions?: Map<Line, LineVersion>) {
        this.block    = block
        this.versions = versions ? versions : new Map<Line, LineVersion>()
    }

    public has(line: Line): boolean {
        return this.versions.has(line)
    }

    public get(line: Line): LineVersion {
        return this.versions.get(line)
    }

    public set(line: Line, version: LineVersion): void {
        this.versions.set(line, version)
    }

    public delete(line: Line): boolean {
        return this.versions.delete(line)
    }

    public applyTo(block: Block): void {
        block.forEach(line => {
            if (this.has(line)) {
                this.get(line).apply()
            } else if (this.block?.contains(line)) {
                if (line.isInserted) { line.history.firstVersion.apply() }
                else                 { throw new Error("This tag does not allow for valid manipulation of this line. Potentially it was not defined correctly.") }
            }
        })
    }
}

class Session {

    public readonly sessionId: SessionId = crypto.randomUUID()

    public readonly block: Block

    public get blockId(): BlockId { return this.block.blockId }

    public static createWithNewBlock(eol: string, options?: { provider?: BlockProvider, filePath?: string, content?: string }): Session {
        const blockId = BlockProvider.createBlockIdFromFilePath(options?.filePath)
        const block   = new ForkBlock({ provider: options?.provider, eol, blockId, content: options?.content })
        return new Session(block)
    }

    public static createFromBlock(block: Block): Session {
        return new Session(block.clone())
    }

    public constructor(block: Block) {
        this.block = block
    }
}

interface SessionInfo { 
    sessionId: SessionId,
    blockId: BlockId,
    content: string
}

export class GhostVCSServer extends BasicVCSServer {

    // helper for preview update
    private browserWindow: BrowserWindow | undefined

    private blocks   = new BlockProvider()
    private sessions = new Map<SessionId, Session>()

    public constructor(browserWindow?: BrowserWindow) {
        super()
        this.browserWindow = browserWindow
    }

    private getSession(sessionId: SessionId): Session {
        if (this.sessions.has(sessionId)) { return this.sessions.get(sessionId)! }
        else                              { throw new Error("This session ID is unknown!") }
    }

    private getBlock(sessionId: SessionId): Block { return this.getSession(sessionId).block }

    private updatePreview(block: Block) {
        const versionCounts = block.getActiveLines().map(line => { return line.getVersionCount() })
        this.browserWindow?.webContents.send("update-vcs-preview", block.blockId, block.getCurrentText(), versionCounts)
    }

    public async startSession(eol: string, options?: SessionOptions): Promise<SessionInfo> {
        const filePath        = options?.filePath
        const providedBlockId = options?.blockId
        const blockId         = filePath ? BlockProvider.convertFilePathToBlockId(filePath) : providedBlockId

        if (filePath && providedBlockId && providedBlockId !== blockId) { throw new Error("The provided file path and block IDs are not compatiple! Please use only one of them, or find the correct block ID for your file path!") }

        const content  = options?.content
        const block    = blockId ? this.blocks.getBlock(blockId) : undefined

        let session: Session
        if (block) {
            if (content) { console.warn("Right now, we do not support updating the content of an existing block based on provided content. This will be ignored.") }
            session = Session.createFromBlock(block)
        } else {
            session = Session.createWithNewBlock(eol, { provider: this.blocks, filePath, content })
        }

        this.sessions.set(session.sessionId, session)

        return { sessionId: session.sessionId, blockId: session.blockId, content: session.block.getCurrentText() }
    }

    public async closeSession(sessionId: SessionId): Promise<void> {
        this.sessions.delete(sessionId)
    }

    public async updatePath(sessionId: SessionId, filePath: string): Promise<void> {
        console.log("UPDATING FILE PATH IS NOT IMPLEMNETED")
        //this.file.filePath = filePath
    }

    public async cloneToPath(sessionId: SessionId, filePath: string): Promise<void> {
        console.log("CLONE TO PATH NOT IMPLEMENTED")
    }

    public async createSnapshot(sessionId: SessionId, range: IRange): Promise<VCSSnapshotData | null> {
        const block = this.getBlock(sessionId)
        return block.createChild(range)?.compressForParent()
    }

    public async deleteSnapshot(sessionId: SessionId, uuid: string): Promise<void> {
        const block = this.getBlock(sessionId)
        block.deleteChild(uuid)
    }

    public async getSnapshot(sessionId: SessionId, uuid: string): Promise<VCSSnapshotData> {
        const block = this.getBlock(sessionId)
        return block.getChild(uuid).compressForParent()
    }

    public async getSnapshots(sessionId: SessionId): Promise<VCSSnapshotData[]> {
        const block = this.getBlock(sessionId)
        return block.getCompressedChildren()
    }

    public async updateSnapshot(sessionId: SessionId, snapshot: VCSSnapshotData): Promise<void> {
        const block = this.getBlock(sessionId)
        block.updateChild(snapshot)
    }

    public async applySnapshotVersionIndex(sessionId: SessionId, uuid: SnapshotUUID, versionIndex: number): Promise<string> {
        const block = this.getBlock(sessionId)
        block.getChild(uuid).applyIndex(versionIndex)
        this.updatePreview(block)
        return block.getCurrentText()
    }

    public async lineChanged(sessionId: SessionId, change: LineChange): Promise<SnapshotUUID[]> {
        const block = this.getBlock(sessionId)
        const line = block.updateLine(change.lineNumber, change.lineText)
        this.updatePreview(block)
        return line.getAffectedBlockIds()
    }

    public async linesChanged(sessionId: SessionId, change: MultiLineChange): Promise<SnapshotUUID[]> {
        const block = this.getBlock(sessionId)

        block.resetVersionMerging()


        const startsWithEol = change.insertedText[0] === block.eol
        const endsWithEol   = change.insertedText[change.insertedText.length - 1] === block.eol

        const insertedAtStartOfStartLine = change.modifiedRange.startColumn === 1
        const insertedAtEndOfStartLine = change.modifiedRange.startColumn > block.getLineByLineNumber(change.modifiedRange.startLineNumber).currentContent.length

        const insertedAtEnd   = change.modifiedRange.endColumn > block.getLineByLineNumber(change.modifiedRange.endLineNumber).currentContent.length

        const oneLineModification = change.modifiedRange.startLineNumber === change.modifiedRange.endLineNumber
        const insertOnly = oneLineModification && change.modifiedRange.startColumn == change.modifiedRange.endColumn

        const pushStartLineDown = insertedAtStartOfStartLine && endsWithEol  // start line is not modified and will be below the inserted lines
        const pushStartLineUp   = insertedAtEndOfStartLine && startsWithEol  // start line is not modified and will be above the inserted lines

        const modifyStartLine = !insertOnly || (!pushStartLineDown && !pushStartLineUp)


        const modifiedRange = {
            startLine: change.modifiedRange.startLineNumber,
            endLine:   change.modifiedRange.endLineNumber
        }

        let vcsLines: Line[] = []
        const modifiedLines = change.lineText.split(block.eol)

        if (modifyStartLine) {
            vcsLines = block.getLineRange(modifiedRange)
        } else {
            // TODO: pushStartDown case not handled well yet, line tracking is off
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }
        


        let affectedLines: Line[] = []
        function deleteLine(line: Line): void {
            line.delete()
            affectedLines.push(line)
        }

        function updateLine(line: Line, newContent: string): void {
            line.update(newContent)
            affectedLines.push(line)
        }

        function insertLine(lineNumber: number, content: string): void {
            const line = block.insertLine(lineNumber, content)
            affectedLines.push(line)
        }



        for (let i = vcsLines.length - 1; i >= modifiedLines.length; i--) {
            const line = vcsLines.at(i)
            deleteLine(line)
        }

        /*
        // inverse deletion order
        for (let i = modifiedLines.length; i < vcsLines.length; i++) {
            const line = vcsLines.at(i)
            deleteLine(line)
        }
        */

        if (modifyStartLine) { updateLine(vcsLines.at(0), modifiedLines[0]) }

        for (let i = 1; i < modifiedLines.length; i++) {
            if (i < vcsLines.length) {
                const line = vcsLines.at(i)
                updateLine(line, modifiedLines[i])
            } else {
                insertLine(modifiedRange.startLine + i, modifiedLines[i])
            }
        }

        this.updatePreview(block)

        return affectedLines.map(line => line.getAffectedBlockIds()).flat()
    }

    public async saveCurrentVersion(sessionId: SessionId, uuid: SnapshotUUID): Promise<VCSVersion> {
        const block = this.getBlock(sessionId)
        const snapshot = block.getChild(uuid)
        return snapshot.createTag()
    }
}