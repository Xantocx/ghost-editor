/*
function applyMixins(derivedCtor: any, constructors: any[]) {
    constructors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
            Object.defineProperty(
            derivedCtor.prototype,
            name,
            Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
                Object.create(null)
            );
        });
    });
}
*/

import { VCSSnapshotData } from "./src/app/components/data/snapshot"
import { IRange } from "./src/app/components/utils/range"

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

    public getPosition():          number { return this.previous ? this.previous.getPosition()  + 1 : 0 }
    public getPreviousNodeCount(): number { return this.getPosition() }
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
}

abstract class LinkedList<Node extends LinkedListNode<Node>> {
    public first?: Node
    public last?: Node

    public getLength(): number { return this.last.getPosition() + 1 }

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

class Line extends LinkedListNode<Line> {

    public readonly block:    Block
    public readonly lineType: LineType
    public readonly history:  LineHistory

    public readonly knownBlocks: Block[]

    public get isOriginal(): boolean { return this.lineType === LineType.Original }
    public get isInserted(): boolean { return this.lineType === LineType.Inserted }

    public get isActive():       boolean     { return this.history.isActive }
    public get currentVersion(): LineVersion { return this.history.head }
    public get currentContent(): LineContent { return this.currentVersion.content }

    public constructor(block: Block, lineType: LineType, content: LineContent, relations?: LineRelations) {
        super(block)

        this.block    = block
        this.lineType = lineType
        this.history  = new LineHistory(this, content)

        this.knownBlocks = relations?.knownBlocks ? relations.knownBlocks : []

        if (relations) {
            this.previous = relations.previous
            this.next     = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public getPreviousActiveLine(): Line | null { return this.findPrevious(line => line.isActive) }
    public getNextActiveLine():     Line | null { return this.findNext    (line => line.isActive) }

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
        if (this.block.lastModifiedLine === this) { return this.history.updateCurrentVersion(content) }
        return this.history.createNewVersion(true, content)
    }

    public delete(): LineVersion {
        return this.history.deleteLine()
    }

    public addBlock(block: Block): void {
        if (!this.knownBlocks.includes(block)) { this.knownBlocks.push(block) }
    }

    public removeBlock(block: Block): void {
        const index = this.knownBlocks.indexOf(block, 0)
        if (index > -1) { this.knownBlocks.splice(index, 1) }
    }
}

class LineHistory extends LinkedList<LineVersion> {

    public readonly line: Line

    private _head: LineVersion
    private headTracking = new Map<Timestamp, LineVersion>()

    public get head(): LineVersion { return this._head }
    public set head(version: LineVersion) { 
        this._head = version
        if (this.head.timestamp < this.lastVersion.timestamp) {
            this.headTracking.set(this.getTimestamp(), version)
        }
    } 

    public get firstVersion(): LineVersion | undefined { return this.first }
    public get lastVersion():  LineVersion | undefined { return this.last }

    public set firstVersion(line: LineVersion) { this.first = line }
    public set lastVersion (line: LineVersion) { this.last  = line }

    public get isActive(): boolean  { return this.head.isActive }

    public constructor(line: Line, content: LineContent) {
        super()
        this.line = line

        if (this.line.isOriginal) {
            this.firstVersion = new LineVersion(this, this.getTimestamp(), true, content)
            this.lastVersion  = this.firstVersion
        } else if (this.line.isInserted) {
            this.firstVersion = new LineVersion(this, this.getTimestamp(), false, "")
            this.lastVersion  = new LineVersion(this, this.getTimestamp(), true, content, { previous: this.firstVersion })
        } else {
            throw new Error(`Cannot create LineHistory for line with type "${this.line.lineType}"!`)
        }

        this.head = this.lastVersion
    }

    private getTimestamp(): number { return TimestampProvider.getTimestamp() }

    public getVersions(): LineVersion[] { return this.toArray() }

    public getVersion(timestamp: Timestamp): LineVersion {
        // search forward through history for this line and find biggest timestamp smaller or equal to the searched timestamp
        let version = this.find(version => {
            const smallerTimestamp    = version.timestamp <= timestamp
            const nextTimestampBigger = !version.next || version.next.timestamp > timestamp
            return smallerTimestamp && nextTimestampBigger
        })

        // search backwards through the keys (aka timestamps) of the tracked timestamps and find the biggest timestamp bigger than the previously found one, but smaller or equal to the searched one
        const trackedTimestamps = Array.from(this.headTracking.keys())
        for (let i = trackedTimestamps.length - 1; i >= 0; i--) {
            const trackedTimestamp = trackedTimestamps[i]
            if (trackedTimestamp > version.timestamp && trackedTimestamp <= timestamp) {
                version = this.headTracking.get(trackedTimestamp)
                break
            }
        }

        return version
    }

