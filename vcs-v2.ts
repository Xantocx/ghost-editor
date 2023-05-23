import { BrowserWindow } from "electron"
import { VCSSnapshotData, VCSVersion } from "./src/app/components/data/snapshot"
import { IRange } from "./src/app/components/utils/range"
import { BasicVCSServer, SnapshotUUID } from "./src/app/components/vcs/vcs-provider"
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

    public readonly list: LinkedList<Node>

    public previous?: Node = undefined
    public next?:     Node = undefined

    public constructor(list: LinkedList<Node>) {
        this.list = list
    }

    public getIndex():             number { return this.previous ? this.previous.getIndex() + 1 : 0 }
    public getPreviousNodeCount(): number { return this.getIndex() }
    public getNextNodeCount():     number { return this.next     ? this.next.getNextNodeCount() + 1 : 0 }

    public findPrevious(check: (previous: Node) => boolean): Node | null {
        let previous = this.previous
        while (previous && !check(previous)) { previous = previous.previous }
        return previous
    }

    public findNext(check: (next: Node) => boolean): Node | null {
        let next = this.next
        while (next && !check(next)) { next = next.next }
        return next
    }

    public remove(): void {
        if (this.previous) { this.previous.next = this.next }
        if (this.next)     { this.next.previous = this.previous }
    }
}

abstract class LinkedList<Node extends LinkedListNode<Node>> {

    public first?: Node
    public last?: Node

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

