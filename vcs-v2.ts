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

    public toArray(): Node[] {
        const array: Node[] = []
        this.forEach(node => array.push(node))
        return array
    }
}

enum LineType { Original, Inserted }
type LineContent = string

class Line extends LinkedListNode<Line> {

    public readonly block:    Block
    public readonly lineType: LineType
    public readonly history:  LineHistory

    public get isOriginal(): boolean { return this.lineType === LineType.Original }
    public get isInserted(): boolean { return this.lineType === LineType.Inserted }

    public get isActive():       boolean     { return this.history.isActive }
    public get currentVersion(): LineVersion { return this.history.head }
    public get currentContent(): LineContent { return this.currentVersion.content }

    public constructor(block: Block, lineType: LineType, content: LineContent, relations: { previous?: Line, next?: Line }) {
        super(block)

        this.block    = block
        this.lineType = lineType
        this.history  = new LineHistory(this, content)

        if (relations) {
            this.previous = relations.previous
            this.next     = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public getPreviousActiveLine(): Line { return this.findPrevious(line => line.isActive) }
    public getNextActiveLine():     Line { return this.findNext(line => line.isActive) }

    public getLineNumber(): number { 
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

type LineVersionTag = VersionTag<Block>
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

class Block extends LinkedList<Line> {

    public lastModifiedLine: Line | undefined = undefined

    public get firstLine(): Line | undefined { return this.first }
    public get lastLine():  Line | undefined { return this.last }

    public set firstLine(line: Line | undefined) { this.first = line }
    public set lastLine (line: Line | undefined) { this.last  = line }
}

class VersionTag<BlockType extends Block> {

    protected readonly block:   BlockType
    protected readonly versions: Map<Line, LineVersion>

    constructor(block: BlockType, versions?: Map<Line, LineVersion>) {
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

type BlockTag = VersionTag<Block>

class NamedTag extends VersionTag<NamedBlock> {

    public get name(): BlockName { return this.block.name }

}

// basically a fancy URL
class BlockName {

    public readonly resourceIdentifier: string
    public readonly snapshotIdentifier: string
    public readonly tagIdentifier:      string

    public constructor(resourceIdentifier: string, snapshotIdentifier: string, tagIdentifier: string) {
        this.resourceIdentifier = resourceIdentifier
        this.snapshotIdentifier = snapshotIdentifier
        this.tagIdentifier      = tagIdentifier
    }
}

class NamedBlock extends Block {

    public readonly name: BlockName

    constructor(name: BlockName) {
        super()
        this.name = name
    }
}

type GhostFile = NamedBlock
type Snapshot = NamedBlock