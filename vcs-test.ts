const Diff = require('diff');
import { BrowserWindow } from "electron";
import { LineChange, MultiLineChange } from "./src/app/components/data/change";
import { VCSSnapshotData, VCSSnapshot } from "./src/app/components/data/snapshot";
import { IRange } from "./src/app/components/utils/range";
import { BasicVCSServer, VCSServer } from "./src/app/components/vcs/vcs-provider";

interface LineRange {
    startLine: number,
    endLine: number
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

    public eol: string

    protected firstLine: TrackedLine | undefined
    protected lastLine:  TrackedLine | undefined

    public get firstActiveLine(): TrackedLine | undefined {
        return this.firstLine.currentlyActive ? this.firstLine : this.firstLine.nextActive
    }

    public get lastActiveLine(): TrackedLine | undefined {
        return this.lastLine.currentlyActive ? this.lastLine : this.lastLine.previousActive
    }

    constructor(eol: string, firstLine?: TrackedLine | undefined, lastLine?: TrackedLine | undefined) {
        this.eol = eol
        this.firstLine = firstLine
        this.lastLine  = lastLine
    }

    public get lineCount(): number {
        return this.lastActiveLine.lineNumber
    }

    public get activeLines(): TrackedLines {
        return this.lines.filter(line => { return line.currentlyActive })
    }

    public get lines(): TrackedLines {

        let   line  = this.firstLine
        const lines = [line]

        while (line !== this.lastLine) {
            line = line.next
            lines.push(line)
        }

        return new TrackedLines(this.eol, ...lines)
    }

    protected set lines(lines: TrackedLines | TrackedLine[]) {
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
        return this.lines.stringLines
    }

    public get currentText(): string {
        return this.lines.text
    }

    public validLineNumber(lineNumber: number): boolean {
        return lineNumber >= 1 && lineNumber <= this.lineCount
    }

    public validRange(range: LineRange): boolean {
        const startValid = this.validLineNumber(range.startLine)
        const endValid   = this.validLineNumber(range.endLine)
        return startValid && endValid && range.startLine <= range.endLine
    }

    public getLine(lineNumber: number): TrackedLine {
        if (!this.validLineNumber(lineNumber)) { throw new Error(`Cannot read line for invalid line number ${lineNumber}!`) }

        let line = this.firstActiveLine
        while (line && line.lineNumber !== lineNumber) {
            line = line.nextActive
        }

        if (!line) { throw new Error(`Could not find line for valid line number ${lineNumber}!`) }

        return line
    }

    public getLines(range: LineRange): TrackedLines {
        if (!this.validRange(range)) { throw new Error(`Cannot read lines for invalid range ${range}`) }
        
        const lines = []

        let current = this.getLine(range.startLine)
        let end     = this.getLine(range.endLine)

        while (current !== end) {
            lines.push(current)
            current = current.nextActive
        }
        lines.push(end)

        return new TrackedLines(this.eol, ...lines)
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
            const firstActive = this.firstActiveLine
            const insertedLine = new TrackedLine(this, timestamp, content, { 
                previous: firstActive.previous,
                next:     firstActive
            })

            if (!insertedLine.previous) { 
                this.firstLine = insertedLine
            }

            return insertedLine
        } else if (adjustedLineNumber === newLastLine) {
            const lastActive  = this.lastActiveLine
            const insertedLine = new TrackedLine(this, timestamp, content, { 
                previous: lastActive,
                next:     lastActive.next
            })

            if (!insertedLine.next) { 
                this.lastLine = insertedLine
            }

            return insertedLine
        } else {
            const currentLine = this.getLine(adjustedLineNumber)
            const newLine  = new TrackedLine(this, timestamp, content, { 
                previous: currentLine.previous, 
                next:     currentLine 
            })
            return newLine
        }
    }

    public insertLines(lineNumber: number, content: string[]): TrackedLines{
        return new TrackedLines(this.eol, ...content.map((line, index) => {
            return this.insertLine(lineNumber + index, line)
        }))
    }

    public deleteLine(lineNumber: number): TrackedLine {
        const line = this.getLine(lineNumber)
        line.delete(this.getTimestamp())
        return line
    }

    public deleteLines(range: LineRange): TrackedLines {

        const timestamp = this.getTimestamp()
        const lines = this.getLines(range)

        lines.forEach(line => {
            line.delete(timestamp)
        })

        return lines
    }

    public updateLine(lineNumber: number, content: string): TrackedLine {
        const line = this.getLine(lineNumber)
        line.update(this.getTimestamp(), content)
        return line
    }

    public updateLines(lineNumber: number, content: string[]): TrackedLines {
        const count = content.length
        const timestamp = this.getTimestamp()
        const lines = this.getLines({ startLine: lineNumber, endLine: lineNumber + count - 1 })

        lines.forEach((line, index) => {
            line.update(timestamp, content[index])
        })

        return lines
    }
}

