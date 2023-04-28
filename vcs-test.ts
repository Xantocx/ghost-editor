import { LineChange, MultiLineChange, AnyChange, ChangeSet } from "./src/app/components/data/change";
import { VCSSnapshotData, VCSSnapshot } from "./src/app/components/data/snapshot";
import { IRange } from "./src/app/components/utils/range";
import { VCSServer } from "./src/app/components/vcs/vcs-provider";

class TrackedBlock {

    protected eol: string

    protected firstLine: TrackedLine | undefined
    protected lastLine:  TrackedLine | undefined

    constructor(eol: string, firstLine?: TrackedLine | undefined, lastLine?: TrackedLine | undefined) {
        this.eol = eol
        this.firstLine = firstLine
        this.lastLine  = lastLine
    }

    public get lineCount(): number {
        return this.lines.length
    }

    public get lines(): TrackedLine[] {

        const lines = []
        let   line  = this.firstLine

        while (line !== this.lastLine) {
            lines.push(line)
            line = line.next
        }

        return lines
    }

    protected set lines(lines: TrackedLine[]) {
        const lineCount = lines.length

        if (lineCount === 0) {
            this.firstLine = undefined
            this.lastLine  = undefined
        } else {
            this.firstLine = lines[0]
            this.lastLine  = lines[lineCount - 1]

            let previous: TrackedLine | undefined = undefined
            for (let i = 0; i <= lineCount; i++) {
                const current = lines[i]

                current.previous = previous
                if (i < lineCount - 1) { current.next = lines[i + 1] }

                previous = current
            }
        }
    }

    public get stringLines(): string[] {
        return this.lines.map(line => {
            return line.currentContent
        })
    }

    public get currentText(): string {
        return this.stringLines.join(this.eol)
    }

    public getLine(lineNumber: number): TrackedLine | null {
        const lineCount = this.lineCount
        if (lineNumber < 1 || lineNumber > lineCount) { return null }

        let line = this.firstLine
        for (let i = 1; i < lineNumber; i++) {
            line = line.next
        }

        return line
    }
}

class ArchivedBlock extends TrackedBlock {

    // used to determine original location in the code
    public readonly previous: TrackedLine | undefined
    public readonly next: TrackedLine | undefined

    constructor(eol: string, firstLine: TrackedLine, lastLine: TrackedLine, relations?: TrackedLineRelation) {
        super(eol, firstLine, lastLine)

        if (relations) {
            this.previous = relations.previous
            this.next = relations.next
        }
    }
}

interface LineRange {
    start: number,
    end: number
}

class TrackedFile extends TrackedBlock {

    public static create(filePath: string | null, eol: string, content: string): TrackedFile {
        const file = new TrackedFile(filePath, eol)

        const lines = content.split(eol)
        const timestamp = file.getTimestamp()

        const trackedLines = lines.map(line => {
            return new TrackedLine(file, timestamp, line)
        })

        file.lines = trackedLines
        console.log(file.currentText)

        return file
    }

    private filePath: string | null
    private archivedBlocks: ArchivedBlock[] = []
    private snapshots: Snapshot[] = []

    constructor(filePath: string | null, eol: string) {
        super(eol)
        this.filePath = filePath
    }

    private nextTimestamp = 0
    public getTimestamp(): number {
        const timestamp = this.nextTimestamp
        this.nextTimestamp++
        return timestamp
    }

    public insertLine(lineNumber: number, content: string): TrackedLine {
        const newLastLine = this.lineCount + 1
        const adjustedLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)
        const timestamp = this.getTimestamp()

