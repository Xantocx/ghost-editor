const Diff = require('diff');
import * as crypto from "crypto"
import { BrowserWindow } from "electron";
import { LineChange, MultiLineChange } from "./src/app/components/data/change";
import { VCSSnapshotData, VCSSnapshot } from "./src/app/components/data/snapshot";
import { IRange } from "./src/app/components/utils/range";
import { BasicVCSServer, SnapshotUUID, VCSServer } from "./src/app/components/vcs/vcs-provider";

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

    public get firstLineNumber(): number {
        return this.firstActiveLine.lineNumber
    }

    public get lastLineNumber(): number {
        return this.lastActiveLine.lineNumber
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
    private snapshots = new Map<string, Snapshot>()

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

    public updateLine(lineNumber: number, content: string): SnapshotUUID[] {
        const line = this.getLine(lineNumber)
        line.update(this.getTimestamp(), content)
        return line.affectedSnapshotUUIDs
    }

    public updateLines(lineNumber: number, content: string[]): SnapshotUUID[] {
        const count = content.length
        const timestamp = this.getTimestamp()
        const lines = this.getLines({ startLine: lineNumber, endLine: lineNumber + count - 1 })

        lines.forEach((line, index) => {
            line.update(timestamp, content[index])
        })

        return lines.flatMap(line => {
            return line.affectedSnapshotUUIDs
        })
    }

    public createSnapshot(range: IRange): Snapshot | null {

        const overlappingSnapshot = Array.from(this.snapshots.values()).find(snapshot => {
            return snapshot.firstLineNumber <= range.endLineNumber && snapshot.lastLineNumber >= range.startLineNumber
        })

        if (overlappingSnapshot) { 
            console.warn("Could not create snapshot due to overlap!")
            return null
        }

        const snapshot = Snapshot.create(this, range)
        this.addSnapshot(snapshot)
        return snapshot
    }

    public addSnapshot(snapshot: Snapshot): void {
        this.snapshots.set(snapshot.uuid, snapshot)
    }

    public getSnapshot(uuid: string): Snapshot {
        if (!this.snapshots.has(uuid)) { throw new Error(`Snapshot with UUID ${uuid} does not exist!`) }
        return this.snapshots.get(uuid)
    }

    public updateSnapshot(update: VCSSnapshotData): Snapshot {
        const snapshot = this.getSnapshot(update.uuid)
        snapshot.update(update)
        return snapshot
    }

    public getSnapshotData(): VCSSnapshotData[] {

        const snapshotData = []

        this.snapshots.forEach(snapshot => {
            snapshotData.push(snapshot.compress())
        })

        return snapshotData
    }
}

class TrackedLine {

    public readonly file: TrackedFile
    public readonly history: LineHistory

    public previous: TrackedLine | undefined
    public next: TrackedLine | undefined