        while (node) {
            callback(node, index)
            node = node.next
            index++
        }
    }

    public find(check: (node: Node, index: number) => boolean): Node {
        let node = this.first
        let index = 0

        while (node && !check(node, index)) {
            node = node.next
            index++
        }

        return node
    }

    public findReversed(check: (node: Node, index: number) => boolean): Node {
        let node  = this.last
        let index = node.getIndex()

        while (node && !check(node, index)) {
            node = node.previous
            index--
        }

        return node
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
interface BlockLineRelations {
    previous?:    BlockLine | undefined
    next?:        BlockLine | undefined
    knownBlocks?: Block[]
}

class BlockLine extends LinkedListNode<BlockLine> {

    public readonly originBlock: Block
    public readonly lineType:    LineType
    public readonly versions:    VersionHistory<LineVersion>

    public readonly lines = new Map<Block, Line>()

    public get isOriginal(): boolean  { return this.lineType === LineType.Original }
    public get isInserted(): boolean  { return this.lineType === LineType.Inserted }

    public get originLine(): Line { return this.getLine(this.originBlock) }

    public constructor(originBlock: Block, lineType: LineType, content: LineContent, relations?: BlockLineRelations) {
        super(originBlock)

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

    public getLineNumber(block: Block): number | undefined { return this.getLine(block)?.getLineNumber() }

    public has(block: Block):     boolean          { return this.lines.has(block) }
    public getLine(block: Block): Line | undefined { return this.lines.get(block) }

    public getBlocks():   Block[]   { return Array.from(this.lines.keys()) }
    public getBlockIds(): BlockId[] { return this.getBlocks().map(block => block.id) }

    public getVersions(): LineVersion[] { return this.versions.getVersions() }

    public addBlock(block: Block, head?: LineVersion): void {
        if (!this.lines.has(block)) {
            head = head ? head : this.originLine.currentVersion
            const line = new Line(this, block, { head })
            this.lines.set(block, line)
        } else if (this.getLine(block).currentVersion !== head) {
            throw new Error("This Block already exists for this line. It seems like your attempted to set the head to another version, but this is not the intended use of this function.")
        }
    }

    public removeBlock(block: Block, deleting?: boolean): Block[] {
        if (block == this.originBlock) {
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

    public get versions(): VersionHistory<LineVersion> { return this.blockLine.versions }

    public get lineType():   LineType { return this.blockLine.lineType }
    public get isOriginal(): boolean  { return this.blockLine.isOriginal }
    public get isInserted(): boolean  { return this.blockLine.isInserted }

    public get previous(): Line | undefined { return this.blockLine.previous?.getLine(this.block) }
    public get next(): Line | undefined     { return this.blockLine.next?.getLine(this.block) }

    public get isActive():       boolean     { return this.history.isActive }
    public get currentVersion(): LineVersion { return this.history.head }
    public get currentContent(): LineContent { return this.currentVersion.content }

    public constructor(blockLine: BlockLine, block: Block, setup?: { content?: LineContent, head?: LineVersion }) {
        super()
        this.blockLine = blockLine
        this.block    = block
        this.history  = new LineHistory(this, this.versions, setup)
    }

    public findPrevious(check: (line: Line) => boolean): Line | undefined { 
        return this.blockLine.findPrevious(blockLine => {
            const line = blockLine.getLine(this.block)
            return line ? check(line) : false
        })?.getLine(this.block) 
    }

    public findNext(check: (line: Line) => boolean): Line | undefined { 
        return this.blockLine.findNext(blockLine => {
            const line = blockLine.getLine(this.block)
            return line ? check(line) : false
        })?.getLine(this.block) 
    }

    public getPreviousActiveLine(): Line | null { return this.findPrevious(line => line.isActive) }
    public getNextActiveLine():     Line | null { return this.findNext    (line => line.isActive) }

    public getVersionCount(): number { return this.history.getVersionCount() }

    public getLineNumber(): number | null { 
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

class LineVersion extends LinkedListNode<LineVersion> {

    public readonly history: LineHistory

    public readonly timestamp: Timestamp
    public readonly isActive:  boolean
    public content:   LineContent

    public  readonly origin?: LineVersion   = undefined
    private readonly clones:  LineVersion[] = []

    public get line(): Line { return this.history.line }

    public get isHead():  boolean { return this.history.head         === this }
    public get isFirst(): boolean { return this.history.firstVersion === this }
    public get isLast():  boolean { return this.history.lastVersion  === this }

    public get isPreInsertion(): boolean { return this.line.isInserted && this.isFirst }
    public get isDeletion():     boolean { return !this.isActive && !this.isFirst }

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
        block.forEachLine(line => {
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


abstract class BlockLineList extends LinkedList<BlockLine> {

}

class Block extends BlockLineList {

    public readonly id: BlockId
    public isDeleted = false

    public readonly eol:     string
    public readonly parent?: Block

    public readonly children = new Map<BlockId, Block>()
    public readonly tags     = new Map<TagId, Tag>()

    private enableVersionMerging = false
    private lastModifiedLine: Line | null = null

    public get firstLine(): Line | undefined { return this.first.getLine(this) }
    public get lastLine():  Line | undefined { return this.last.getLine(this) }

    public static create(eol: string, content: string, fileName?: string): Block {
        const id          = BlockProvider.createBlockIdFrom(fileName)
        const block       = new Block(eol, {id})
        const lineStrings = content.split(eol)

        const lines = lineStrings.map(content => {
            return new BlockLine(block, LineType.Original, content)
        })

        block.setLines(lines)
        return block
    }

    public constructor(eol: string, options?: { id?: BlockId, parent?: Block, firstLine?: BlockLine, lastLine?: BlockLine }) {
        super()

        this.id  = options?.id ? options.id : BlockProvider.newBlockId()
        this.eol = eol

        this.parent    = options?.parent
        this.first = options?.firstLine
        this.last  = options?.lastLine

        this.addToLines()
    }

    public getFirstActiveBlockLine(): BlockLine | null { return this.getFirstActiveLine().blockLine }
    public getLastActiveBlockLine():  BlockLine | null { return this.getLastActiveLine().blockLine }

    public getFirstActiveLine(): Line | null { return this.firstLine.isActive ? this.firstLine : this.firstLine.getNextActiveLine() }
    public getLastActiveLine():  Line | null { return this.lastLine.isActive  ? this.lastLine  : this.lastLine.getPreviousActiveLine() }

    public getFirstLineNumber(): number { return this.getFirstActiveLine().getLineNumber() }
    public getLastLineNumber():  number { return this.getLastActiveLine().getLineNumber() }

    public getLineCount():       number        { return this.getLength() }
    public getActiveLineCount(): number | null { return this.getLastLineNumber() }

    public getLines():       Line[] { return this.map(blockLine => blockLine.getLine(this)) }
    public getActiveLines(): Line[] { return this.getLines().filter(line => line.isActive) }

    public getLineContent(): LineContent[] { return this.getActiveLines().map(line => line.currentContent) }
    public getCurrentText(): string        { return this.getLineContent().join(this.eol) }
    public getFullText():    string        { return this.parent ? this.parent.getFullText() : this.getCurrentText() }
    
    public getVersions(): LineVersion[] { return this.flatMap(line => line.getVersions()) }

    public addToLines():                        void { this.forEach(line => line.addBlock(this)) }
    public removeFromLines(deleting?: boolean): void { this.forEach(line => line.removeBlock(this, deleting)) }

    public getLastModifiedLine(): Line | null { 
        return this.parent ? this.parent.getLastModifiedLine() : this.lastModifiedLine
    }

    public setupVersionMerging(line: Line): void { 
        if (!this.enableVersionMerging) { return }

        if (this.parent) {
            this.parent.setupVersionMerging(line)
        } else {
            this.lastModifiedLine = line
        }
    }

    public resetVersionMerging(): void {
        if (this.parent) {
            this.parent.resetVersionMerging()
        } else {
            this.lastModifiedLine = null
        }
    }

    public containsLineNumber(lineNumber: number): boolean { 
        return this.getFirstLineNumber() <= lineNumber && lineNumber <= this.getLastLineNumber()
    }

    public containsRange(range: LineRange): boolean {
        const containsStart = this.containsLineNumber(range.startLine)
        const containsEnd   = this.containsLineNumber(range.endLine)
        return range.startLine <= range.endLine && containsStart && containsEnd
    }

    public overlapsWith(range: LineRange): boolean {
        return this.getFirstLineNumber() <= range.endLine && this.getLastLineNumber() >= range.startLine
    }

    public containsLine(line: Line): boolean {
        return this.contains(line.blockLine)
    }

    public forEachLine(callback: (line: Line, index: number) => void): void {
        this.forEach((blockLine, index) => {
            const line = blockLine.getLine(this)
            if (line) { callback(line, index) }
        })
    }

    public findLine(check: (line: Line) => boolean): Line | undefined {
        return this.find(blockLine => {
            const line = blockLine.getLine(this)
            return line && check(line)
        }).getLine(this)
    }

    public mapLines<Mapped>(mapper: (line: Line, index: number, lines: Line[]) => Mapped): Mapped[] {
        const lines = this.getLines()
        return this.map((blockLine, index) => {
            const line = blockLine.getLine(this)
            return line ? mapper(line, index, lines) : undefined
        }).filter(line => line !== undefined)
    }

    public filterLines(check: (line: Line) => boolean): Line[] {
        return this.getLines().filter(check)
    }

    public getBlockLine(lineNumber: number): BlockLine {
        if (!this.containsLineNumber(lineNumber)) { throw new Error(`Cannot read line for invalid line number ${lineNumber}!`) }

        const line = this.find(blockLine => blockLine.getLine(this)?.getLineNumber() === lineNumber)
        if (!line) { throw new Error(`Could not find line for valid line number ${lineNumber}!`) }

        return line
    }

    public getLine(lineNumber: number): Line {
        return this.getBlockLine(lineNumber).getLine(this)
    }

    public getLineRange(range: LineRange): Line[] {
        if (!this.containsRange(range)) { throw new Error(`Cannot read lines for invalid range ${range}`) }
        
        const lines = []

        let   current = this.getLine(range.startLine)
        const end     = this.getLine(range.endLine)

        while (current !== end) {
            lines.push(current)
            current = current.getNextActiveLine()
        }
        lines.push(end)

        return lines
    }

    public setLines(lines: BlockLine[]): void {
        const lineCount = lines.length

        let previous: BlockLine | undefined = undefined
        lines.forEach((current, index) => {
            current.previous = previous
            if (index + 1 < lineCount) { current.next = lines[index + 1] }
            previous = current
        })

        this.first = lineCount > 0 ? lines[0]             : undefined
        this.last  = lineCount > 0 ? lines[lineCount - 1] : undefined
    }

    public insertLine(lineNumber: number, content: LineContent): Line {
        this.resetVersionMerging()

        const lastLineNumber = this.getLastLineNumber()
        const newLastLine = lastLineNumber + 1
        const adjustedLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)

        const includedChildren = this.getChildrenContaining(Math.min(adjustedLineNumber,     lastLineNumber))
        const expandedChildren = this.getChildrenContaining(Math.min(adjustedLineNumber - 1, lastLineNumber))
        const affectedChildren = Array.from(new Set(includedChildren.concat(expandedChildren)))

        let createdLine: BlockLine

        if (adjustedLineNumber === 1) {
            const firstActive = this.getFirstActiveBlockLine()
            createdLine = new BlockLine(this, LineType.Inserted, content, { 
                previous:    firstActive.previous,
                next:        firstActive,
                knownBlocks: affectedChildren
            })

            if (!createdLine.previous) { 
                this.first = createdLine
            }
        } else if (adjustedLineNumber === newLastLine) {
            const lastActive  = this.getLastActiveBlockLine()
            createdLine = new BlockLine(this, LineType.Inserted, content, { 
                previous:    lastActive,
                next:        lastActive.next,
                knownBlocks: affectedChildren
            })

            if (!createdLine.next) { 
                this.last = createdLine
            }
        } else {
            const currentLine = this.getBlockLine(adjustedLineNumber)
            createdLine  = new BlockLine(this, LineType.Inserted, content, { 
                previous:    currentLine.previous, 
                next:        currentLine,
                knownBlocks: affectedChildren
            })
        }

        expandedChildren.forEach(child => {
            const snapshotData = child.compress()
            const lineNumber   = createdLine.getLineNumber(this)
            if (snapshotData._endLine < lineNumber) {
                snapshotData._endLine = lineNumber
                child.updateInParent(snapshotData)
            }
        })

        return createdLine.getLine(this)
    }

    public insertLines(lineNumber: number, content: LineContent[]): Line[] {
        return content.map((content, index) => {
            return this.insertLine(lineNumber + index, content)
        })
    }

    public updateLine(lineNumber: number, content: string): Line {
        const line = this.getLine(lineNumber)
        line.update(content)

        this.setupVersionMerging(line)

        return line
    }

    public updateLines(lineNumber: number, content: string[]): Line[] {
        this.resetVersionMerging()

        const lines = this.getLineRange({ startLine: lineNumber, endLine: lineNumber + content.length - 1 })
        lines.forEach((line, index) => line.update(content[index]))
        return lines
    }

    public deleteLine(lineNumber: number): Line {
        this.resetVersionMerging()

        const line = this.getLine(lineNumber)
        line.delete()
        return line
    }

    public deleteLines(range: LineRange): Line[] {
        const lines = this.getLineRange(range)
        lines.forEach(line => line.delete())
        return lines
    }

    public createChild(range: IRange): Block | null {

        const lineRange = { startLine: range.startLineNumber, endLine: range.endLineNumber }
        const overlappingSnapshot = this.getChildren().find(snapshot => snapshot.overlapsWith(lineRange))

        if (overlappingSnapshot) { 
            console.warn("Could not create snapshot due to overlap!")
            return null
        }

        const firstLine = this.getBlockLine(range.startLineNumber)
        const lastLine  = this.getBlockLine(range.endLineNumber)
        const child     = new Block(this.eol, { parent: this, firstLine, lastLine })

        this.addChild(child)

        return child
    }

    public addChild(block: Block): void {
        this.children.set(block.id, block)
    }

    public getChild(id: string): Block {
        if (!this.children.has(id)) { throw new Error(`Child Block with ID ${id} does not exist!`) }
        return this.children.get(id)
    }

    public getChildren(): Block[] { 
        return Array.from(this.children.values())
    }

    public getChildrenContaining(lineNumber: number): Block[] {
        return this.getChildren().filter(child => child.containsLineNumber(lineNumber))
    }

    public updateChild(update: VCSSnapshotData): Block {
        const child = this.getChild(update.uuid)
        child.updateInParent(update)
        return child
    }

    public deleteChild(id: string): void {
        this.getChild(id).delete()
        this.children.delete(id)
    }

    public delete(): Block[] {

        this.removeFromLines(true)
        this.parent?.children.delete(this.id)

        this.first = undefined
        this.last  = undefined

        const deletedBlocks = this.getChildren().flatMap(child => child.delete())
        deletedBlocks.push(this)

        this.isDeleted = true

        return deletedBlocks
    }

    // ---------------------- SNAPSHOT FUNCTIONALITY ------------------------

    public getHeads(): LineVersion[] { return this.mapLines(line => line.currentVersion) }

    public getOriginalLineCount(): number { return this.filter(line => !line.isInserted).length }
    public getUserVersionCount():  number { return this.getUnsortedTimeline().length - this.getOriginalLineCount() + 1 }

    private getUnsortedTimeline(): LineVersion[] {
        // isPreInsertion to avoid choosing versions following on a pre-insertion-version, as we simulate those.
        // Same for origin -> cloned versions are not displayed, and are just there for correct code structure
        return this.getVersions().filter(version => { return !version.previous?.isPreInsertion /*&& !version.origin*/ } )
    }

    private getTimeline(): LineVersion[] {
        return this.getUnsortedTimeline().sort((versionA, versionB) => versionA.timestamp - versionB.timestamp)
    }

    public getCurrentVersion(): LineVersion {
        return this.getHeads().filter(head          => !head.isPreInsertion)
                              .sort( (headA, headB) => headB.timestamp - headA.timestamp)[0]
    }

    public getCurrentVersionIndex(): number {
        // establish correct latest hand in the timeline: as we do not include insertion version, but only pre-insertion, those are set to their related pre-insertion versions
        let currentVersion = this.getCurrentVersion()
        if (currentVersion.previous?.isPreInsertion) { currentVersion = currentVersion.previous }
        //if (currentVersion.origin)                   { currentVersion = currentVersion.next }

        const timeline = this.getTimeline()
        const index = timeline.indexOf(currentVersion, 0)

        if (index < 0) { throw new Error("Latest head not in timeline!") }

        return index
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

        let version = timeline[targetIndex] // actually targeted version
        let nextVersion = targetIndex + 1 < timeline.length ? timeline[targetIndex + 1] : undefined

        // handle skipping the pre-insertion version, if it is already applied
        if (version.isHead && version.isPreInsertion) {
            version.next.applyTo(this)
        // handle the undo of the line insertion if we go back by one version
        } else if (nextVersion?.isPreInsertion && nextVersion?.next?.isHead) {
            nextVersion.applyTo(this)
        // handle all traditional cases
        } else {
            version.applyTo(this)
        }
    }

    public updateInParent(range: VCSSnapshotData): Block[] {
        if (!this.parent) { throw new Error("This Block does not have a parent! You cannot update its range within this parent.") }
        if (!this.parent.containsLineNumber(range._startLine)) { throw new Error("Start line is not in range of parent!") }
        if (!this.parent.containsLineNumber(range._endLine))   { throw new Error("End line is not in range of parent!") }

        const currentStartLine = this.getFirstLineNumber()
        const currentEndLine   = this.getLastLineNumber()

        this.removeFromLines()
        this.first = this.parent.getBlockLine(range._startLine)
        this.last  = this.parent.getBlockLine(range._endLine)
        this.addToLines()

        const updatedBlocks = this.getChildren().flatMap(child => {
            const childRange = child.compress()
            if (childRange._startLine === currentStartLine || childRange._endLine === currentEndLine) {

                childRange._startLine = childRange._startLine === currentStartLine ? range._startLine : childRange._startLine
                childRange._endLine   = childRange._endLine   === currentEndLine   ? range._endLine   : childRange._endLine

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

    public compress(): VCSSnapshotData {
        const parent = this
        return {
            uuid:         parent.id,
            _startLine:   parent.getFirstLineNumber(),
            _endLine:     parent.getLastLineNumber(),
            versionCount: parent.getUserVersionCount(),
            versionIndex: parent.getCurrentVersionIndex()
        }
    }

    public getCompressedChildren(): VCSSnapshotData[] {
        return this.getChildren().map(child => child.compress())
    }

    // ---------------------- TAG FUNCTIONALITY ------------------------

    private createCurrentTag(): Tag {
        const heads = new Map<Line, LineVersion>()
        this.forEachLine(line => heads.set(line, line.currentVersion))
        return new Tag(this, heads)
    }

    public createTag(): VCSVersion {

        const tag = this.createCurrentTag()
        this.tags.set(tag.id, tag)

        return {
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

}

type BlockId = string
type TagId   = string

class BlockProvider {

    private readonly blocks = new Map<BlockId, Block>()

    public constructor(blocks?: Block[]) {
        blocks.forEach(block => { this.loadBlock(block) })
    }

    public static newBlockId(): BlockId { return crypto.randomUUID() }

    public static createBlockIdFrom(text?: string): BlockId {
        return text ? text : this.newBlockId()
    }

    public loadBlock(block: Block): void {
        this.blocks.set(block.id, block)
        block.children.forEach(child => this.loadBlock(child))
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
        block.forEachLine(line => {
            if (this.has(line)) {
                this.get(line).apply()
            } else if (this.block?.containsLine(line)) {
                if (line.isInserted) { line.history.firstVersion.apply() }
                else                 { throw new Error("This tag does not allow for valid manipulation of this line. Potentially it was not defined correctly.") }
            }
        })
    }
}

type GhostFile = Block

export class GhostVCSServerV2 extends BasicVCSServer {

    private file: GhostFile | null = null
    private browserWindow: BrowserWindow | undefined

    constructor(browserWindow?: BrowserWindow) {
        super()
        this.browserWindow = browserWindow
    }

    private updatePreview() {
        const versionCounts = this.file.getActiveLines().map(line => { return line.getVersionCount() })
        this.browserWindow?.webContents.send("update-vcs-preview", this.file.getCurrentText(), versionCounts)
    }

    public loadFile(filePath: string | null, eol: string, content: string | null): void {
        this.file = Block.create(eol, content, filePath)
        this.updatePreview()
    }

    public unloadFile(): void {
        this.file = null
    }

    public updatePath(filePath: string): void {
        console.log("UPDATING FILE PATH IS NOT IMPLEMNETED")
        //this.file.filePath = filePath
    }

    public cloneToPath(filePath: string): void {
        console.log("CLONE TO PATH NOT IMPLEMENTED")
    }

    public async createSnapshot(range: IRange): Promise<VCSSnapshotData | null> {
        return this.file.createChild(range)?.compress()
    }

    public deleteSnapshot(uuid: string): void {
        this.file.deleteChild(uuid)
    }

    public async getSnapshot(uuid: string): Promise<VCSSnapshotData> {
        return this.file.getChild(uuid).compress()
    }

    public async getSnapshots(): Promise<VCSSnapshotData[]> {
        return this.file.getCompressedChildren()
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        this.file.updateChild(snapshot)
    }

    public async applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<string> {
        this.file.getChild(uuid).applyIndex(versionIndex)
        this.updatePreview()
        return this.file.getCurrentText()
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        const line = this.file.updateLine(change.lineNumber, change.lineText)
        this.updatePreview()
        return line.blockLine.getBlockIds()
    }

    public async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {

        this.file.resetVersionMerging()


        const startsWithEol = change.insertedText[0] === this.file.eol
        const endsWithEol   = change.insertedText[change.insertedText.length - 1] === this.file.eol

        const insertedAtStartOfStartLine = change.modifiedRange.startColumn === 1
        const insertedAtEndOfStartLine = change.modifiedRange.startColumn > this.file.getLine(change.modifiedRange.startLineNumber).currentContent.length

        const insertedAtEnd   = change.modifiedRange.endColumn > this.file.getLine(change.modifiedRange.endLineNumber).currentContent.length

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
        const modifiedLines = change.lineText.split(this.file.eol)

        if (modifyStartLine) {
            vcsLines = this.file.getLineRange(modifiedRange)
        } else {
            // TODO: pushStartDown case not handled well yet, line tracking is off
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }
        

        const parent = this
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
            const line = parent.file.insertLine(lineNumber, content)
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

        this.updatePreview()

        return affectedLines.map(line => line.blockLine.getBlockIds()).flat()
    }

    public async saveCurrentVersion(uuid: SnapshotUUID): Promise<VCSVersion> {
        const snapshot = this.file.getChild(uuid)
        return snapshot.createTag()
    }
}