class TrackedLine {

    public readonly file: TrackedFile
    public readonly history: LineHistory

    public previous: TrackedLine | undefined
    public next: TrackedLine | undefined

    public get previousActive(): TrackedLine | undefined {

        let previous = this.previous

        while (!previous?.currentlyActive) {
            if (!previous) { return undefined }
            previous = previous.previous
        }

        return previous
    }

    public get nextActive(): TrackedLine | undefined {

        let next = this.next

        while (!next?.currentlyActive) {
            if (!next) { return undefined }
            next = next.next
        }

        return next
    }

    public get lineNumber(): number | null {
        if (!this.currentlyActive) { return null }

        const activePrevious = this.previousActive
        if (activePrevious) {
            return activePrevious.lineNumber + 1
        } else {
            return 1
        }
    }

    public get currentlyActive(): boolean {
        return this.history.currentlyActive
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
        if (content === this.currentContent) { return this.history.head }
        return this.history.createNewVersion(timestamp, true, content)
    }

    public delete(timestamp: number): LineVersion {
        return this.history.deleteLine(timestamp)
    }
}

class TrackedLines {

    public readonly lines: TrackedLine[]
    public readonly eol: string = "\n"

    constructor(eol: string, ...lines: TrackedLine[]) {
        this.lines = lines
        this.eol = eol
    }

    public get length(): number {
        return this.lines.length
    }

    public get stringLines(): string[] {
        return this.map(line => {
            // return line.currentlyActive ? line.currentContent : null
            return line.currentlyActive ? (line.currentContent ? line.currentContent : "//") : null // temporary fix to see version count for emty lines in preview
        }).filter(string => string !== null)
    }

    public get text(): string {
        return this.stringLines.join(this.eol)
    }

    public at(index: number): TrackedLine {
        return this.lines[index]
    }

    public map<ReturnType>(callback: (line: TrackedLine) => ReturnType): ReturnType[] {
        return this.lines.map(callback)
    }


    public forEach(callback: (line: TrackedLine, index: number) => void): void {
        this.lines.forEach(callback)
    }

    public filter(callback: (line: TrackedLine) => boolean): TrackedLines {
        return new TrackedLines(this.eol, ...this.lines.filter(callback))
    }
}

class LineHistory {

    public readonly line: TrackedLine
    
    public head: LineVersion

    private start: LineVersion
    private end: LineVersion

    public get versionCount(): number {

        let count = 0
        let version = this.start

        while (version) {
            count++
            version = version.next
        }

        return count
    }

    public get currentlyActive(): boolean {
        return this.head.active
    }

    public get currentContent(): string {
        return this.head.content
    }

    constructor(line: TrackedLine, initialTimestamp: number, initialContent: string) {
        this.line  = line
        this.start = new LineVersion(this, initialTimestamp, false, "")
        this.end   = new LineVersion(this, initialTimestamp, true, initialContent, { previous: this.start })
        this.head  = this.end
    }

    private cloneHeadToEnd(timestamp: number): LineVersion {
        this.end = this.head.clone(timestamp, { previous: this.end })
        this.head = this.end
        return this.head
    }

    public createNewVersion(timestamp: number, active: boolean, content: string): LineVersion {
        if (this.head !== this.end) {
            this.cloneHeadToEnd(timestamp)
        }

        this.end = new LineVersion(this, timestamp, active, content, { previous: this.end })
        this.head = this.end

        return this.head
    }

    public deleteLine(timestamp: number): LineVersion {
        return this.createNewVersion(timestamp, false, "")
    }

}

class LineVersion {

    public readonly histoy: LineHistory

    public readonly timestamp: number
    public readonly active: boolean
    public readonly content: string

    public readonly origin: LineVersion | undefined
    private clones: LineVersion[] = []

    public previous: LineVersion | undefined
    public next: LineVersion | undefined

