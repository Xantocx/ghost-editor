import { BrowserWindow } from "electron";
import { LineChange, MultiLineChange } from "./src/app/components/data/change";
import { VCSSnapshotData, VCSSnapshot } from "./src/app/components/data/snapshot";
import { IRange } from "./src/app/components/utils/range";
import { BasicVCSServer, VCSServer } from "./src/app/components/vcs/vcs-provider";

interface LineRange {
    start: number,
    end: number
}

interface TrackedLineRelation {
    previous?: TrackedLine | undefined
    next?: TrackedLine | undefined
}

interface LineVersionRelation {
    origin?: LineVersion | undefined
    previous?: LineVersion | undefined
    next?: LineVersion | undefined
}

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

        let   line  = this.firstLine
        const lines = [line]

        while (line !== this.lastLine) {
            line = line.next
            lines.push(line)
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
            for (let i = 0; i < lineCount; i++) {
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

    public validLineNumber(lineNumber: number): boolean {
        return lineNumber >= 1 && lineNumber <= this.lineCount
    }

    public validRange(range: LineRange): boolean {
        const startValid = this.validLineNumber(range.start)
        const endValid   = this.validLineNumber(range.end)
        return startValid && endValid && range.start <= range.end
    }

    public getLine(lineNumber: number): TrackedLine {
        if (!this.validLineNumber(lineNumber)) { throw new Error(`Cannot read line for invalid line number ${lineNumber}!`) }

        let line = this.firstLine
        for (let i = 1; i < lineNumber; i++) {
            line = line.next
        }

        return line
    }

    public getLines(range: LineRange): TrackedLine[] {
        if (!this.validRange(range)) { throw new Error(`Cannot read lines for invalid range ${range}`) }
        
        const lines = []

        let current = this.getLine(range.start)
        let end     = this.getLine(range.end)

        while (current !== end) {
            lines.push(current)
            current = current.next
        }
        lines.push(end)

        return lines
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

class TrackedFile extends TrackedBlock {

    public static create(filePath: string | null, eol: string, content: string): TrackedFile {
        const file = new TrackedFile(filePath, eol)

        const lines = content.split(eol)
        const timestamp = file.getTimestamp()

        const trackedLines = lines.map(line => {
            return new TrackedLine(file, timestamp, line)
        })

        file.lines = trackedLines

        return file
    }

    public filePath: string | null
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

    public insertLines(lineNumber: number, content: string[]): TrackedLine[] {
        return content.map((line, index) => {
            return this.insertLine(lineNumber + index, line)
        })
    }

    public deleteLine(lineNumber: number): ArchivedBlock {
        return this.deleteLines({ start: lineNumber, end: lineNumber })
    }

    public deleteLines(range: LineRange): ArchivedBlock {
        if (!this.validRange(range)) { throw new Error(`Cannot delete invalid range ${range}`) }

        const start = this.getLine(range.start)
        const end   = this.getLine(range.end)

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

    public updateLine(lineNumber: number, content: string): TrackedLine {
        const line = this.getLine(lineNumber)
        line.update(this.getTimestamp(), content)
        return line
    }

    public updateLines(lineNumber, content: string[]): TrackedLine[] {
        const count = content.length
        const timestamp = this.getTimestamp()
        const lines = this.getLines({ start: lineNumber, end: lineNumber + count - 1 })
        return lines.map((line, index) => {
            line.update(timestamp, content[index])
            return line
        })
    }
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

    public update(timestamp: number, content: string): LineVersion {
        return this.history.createNewVersion(timestamp, content)
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
        this.line  = line
        this.start = new LineVersion(this, initialTimestamp, initialContent)
        this.end   = this.start
        this.head  = this.start
    }

    private cloneHeadToEnd(timestamp: number): LineVersion {
        this.end = this.head.clone(timestamp, { previous: this.end })
        this.head = this.end
        return this.head
    }

    public createNewVersion(timestamp: number, content: string): LineVersion {
        if (this.head !== this.end) {
            this.cloneHeadToEnd(timestamp)
        }

        this.end = new LineVersion(this, timestamp, content, { previous: this.end })
        this.head = this.end

        return this.head
    }

}

class LineVersion {

    public readonly histoy: LineHistory

    public readonly timestamp: number
    public readonly content: string

    public readonly origin: LineVersion | undefined
    private clones: LineVersion[] = []

    public previous: LineVersion | undefined
    public next: LineVersion | undefined

    constructor(history: LineHistory, timestamp: number, content: string, relations?: LineVersionRelation) {
        this.histoy = history
        this.timestamp = timestamp
        this.content = content

        if (relations) {
            this.origin = relations.origin
            this.previous = relations.previous
            this.next = relations.next

            if (this.origin)   { this.origin.clones.push(this) }
            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public clone(timestamp: number, relations?: LineVersionRelation): LineVersion {
        if (!relations?.origin) { relations.origin = this }
        return new LineVersion(this.histoy, timestamp, this.content, relations)
    }
}

class Snapshot {

}


export class GhostVCSServer extends BasicVCSServer {

    private file: TrackedFile | null = null
    private browserWindow: BrowserWindow | undefined

    constructor(browserWindow?: BrowserWindow) {
        super()
        this.browserWindow = browserWindow
    }

    private updatePreview() {
        this.browserWindow?.webContents.send("update-vcs-preview", this.file.currentText)
    }

    public loadFile(filePath: string | null, eol: string, content: string | null): void {
        this.file = TrackedFile.create(filePath, eol, content)
        this.updatePreview()
    }

    public unloadFile(): void {
        this.file = null
    }

    public updatePath(filePath: string): void {
        this.file.filePath = filePath
    }

    public cloneToPath(filePath: string): void {
        console.log("CLONE TO PATH NOT IMPLEMENTED")
    }

    public async createSnapshot(range: IRange): Promise<VCSSnapshotData> {
        return new VCSSnapshot(crypto.randomUUID(), this, range)
    }

    public async getSnapshots(): Promise<VCSSnapshotData[]> {
        return []
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        console.log("UPDATE SNAPSHOT NOT IMPLEMENTED")
    }

    public lineChanged(change: LineChange): void {
        this.file.updateLine(change.lineNumber, change.fullText)
        this.updatePreview()
    }

    public linesChanged(change: MultiLineChange): void {
        console.log("LINES CHANGED")
        this.updatePreview()
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        console.log("GET VERSION NOT IMPLEMENTED")
    }
}