    private snapshots: Snapshot[] = []

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
        return activePrevious ? activePrevious.lineNumber + 1 : 1
    }

    public get linePosition(): number {
        return this.previous ? this.previous.linePosition + 1 : 1
    }

    public get currentlyActive(): boolean {
        return this.history.currentlyActive
    }

    public get currentContent(): string {
        return this.history.currentContent
    }

    public get affectedSnapshotUUIDs(): SnapshotUUID[] {
        return this.snapshots.map(snapshot => {
            return snapshot.uuid
        })
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

    public addToSnapshot(snapshot: Snapshot): void {
        this.snapshots.push(snapshot)
    }

    public removeFromSnapshot(snapshot: Snapshot): void {
        const index = this.snapshots.indexOf(snapshot, 0)
        if (index > -1) { this.snapshots = this.snapshots.splice(index, 1) }
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
            return line.currentlyActive ? line.currentContent : null
            // return line.currentlyActive ? (line.currentContent ? line.currentContent : "//") : null // temporary fix to see version count for emty lines in preview
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

    public flatMap<ReturnType>(callback: (line: TrackedLine) => ReturnType | ReturnType[]): ReturnType[] {
        return this.lines.flatMap(callback)
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

    public get file(): TrackedFile {
        return this.line.file
    }

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

    public get versions(): LineVersion[] {

        let   version = this.start
        const lines = [version]

        while(version !== this.end) {
            version = version.next
            lines.push(version)
        }

        return lines
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

    public get versionOrder(): number {
        return this.previous ? this.previous.versionOrder + 1 : 1
    }

    public get originTimestamp(): number {
        return this.origin ? this.origin.timestamp : this.timestamp
    }

    public get line(): TrackedLine {
        return this.histoy.line
    }

    public get isHead(): boolean {
        return this.histoy.head === this
    }

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

    public apply(): void {
        this.histoy.head = this
    }

    public clone(timestamp: number, relations?: LineVersionRelation): LineVersion {
        if (!relations?.origin) { relations.origin = this }
        return new LineVersion(this.histoy, timestamp, this.active, this.content, relations)
    }
}

class Snapshot extends TrackedBlock {

    public readonly uuid = crypto.randomUUID()
    public readonly file: TrackedFile

    private timeline: LineVersion[]

    public get versionCount(): number {
        return this.timeline.length
    }

    public get versionIndex(): number | null {

        let index = -1
        let lines = this.lines.lines

        while(lines.length > 0) {

            index++

            if (index === this.versionCount) { throw new Error("Failed to get index for snapshot!") }

            const version = this.timeline[index]
            if (version.isHead) {
                const line = version.line
                const lineIndex = lines.indexOf(line, 0)
                if (lineIndex > -1) { lines = lines.splice(lineIndex, 0) }
            }
        }

        return index >= 0 ? index : null
    }

    private get lastTimestamp(): number {
        return this.timeline[this.versionCount - 1].timestamp
    }

    public static create(file: TrackedFile, range: IRange): Snapshot {
        const firstLine = file.getLine(range.startLineNumber)
        const lastLine  = file.getLine(range.endLineNumber)
        return new Snapshot(file, firstLine, lastLine)
    }

    constructor(file: TrackedFile, firstLine: TrackedLine, lastLine: TrackedLine) {
        super(file.eol, firstLine, lastLine)
        this.file = file

        this.addLines()
        this.createTimeline()
    }

    private createTimeline(): void {
        let timeline = this.lines.flatMap(line => {
            return line.history.versions
        })

        this.timeline = timeline.sort((versionA, versionB) => {

            const originTimestampA = versionA.originTimestamp
            const originTimestampB = versionB.originTimestamp

            const timestampA = versionA.timestamp
            const timestampB = versionB.timestamp

            const lineA = versionA.line
            const lineB = versionB.line

            // order them by origin timestamps instead of own timestamps, this way changes based on this origin will follow immediately on the origin
            if (originTimestampA !== originTimestampB) { 
                return originTimestampA < originTimestampB ? -1 : 1
            } else if (timestampA !== timestampB) {
                return timestampA < timestampB ? -1 : 1
            } else if (lineA === lineB) {
                return versionA.versionOrder < versionB.versionOrder ? -1 : 1
            } else {
                return lineA.linePosition < lineB.linePosition ? -1 : 1
            }
        })
    }

    private addLines(): void {
        this.lines.forEach(line => {
            line.addToSnapshot(this)
        })
    }

    private removeLines(): void {
        this.lines.forEach(line => {
            line.removeFromSnapshot(this)
        })
    }

    public addNewVersion(version: LineVersion): void {
        if (version.timestamp >= this.lastTimestamp) {
            this.timeline.push(version)
        } else {
            this.createTimeline()
        }
    }

    public update(update: VCSSnapshotData): void {
        this.removeLines()

        this.firstLine = this.file.getLine(update._startLine)
        this.lastLine  = this.file.getLine(update._endLine)

        this.addLines()
        this.createTimeline()
    }

    public applyIndex(versionIndex: number): void {
        if (versionIndex < 0 || versionIndex >= this.versionCount) { throw new Error(`Provided version index (${versionIndex}) out of bounds `) }

        let lines = this.lines.lines
        while(lines.length > 0) {

            const version = this.timeline[versionIndex]
            const line = version.line
            
            if (lines.includes(line)) { 
                version.apply()
                const lineIndex = lines.indexOf(line, 0)
                if (lineIndex > -1) { lines = lines.splice(lineIndex, 0) }
            }

            versionIndex--
        }
    }

    public compress(): VCSSnapshotData {

        const parent = this

        return {
            uuid: parent.uuid,
            _startLine: parent.firstActiveLine.lineNumber,
            _endLine: parent.lastActiveLine.lineNumber,
            versionCount: parent.versionCount,
            versionIndex: parent.versionIndex
        }
    }
}


export class GhostVCSServer extends BasicVCSServer {

    private file: TrackedFile | null = null
    private browserWindow: BrowserWindow | undefined

    constructor(browserWindow?: BrowserWindow) {
        super()
        this.browserWindow = browserWindow
    }

    /*
    // may proof useful for full file diffing after re-opening an old file
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
    */

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

    public async createSnapshot(range: IRange): Promise<VCSSnapshotData | null> {
        return this.file.createSnapshot(range)?.compress()
    }

    public async getSnapshot(uuid: string): Promise<VCSSnapshotData> {
        return this.file.getSnapshot(uuid).compress()
    }

    public async getSnapshots(): Promise<VCSSnapshotData[]> {
        return this.file.getSnapshotData()
    }

    public updateSnapshot(snapshot: VCSSnapshotData): void {
        this.file.updateSnapshot(snapshot)
    }

    public async applySnapshotVersionIndex(uuid: SnapshotUUID, versionIndex: number): Promise<string> {
        this.file.getSnapshot(uuid).applyIndex(versionIndex)
        return this.file.currentText
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        const uuids = this.file.updateLine(change.lineNumber, change.lineText)
        this.updatePreview()
        return uuids
    }

    public async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {

        const startsWithEol = change.insertedText[0] === this.file.eol
        const endsWithEol   = change.insertedText[change.insertedText.length - 1] === this.file.eol

        const insertedAtStartOfStartLine = change.modifiedRange.startColumn === 1
        const insertedAtEndOfStartLine = change.modifiedRange.startColumn > this.file.getLine(change.modifiedRange.startLineNumber).currentContent.length

        const insertedAtEnd   = change.modifiedRange.endColumn > this.file.getLine(change.modifiedRange.endLineNumber).currentContent.length

        const oneLineModification = change.modifiedRange.startLineNumber === change.modifiedRange.endLineNumber
        const insertOnly = oneLineModification && change.modifiedRange.startColumn == change.modifiedRange.endColumn

        const pushStartLineDown = insertedAtStartOfStartLine && endsWithEol  // start line is not modified and will be below the inserted lines
        const pushStartLineUp   = insertedAtEndOfStartLine && startsWithEol  // start line is not modified and will be above the inserted lines

        const modifyStartLine = !insertOnly || !(pushStartLineDown) && !(pushStartLineUp)

        const timestamp = this.file.getTimestamp()
        const modifiedLines = change.lineText.split(this.file.eol)
        let   affectedUUIDs: SnapshotUUID[] = []

        const modifiedRange = {
            startLine: change.modifiedRange.startLineNumber,
            endLine:   change.modifiedRange.endLineNumber
        }

        let vcsLines: TrackedLines = new TrackedLines(this.file.eol)
        if (modifyStartLine) {
            vcsLines = this.file.getLines(modifiedRange)
            const firstLine = vcsLines.at(0)
            firstLine.update(timestamp, modifiedLines[0])
            affectedUUIDs = affectedUUIDs.concat(firstLine.affectedSnapshotUUIDs)
        } else {
            // TODO: pushStartDown case not handled well yet, line tracking is off
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }

        const linesToConsider = Math.max(vcsLines.length, modifiedLines.length)

        for (let i = 1; i < linesToConsider; i++) {
            if (i < vcsLines.length) {
                const line = vcsLines.at(i)
                affectedUUIDs = affectedUUIDs.concat(line.affectedSnapshotUUIDs)
                if (i < modifiedLines.length) {
                    line.update(timestamp, modifiedLines[i])
                } else {
                    line.delete(timestamp)
                }
            } else {
                const line = this.file.insertLine(modifiedRange.startLine + i, modifiedLines[i])
                affectedUUIDs = affectedUUIDs.concat(line.affectedSnapshotUUIDs)
            }
        }

        this.updatePreview()

        return affectedUUIDs
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        console.log("GET VERSION NOT IMPLEMENTED")
    }
}