    constructor(history: LineHistory, timestamp: number, active: boolean, content: string, relations?: LineVersionRelation) {
        this.histoy = history
        this.timestamp = timestamp
        this.active = active
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
        return new LineVersion(this.histoy, timestamp, this.active, this.content, relations)
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

    private computeDiff(vcsText: string, modifiedText: string): any {
        return Diff.diffLines(vcsText, modifiedText)
    }

    private calculateDiff(vcsText: string, modifiedText: string) {
        const diffResult = Diff.diffLines(vcsText, modifiedText);
      
        let lineNumber = 1;
        diffResult.forEach((part) => {
            const lines = part.value.split('\n');
            lines.pop(); // Remove the last empty element
        
            lines.forEach((line) => {
                if (part.added) {
                console.log(`Line ${lineNumber}: New line: ${line}`);
                } else if (part.removed) {
                console.log(`Line ${lineNumber}: Deleted line: ${line}`);
                } else {
                console.log(`Line ${lineNumber}: Unchanged line: ${line}`);
                }
                lineNumber++;
            });
        });
    }

    private updatePreview() {
        const versionCounts = this.file.activeLines.map(line => {
            return line.history.versionCount
        })

        this.browserWindow?.webContents.send("update-vcs-preview", this.file.currentText, versionCounts)
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
        this.file.updateLine(change.lineNumber, change.lineText)
        this.updatePreview()
    }

    public linesChanged(change: MultiLineChange): void {

        function countStartingChars(line: string, character: string): number {
            let count = 0
            while(line[count] === character) { count++ }
            return count
        }

        function countEndingChars(line: string, character: string): number {
            let index = line.length - 1
            while(index >= 0 && line[index] === character) { index-- }
            return line.length - 1 - index
        }

        const startsWithEol = change.insertedText[0] === this.file.eol
        const endsWithEol   = change.insertedText[change.insertedText.length - 1] === this.file.eol

        const insertedAtStartOfStartLine = change.modifiedRange.startColumn === 1
        const insertedAtEnd   = change.modifiedRange.endColumn > this.file.getLine(change.modifiedRange.endLineNumber).currentContent.length

        const oneLineModification = change.modifiedRange.startLineNumber === change.modifiedRange.endLineNumber
        const insertOnly = oneLineModification && change.modifiedRange.startColumn == change.modifiedRange.endColumn
        
        /*
        if (insertOnly) {
            // line === startLine === endLine, no code overwritten, but line may be split
            if (insertedAtStartOfStartLine) {
                if (endsWithEol) {
                    // we insert above line
                } else {
                    // line is def modified, every newline is inserted above
                }
            } else if (insertedAtEnd) {
                if (startsWithEol) {
                    // we insert below line
                } else {
                    // line is def modified, every newline is inserted below
                }
            } else {
                // line is modified, we insert newlines below
            }
        } else if (oneLineModification) {
            // line === startLine === endLine, overwrite some code
            // line is modified, we insert newlines below
        } else {
            // startLine !== endLine
            if (!insertedAtStartOfStartLine) {
                // modify startLine
            }

            // overwrite all lines between startLine and endLine
            // delete lines if less were written
            // insert lines if more were written
            
            if (!insertedAtEnd) {
                // modify endLine
            }
        }
        */

        const insertedAtEndOfStartLine = change.modifiedRange.startColumn > this.file.getLine(change.modifiedRange.startLineNumber).currentContent.length
        const pushStartLineDown = insertedAtStartOfStartLine && endsWithEol  // start line is not modified and will be below the inserted lines
        const pushStartLineUp   = insertedAtEndOfStartLine && startsWithEol  // start line is not modified and will be above the inserted lines
        const modifyStartLine = !insertOnly || !(pushStartLineDown) && !(pushStartLineUp)

        const timestamp = this.file.getTimestamp()
        const modifiedLines = change.lineText.split(this.file.eol)

        const modifiedRange = {
            startLine: change.modifiedRange.startLineNumber,
            endLine:   change.modifiedRange.endLineNumber
        }

        let vcsLines: TrackedLines = new TrackedLines(this.file.eol)
        if (modifyStartLine) {
            vcsLines = this.file.getLines(modifiedRange)
            vcsLines.at(0).update(timestamp, modifiedLines[0])
        } else {
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }

        const linesToConsider = Math.max(vcsLines.length, modifiedLines.length)

        for (let i = 1; i < linesToConsider; i++) {
            if (i < vcsLines.length) {
                if (i < modifiedLines.length) {
                    vcsLines.at(i).update(timestamp, modifiedLines[i])
                } else {
                    vcsLines.at(i).delete(timestamp)
                }
            } else {
                this.file.insertLine(modifiedRange.startLine + i, modifiedLines[i])
            }
        }




        /*
        console.log(modifiedLines)

        vcsLines.forEach((line, index) => {
            console.log("VCS: " + line.currentContent)

            if (index < modifiedLines.length) {
                const modifiedText = modifiedLines[index]
                if (line.currentContent !== modifiedText) {
                    line.update(timestamp, modifiedText)
                }

            } else {
                line.delete(timestamp)
            }
        })

        if (vcsLines.length < modifiedLines.length) {
            this.file.insertLines(modifiedRange.endLine + 1, modifiedLines.slice(vcsLines.length, -1))
        }
        */

        this.updatePreview()
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        console.log("GET VERSION NOT IMPLEMENTED")
    }
}