    public loadTimestamp(timestamp: Timestamp): LineVersion {
        const version = this.getVersion(timestamp)
        version.apply()
        return version
    }

    public cloneHeadToEnd(): LineVersion {
        this.lastVersion = this.head.clone(this.getTimestamp(), { previous: this.lastVersion })
        this.head        = this.lastVersion
        return this.head
    }

    public createNewVersion(isActive: boolean, content: LineContent): LineVersion {
        if (this.head !== this.lastVersion) { this.cloneHeadToEnd() }

        this.lastVersion = new LineVersion(this, this.getTimestamp(), isActive, content, { previous: this.lastVersion })
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
        super(history)

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

    public apply():                      void { this.history.head = this }
    public update(content: LineContent): void { this.content = content }

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

class Block extends LinkedList<Line> {

    public readonly identifier = BlockProvider.newBlockIdentifier()
    public isDeleted = false

    public readonly eol: string
    public readonly parent?: Block
    public readonly children = new Map<BlockIdentifier, Block>()

    public lastModifiedLine: Line | undefined = undefined

    public get firstLine(): Line | undefined { return this.first }
    public get lastLine():  Line | undefined { return this.last }

    public set firstLine(line: Line | undefined) { this.first = line }
    public set lastLine (line: Line | undefined) { this.last  = line }

    public static create(eol: string, content: string): Block {
        const block       = new Block(eol)
        const lineStrings = content.split(eol)

        const lines = lineStrings.map(content => {
            return new Line(block, LineType.Original, content)
        })

        block.setLines(lines)
        return block
    }

    public constructor(eol: string, options?: { parent?: Block, firstLine?: Line, lastLine?: Line }) {
        super()

        this.eol = eol

        this.parent    = options?.parent
        this.firstLine = options?.firstLine
        this.lastLine  = options?.lastLine

        this.addToLines()
    }

    public getFirstActiveLine(): Line | null { return this.firstLine.isActive ? this.firstLine : this.firstLine.getNextActiveLine() }
    public getLastActiveLine():  Line | null { return this.lastLine.isActive  ? this.lastLine  : this.lastLine.getPreviousActiveLine() }

    public getFirstLineNumber(): number { return this.getFirstActiveLine().getLineNumber() }
    public getLastLineNumber():  number { return this.getLastActiveLine().getLineNumber() }

    public getLineCount():       number        { return this.getLength() }
    public getActiveLineCount(): number | null { return this.getLastLineNumber() }

    public getLines():       Line[] { return this.toArray() }
    public getActiveLines(): Line[] { return this.filter(line => line.isActive) }

    public getLineContent(): LineContent[] { return this.getActiveLines().map(line => line.currentContent) }
    public getCurrentText(): string        { return this.getLineContent().join(this.eol) }
    
    public getVersions():    LineVersion[] { return this.flatMap(line => line.history.getVersions()) }

    public addToLines():      void { this.forEach(line => line.addBlock(this)) }
    public removeFromLines(): void { this.forEach(line => line.removeBlock(this)) }

    public setupVersionMerging(line: Line): void { this.lastModifiedLine = line }
    public resetVersionMerging():           void { this.lastModifiedLine = undefined }

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

    public getLine(lineNumber: number): Line {
        if (!this.containsLineNumber(lineNumber)) { throw new Error(`Cannot read line for invalid line number ${lineNumber}!`) }

        const line = this.find(line => line.getLineNumber() === lineNumber)
        if (!line) { throw new Error(`Could not find line for valid line number ${lineNumber}!`) }

        return line
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

    public setLines(lines: Line[]): void {
        const lineCount = lines.length

        let previous: Line | undefined = undefined
        lines.forEach((current: Line, index: number) => {
            current.previous = previous
            if (index + 1 < lineCount) { current.next = lines[index + 1] }
            previous = current
            current.addBlock(this)
        })

        this.firstLine = lineCount > 0 ? lines[0]             : undefined
        this.lastLine  = lineCount > 0 ? lines[lineCount - 1] : undefined
    }

    public insertLine(lineNumber: number, content: LineContent): Line {
        this.resetVersionMerging()

        const lastLineNumber = this.getLastLineNumber()
        const newLastLine = lastLineNumber + 1
        const adjustedLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)

        const includedChildren = this.getChildrenContaining(Math.min(adjustedLineNumber,     lastLineNumber))
        const expandedChildren = this.getChildrenContaining(Math.min(adjustedLineNumber - 1, lastLineNumber))
        const affectedChildren = Array.from(new Set(includedChildren.concat(expandedChildren)))

        let createdLine: Line

        if (adjustedLineNumber === 1) {
            const firstActive = this.getFirstActiveLine()
            createdLine = new Line(this, LineType.Inserted, content, { 
                previous:    firstActive.previous,
                next:        firstActive,
                knownBlocks: affectedChildren
            })

            if (!createdLine.previous) { 
                this.firstLine = createdLine
            }
        } else if (adjustedLineNumber === newLastLine) {
            const lastActive  = this.getLastActiveLine()
            createdLine = new Line(this, LineType.Inserted, content, { 
                previous:    lastActive,
                next:        lastActive.next,
                knownBlocks: affectedChildren
            })

            if (!createdLine.next) { 
                this.lastLine = createdLine
            }
        } else {
            const currentLine = this.getLine(adjustedLineNumber)
            createdLine  = new Line(this, LineType.Inserted, content, { 
                previous:    currentLine.previous, 
                next:        currentLine,
                knownBlocks: affectedChildren
            })
        }

        expandedChildren.forEach(child => {
            const snapshotData = child.compress()
            const lineNumber   = createdLine.getLineNumber()
            if (snapshotData._endLine < lineNumber) {
                snapshotData._endLine = lineNumber
                child.updateInParent(snapshotData)
            }
        })

        return createdLine
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
        const overlappingSnapshot = Array.from(this.children.values()).find(snapshot => snapshot.overlapsWith(lineRange))

        if (overlappingSnapshot) { 
            console.warn("Could not create snapshot due to overlap!")
            return null
        }

        const firstLine = this.getLine(range.startLineNumber)
        const lastLine  = this.getLine(range.endLineNumber)
        const child     = new Block(this.eol, { parent: this, firstLine, lastLine })

        this.addChild(child)

        return child
    }

    public addChild(block: Block): void {
        this.children.set(block.identifier, block)
    }

    public getChild(identifier: string): Block {
        if (!this.children.has(identifier)) { throw new Error(`Child Block with Identifier ${identifier} does not exist!`) }
        return this.children.get(identifier)
    }

    public getChildrenContaining(lineNumber: number): Block[] {
        return Array.from(this.children.values()).filter(child => child.containsLineNumber(lineNumber))
    }

    public updateChild(update: VCSSnapshotData): Block {
        const child = this.getChild(update.uuid)
        child.updateInParent(update)
        return child
    }

    public deleteChild(identifier: string): void {
        this.getChild(identifier).delete()
        this.children.delete(identifier)
    }

    public delete(): Block[] {

        this.removeFromLines()
        this.parent?.children.delete(this.identifier)

        this.firstLine = undefined
        this.lastLine  = undefined

        const deletedBlocks = Array.from(this.children.values()).flatMap(child => child.delete())
        deletedBlocks.push(this)

        this.isDeleted = true

        return deletedBlocks
    }

    // ---------------------- SNAPSHOT FUNCTIONALITY ------------------------

    public get heads(): LineVersion[] { return this.map(line => line.currentVersion) }

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
        return this.heads.filter(head          => !head.isPreInsertion)
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

        this.parent?.resetVersionMerging()
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
        this.firstLine = this.parent.getLine(range._startLine)
        this.lastLine  = this.parent.getLine(range._endLine)
        this.addToLines()

        const updatedBlocks = Array.from(this.children.values()).flatMap(child => {
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
            uuid:         parent.identifier,
            _startLine:   parent.getFirstLineNumber(),
            _endLine:     parent.getLastLineNumber(),
            versionCount: parent.getUserVersionCount(),
            versionIndex: parent.getCurrentVersionIndex()
        }
    }

}

type BlockIdentifier = string
type TagIdentifier   = string

// basically a fancy URL
class BlockAddress {

    public readonly parentIdentifier: BlockIdentifier
    public readonly blockIdentifier:  BlockIdentifier
    public readonly tagIdentifier:    TagIdentifier

    public constructor(parentIdentifier: BlockIdentifier, blockIdentifier: BlockIdentifier, tagIdentifier: TagIdentifier) {
        this.parentIdentifier = parentIdentifier
        this.blockIdentifier  = blockIdentifier
        this.tagIdentifier    = tagIdentifier
    }
}

class BlockProvider {

    private readonly blocks = new Map<BlockIdentifier, Block>()

    public constructor(blocks?: Block[]) {
        blocks.forEach(block => { this.loadBlock(block) })
    }

    public static newBlockIdentifier(): BlockIdentifier { return crypto.randomUUID() }

    public loadBlock(block: Block): void {
        this.blocks.set(block.identifier, block)
        block.children.forEach(child => this.loadBlock(child))
    }
}


class VersionTag {

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
        block.forEach((line: Line) => {
            if (this.has(line)) {
                this.get(line).apply()
            } else if (this.block?.contains(line)) {
                if (line.isInserted) { line.history.firstVersion.apply() }
                else                 { throw new Error("This tag does not allow for valid manipulation of this line. Potentially it was not defined correctly.") }
            }
        })
    }
}

type GhostFile = Block