        if (adjustedLineNumber === 1) {
            this.firstLine = new TrackedLine(this, timestamp, content, { next:    this.firstLine })
            return this.firstLine
        } else if (adjustedLineNumber === newLastLine) {
            this.lastLine  = new TrackedLine(this, timestamp, content, { previous: this.lastLine })
            return this.lastLine
        } else {
            const currentLine = this.getLine(adjustedLineNumber)
            const newLine  = new TrackedLine(this, timestamp, content, { 
                previous: currentLine.previous, 
                next: currentLine 
            })
            return newLine
        }
    }

    public insertLines(lineNumber: number, contents: string[]): TrackedLine[] {
        let offset = 0
        return contents.map(line => {
            return this.insertLine(lineNumber + offset++, line)
        })
    }

    public deleteLine(lineNumber: number): ArchivedBlock {
        return this.deleteLines({ start: lineNumber, end: lineNumber })
    }

    public deleteLines(range: LineRange): ArchivedBlock {
        if (range.start > range.end) { throw new Error(`Start of range cannot be smaller than end: ${range}`) }

        const start = this.getLine(range.start)
        const end   = this.getLine(range.end)

        if (!start || !end) { throw new Error(`Cannot delete invalid range ${range}!`) }

        const previous = start.previous
        const next     = end.next

        const archivedBlock = new ArchivedBlock(this.eol, start, end, {
            previous: previous,
            next: next
        })

        if (previous) { previous.next = next }
        if (next)     { next.previous = previous }

        start.previous = undefined
        end.next       = undefined

        this.archivedBlocks.push(archivedBlock)
        return archivedBlock
    }
}

interface TrackedLineRelation {
    previous?: TrackedLine | undefined
    next?: TrackedLine | undefined
}

class TrackedLine {

    public readonly file: TrackedFile
    public readonly history: LineHistory

    public previous: TrackedLine | undefined
    public next: TrackedLine | undefined

    public get lineNumber() {
        if (this.previous) {
            return this.previous.lineNumber + 1
        } else {
            return 1
        }
    }

    public get currentContent(): string {
        return this.history.currentContent
    }

    constructor(file: TrackedFile, initialTimestamp: number, initialContent: string, relations?: TrackedLineRelation) {
        this.file = file
        this.history = new LineHistory(this, initialTimestamp, initialContent)

        if (relations) {
            this.previous = relations.previous
            this.next = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }
}

class LineHistory {

    public readonly line: TrackedLine
    
    private head: LineVersion

    private start: LineVersion
    private end: LineVersion

    public get currentContent(): string {
        return this.head.content
    }

    constructor(line: TrackedLine, initialTimestamp: number, initialContent: string) {
        this.line = line
        this.start = new LineVersion(this, initialTimestamp, initialContent)
        this.head = this.start
    }

}

interface LineVersionRelation {
    origin?: LineVersion | undefined
    previous?: LineVersion | undefined
    next?: LineVersion | undefined
}

class LineVersion {

    public readonly histoy: LineHistory

    public readonly timestamp: number
    public readonly content: string

    public readonly origin: LineVersion | undefined
    private clones: LineVersion[] = []

    private previous: LineVersion | undefined
    private next: LineVersion | undefined

    constructor(history: LineHistory, timestamp: number, content: string, relations?: LineVersionRelation) {
        this.histoy = history
        this.timestamp = timestamp
        this.content = content

        if (relations) {
            this.origin = relations.origin
            this.previous = relations.previous
            this.next = relations.next
        }
    }
}

class Snapshot {

}


export class GhostVCSServer {

    private filePath: string | null

    public loadFile(filePath: string | null, content: string | null): void {
        this.filePath = filePath
    }

    public unloadFile(): void {
        console.log("UNLOADED")
    }

    public updatePath(filePath: string): void {
        console.log("UPDATE PATH")
    }

    public cloneToPath(filePath: string): void {
        console.log("CLONE TO PATH")
    }

    public async createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        console.log("CREATE SNAPSHOT")
        return new VCSSnapshot(crypto.randomUUID(), this, range)
    }

    public async getSnapshots(): Promise<VCSSnapshotData[]> {
        return []
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        console.log("UPDATE SNAPSHOT")
    }

    public lineChanged(change: LineChange): void {
        console.log("LINE CHANGED")
    }

    public linesChanged(change: MultiLineChange): void {
        console.log("LINES CHANGED")
    }

    public applyChange(change: AnyChange): void {
        console.log("APPLY CHANGE")
    }

    public applyChanges(changes: ChangeSet): void {
        console.log("APPLY CHANGES")
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        console.log("GET VERSION")
    }
}