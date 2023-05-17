const Diff = require('diff');
import * as crypto from "crypto"
import { BrowserWindow } from "electron";
import { LineChange, MultiLineChange } from "./src/app/components/data/change";
import { VCSSnapshotData, VCSSnapshot, VCSVersion } from "./src/app/components/data/snapshot";
import { IRange } from "./src/app/components/utils/range";
import { BasicVCSServer, SnapshotUUID, VCSServer, VersionUUID } from "./src/app/components/vcs/vcs-provider";

interface LineRange {
    startLine: number,
    endLine: number
}

class LineState {

    private readonly state: Map<TrackedLine, LineVersion>

    constructor(state?: Map<TrackedLine, LineVersion>) {
        this.state = state ? state : new Map<TrackedLine, LineVersion>()
    }

    public has(line: TrackedLine): boolean {
        return this.state.has(line)
    }

    public get(line: TrackedLine): LineVersion {
        return this.state.get(line)
    }

    public set(line: TrackedLine, version: LineVersion): void {
        this.state.set(line, version)
    }

    public delete(line:TrackedLine): boolean {
        return this.state.delete(line)
    }

    public apply(lines: TrackedLines): void {
        lines.forEach(line => {
            if (this.has(line)) {
                this.get(line).apply()
            } else {
                line.history.start.apply()
            }
        })
    }
}

interface TrackedLineRelation {
    previous?: TrackedLine | undefined
    next?: TrackedLine | undefined
    lineState?: LineState
    snapshots?: Snapshot[] | undefined
}

interface LineVersionRelation {
    origin?: LineVersion | undefined
    previous?: LineVersion | undefined
    next?: LineVersion | undefined
    lineState?: LineState | undefined
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

    public get lineCount(): number {
        return this.lines.length
    }

    public get activeLines(): TrackedLines {
        return this.lines.filter(line => { return line.currentlyActive })
    }

    public get versions(): LineVersion[] {
        return this.lines.flatMap(line => line.history.versions)
    }

    constructor(eol: string, firstLine?: TrackedLine | undefined, lastLine?: TrackedLine | undefined) {
        this.eol = eol
        this.firstLine = firstLine
        this.lastLine  = lastLine
    }

    public get lines(): TrackedLines {

        if (!this.firstLine || !this.lastLine) { return new TrackedLines(this.eol) }

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

    public get currentLineState(): LineState {
        return this.lines.currentLineState
    }

    public get heads(): LineVersion[] {
        return this.lines.heads
    }

    public get stringLines(): string[] {
        return this.lines.stringLines
    }

    public get currentText(): string {
        return this.lines.text
    }

    public containsLine(lineNumber: number): boolean {
        return this.firstLineNumber <= lineNumber && this.lastLineNumber >= lineNumber
    }

    public validLineNumber(lineNumber: number): boolean {
        return lineNumber >= this.firstLineNumber && lineNumber <= this.lastLineNumber
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

        const trackedLines = lines.map(line => {
            return new TrackedLine(file, line, true)
        })

        file.lines = trackedLines

        return file
    }

    public filePath: string | null
    private snapshots = new Map<string, Snapshot>()

    public lastModifiedLine?: TrackedLine | undefined = undefined

    constructor(filePath: string | null, eol: string) {
        super(eol)
        this.filePath = filePath
    }

    public setupVersionMerging(line: TrackedLine): void {
        this.lastModifiedLine = line
    }

    public resetVersionMerging(): void {
        this.lastModifiedLine = undefined
    }

    private nextTimestamp = 0
    public getTimestamp(): number {
        const timestamp = this.nextTimestamp
        this.nextTimestamp++
        return timestamp
    }

    public insertLine(lineNumber: number, content: string, lineState?: LineState): TrackedLine {
        this.resetVersionMerging()

        const newLastLine = this.lastLineNumber + 1
        const adjustedLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)

        const includedSnapshots = this.getSnapshots(Math.min(adjustedLineNumber, this.lastLineNumber))
        const expandedSnapshots = this.getSnapshots(Math.min(adjustedLineNumber - 1, this.lastLineNumber))
        const snapshots = Array.from(new Set(includedSnapshots.concat(expandedSnapshots)))

        let createdLine: TrackedLine

        if (adjustedLineNumber === 1) {
            const firstActive = this.firstActiveLine
            createdLine = new TrackedLine(this, content, false, { 
                previous:  firstActive.previous,
                next:      firstActive,
                lineState: lineState,
                snapshots: snapshots
            })

            if (!createdLine.previous) { 
                this.firstLine = createdLine
            }
        } else if (adjustedLineNumber === newLastLine) {
            const lastActive  = this.lastActiveLine
            createdLine = new TrackedLine(this, content, false, { 
                previous:  lastActive,
                next:      lastActive.next,
                lineState: lineState,
                snapshots: snapshots
            })

            if (!createdLine.next) { 
                this.lastLine = createdLine
            }
        } else {
            const currentLine = this.getLine(adjustedLineNumber)
            createdLine  = new TrackedLine(this, content, false, { 
                previous:  currentLine.previous, 
                next:      currentLine,
                lineState: lineState,
                snapshots: snapshots
            })
        }

        expandedSnapshots.forEach(snapshot => {
            const snapshotData = snapshot.compress()
            const lineNumber = createdLine.lineNumber
            if (snapshotData._endLine < lineNumber) {
                snapshotData._endLine = lineNumber
                snapshot.update(snapshotData)
            }
        })

        this.updateSnapshots()

        return createdLine
    }

    public insertLines(lineNumber: number, content: string[], lineState?: LineState): TrackedLines{
        return new TrackedLines(this.eol, ...content.map((line, index) => {
            return this.insertLine(lineNumber + index, line, lineState)
        }))
    }

    public deleteLine(lineNumber: number, lineState?: LineState): TrackedLine {
        this.resetVersionMerging()

        const line = this.getLine(lineNumber)
        line.delete(lineState)
        this.updateSnapshots()
        return line
    }

    public deleteLines(range: LineRange, lineState?: LineState): TrackedLines {
        const lines = this.getLines(range)

        lines.forEach(line => {
            line.delete(lineState)
        })

        return lines
    }

    public updateLine(lineNumber: number, content: string, lineState?: LineState): TrackedLine {
        const line = this.getLine(lineNumber)
        line.update(content, lineState)
        this.updateSnapshots()

        this.setupVersionMerging(line)

        return line
    }

    public updateLines(lineNumber: number, content: string[], lineState?: LineState): TrackedLines {
        this.resetVersionMerging()

        const count = content.length
        const lines = this.getLines({ startLine: lineNumber, endLine: lineNumber + count - 1 })

        lines.forEach((line, index) => {
            line.update(content[index], lineState)
        })

        return lines
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

    public getSnapshots(lineNumber: number): Snapshot[] {

        const snapshots = []

        this.snapshots.forEach(snapshot => {
            if (snapshot.containsLine(lineNumber)) {
                snapshots.push(snapshot)
            }
        })

        return snapshots
    }

    public updateSnapshot(update: VCSSnapshotData): Snapshot {
        const snapshot = this.getSnapshot(update.uuid)
        snapshot.update(update)
        return snapshot
    }

    public updateSnapshots(): void {
        this.snapshots.forEach(snapshot => {
            snapshot.updateLines()
        })
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

    public snapshots: Snapshot[] = []

    public get currentlyActive(): boolean {
        return this.history.currentlyActive
    }

    public get currentContent(): string {
        return this.history.currentContent
    }

    public get lineNumber(): number | null {
        if (!this.currentlyActive) { return null }

        const activePrevious = this.previousActive
        return activePrevious ? activePrevious.lineNumber + 1 : 1
    }

    public get linePosition(): number {
        return this.previous ? this.previous.linePosition + 1 : 1
    }

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

    public get snapshotUUIDs(): SnapshotUUID[] {
        return this.snapshots.map(snapshot => {
            return snapshot.uuid
        })
    }

    constructor(file: TrackedFile, initialContent: string, loadedLine: boolean, relations?: TrackedLineRelation) {
        this.file = file
        this.snapshots = relations?.snapshots ? relations.snapshots : []

        const lineState = relations?.lineState ? relations.lineState : this.file.currentLineState
        this.history = new LineHistory(this, lineState, initialContent, loadedLine)

        if (relations) {
            this.previous = relations.previous
            this.next = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public cloneCurrentVersion(lineState?: LineState): LineVersion {
        return this.history.cloneCurrentVersion(lineState)
    }

    public update(content: string, lineState?: LineState): LineVersion {
        if (content === this.currentContent)     { return this.history.head }
        if (this.file.lastModifiedLine === this) { return this.history.updateCurrentVersion(content) }
        return this.history.createNewVersion(true, content, lineState)
    }

    public delete(lineState?: LineState): LineVersion {
        return this.history.deleteLine(lineState)
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
    public readonly eol: string

    constructor(eol: string, ...lines: TrackedLine[]) {
        this.lines = lines
        this.eol = eol
    }

    public get length(): number {
        return this.lines.length
    }

    public get currentLineState(): LineState {
        const heads = new LineState()
        this.lines.forEach(line => { heads.set(line, line.history.head) })
        return heads
    }

    public get heads(): LineVersion[] {
        return this.lines.map(line => { return line.history.head })
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

    public get snapshotUUIDs(): SnapshotUUID[] {
        return this.lines.flatMap(line => { return line.snapshotUUIDs })
    }

    public at(index: number): TrackedLine {
        return this.lines[index]
    }

    public indexOf(line: TrackedLine, fromIndex: number): number {
        return this.lines.indexOf(line, fromIndex)
    }

    public splice(start: number, deleteCount: number): TrackedLines {
        return new TrackedLines(this.eol, ...this.lines.splice(start, deleteCount))
    }

    public remove(line: TrackedLine): TrackedLines {
        const index = this.indexOf(line, 0)
        if (index > -1) { 
            return  this.splice(index, 1)
        } else {
            return this
        }
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

    public sort(callback: (lineA: TrackedLine, lineB: TrackedLine) => number): TrackedLines {
        this.lines.sort(callback)
        return this
    }

    public reverse(): TrackedLines {
        this.lines.reverse()
        return this
    }
}

class LineHistory {

    public readonly line: TrackedLine
    
    public head: LineVersion

    public start: LineVersion
    public end: LineVersion

    public get file(): TrackedFile {
        return this.line.file
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

    public get versionCount(): number {

        let count = 0
        let version = this.start

        while (version) {
            count++
            version = version.next
        }

        return count
    }

    public get snapshots(): Snapshot[] {
        return this.line.snapshots
    }

    constructor(line: TrackedLine, lineState: LineState, initialContent: string, loadedLine?: boolean) {
        this.line  = line

        if (loadedLine) {
            // when line is loaded from file, it may never disappear in the version history, it represents the first version
            this.start = new LineVersion(this, this.getTimestamp(), true, initialContent, { lineState: lineState })
            this.end   = this.start
        } else {
            // any line inserted later could also be deleted through version scrubbing
            this.start = new LineVersion(this, this.getTimestamp(), false, "", { lineState: lineState })
            this.end   = new LineVersion(this, this.getTimestamp(), true, initialContent, { previous: this.start, lineState: lineState })
        }

        this.head  = this.end
    }

    private getTimestamp(): number {
        return this.file.getTimestamp()
    }

    private cloneHeadToEnd(lineState?: LineState): LineVersion {
        this.end = this.head.clone(this.getTimestamp(), { previous: this.end, lineState: lineState })
        this.head = this.end
        return this.head
    }

    public cloneCurrentVersion(lineState?: LineState): LineVersion {
        return this.cloneHeadToEnd(lineState)
    }

    public createNewVersion(active: boolean, content: string, lineState?: LineState): LineVersion {
        if (this.head !== this.end) {
            this.cloneHeadToEnd(lineState)
        }

        this.end = new LineVersion(this, this.getTimestamp(), active, content, { previous: this.end, lineState: lineState })
        this.head = this.end
        
        return this.head
    }

    public updateCurrentVersion(content: string): LineVersion {
        this.head.update(content)
        return this.head
    }

    public deleteLine(lineState?: LineState): LineVersion {
        return this.createNewVersion(false, "", lineState)
    }

}

class LineVersion {

    public readonly history: LineHistory

    public readonly timestamp: number
    public readonly active: boolean
    public content: string

    public readonly origin: LineVersion | undefined
    private clones: LineVersion[] = []

    public previous: LineVersion | undefined
    public next: LineVersion | undefined

    private readonly lineState = new LineState()

    public get file(): TrackedFile {
        return this.line.file
    }

    public get line(): TrackedLine {
        return this.history.line
    }

    public get isHead(): boolean {
        return this.history.head === this
    }

    public get isStart(): boolean {
        return this.history.start === this
    }

    public get isEnd(): boolean {
        return this.history.end === this
    }

    public get isPreInsertion(): boolean {
        return this.isStart && !this.active
    }

    public get isDeletion(): boolean {
        return !this.isStart && !this.active
    }

    public get isClone(): boolean {
        return this.origin ? true : false
    }

    public get previousVersionCount(): number {
        return this.previous ? this.previous.previousVersionCount + 1 : 0
    }

    public get nextVersionCount(): number {
        return this.next ? this.next.nextVersionCount + 1 : 0
    }

    /*
    public get tracedOrigin(): LineVersion | undefined {
        let origin = this.origin
        while(origin?.origin) {
            origin = origin.origin
        }
        return origin
    }

    public get originTimestamp(): number {
        return this.origin ? this.origin.originTimestamp : this.timestamp
    }
    */

    constructor(history: LineHistory, timestamp: number, active: boolean, content: string, relations?: LineVersionRelation) {
        this.history = history
        this.timestamp = timestamp
        this.active = active
        this.content = content

        this.lineState = relations?.lineState ? relations.lineState : this.file.currentLineState
        this.lineState.set(this.line, this)

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
        return new LineVersion(this.history, timestamp, this.active, this.content, relations)
    }

    public update(content: string): void {
        this.content = content
    }

    public apply(): void {
        this.history.head = this
    }

    public applyToLines(lines: TrackedLines): void {
        this.lineState.apply(lines)
        this.apply() // should be unnecessary
    }
}

class Snapshot extends TrackedBlock {

    public readonly uuid = crypto.randomUUID()
    public readonly file: TrackedFile

    public readonly savedVersions = new Map<VersionUUID, LineState>()

    public get nativeLineCount(): number {
        return this.lines.filter(line => !line.history.start.isPreInsertion).length
    }

    public get insertedLineCount(): number {
        return this.lines.filter(line => line.history.start.isPreInsertion).length
    }

    public get versionCount(): number {
        return this.computeUnorderedTimeline().length - this.nativeLineCount + 1
        //return this.versions.length - this.insertedLineCount - this.nativeLineCount + 1
    }

    public get versionIndex(): number {
        // establish correct latest hand in the timeline: as we do not include insertion version, but only pre-insertion, those are set to their related pre-insertion versions
        let latestHead = this.latestHead
        if (latestHead.previous?.isPreInsertion) { latestHead = latestHead.previous }
        //if (latestHead.origin)                   { latestHead = latestHead.next }

        const timeline = this.computeTimeline()
        const index = timeline.indexOf(latestHead, 0)

        if (index < 0) { throw new Error("Latest head not in timeline!") }

        return index
    }

    public get latestHead(): LineVersion {
        return this.heads.filter(head => !head.isPreInsertion)
                         .sort((headA, headB) => { return headB.timestamp - headA.timestamp })[0]
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
    }

    private computeUnorderedTimeline(): LineVersion[] {
        // isPreInsertion to avoid choosing versions following on a pre-insertion-version, as we simulate those.
        // Same for origin -> cloned versions are not displayed, and are just there for correct code structure
        return this.versions.filter(version => { return !version.previous?.isPreInsertion /*&& !version.origin*/ } )
    }

    private computeTimeline(): LineVersion[] {
        return this.computeUnorderedTimeline().sort((versionA, versionB) => { return versionA.timestamp - versionB.timestamp })
    }

    private removeLines(): void {
        this.lines.forEach(line => {
            line.removeFromSnapshot(this)
        })
    }

    private addLines(): void {
        this.lines.forEach(line => {
            line.addToSnapshot(this)
        })
    }

    public update(update: VCSSnapshotData): void {
        this.removeLines()

        this.firstLine = this.file.getLine(update._startLine)
        this.lastLine  = this.file.getLine(update._endLine)

        this.addLines()
    }

    public updateLines(): void {
        this.removeLines()
        this.addLines()
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

        this.file.resetVersionMerging()
        const timeline = this.computeTimeline()

        targetIndex += this.nativeLineCount - 1
        if (targetIndex < 0 || targetIndex >= timeline.length) { throw new Error(`Target index ${targetIndex} out of bounds for timeline of length ${timeline.length}!`) }

        let version = timeline[targetIndex] // actually targeted version
        let nextVersion = targetIndex + 1 < timeline.length ? timeline[targetIndex + 1] : undefined

        // handle skipping the pre-insertion version, if it is already applied
        if (version.isHead && version.isPreInsertion) {
            version.next.applyToLines(this.lines)
        // handle the undo of the line insertion if we go back by one version
        } else if (nextVersion?.isPreInsertion && nextVersion?.next?.isHead) {
            nextVersion.applyToLines(this.lines)
        // handle all traditional cases
        } else {
            version.applyToLines(this.lines)
        }
    }

    public save(): VCSVersion {
        const versionId = crypto.randomUUID()
        this.savedVersions.set(versionId, this.currentLineState)
        return {
            uuid: versionId,
            name: `Version ${this.savedVersions.size}`,
            text: this.file.currentText,
            automaticSuggestion: false
        }
    }

    public loadVersion(uuid: VersionUUID): string {
        const lineState = this.savedVersions.get(uuid)
        lineState.apply(this.lines)
        return this.currentText
    }

    public getTextForVersion(uuid: VersionUUID): string {
        const recoveryPoint = this.currentLineState
        const text = this.loadVersion(uuid)
        recoveryPoint.apply(this.lines)
        return text
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
        this.updatePreview()
        return this.file.currentText
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        const line = this.file.updateLine(change.lineNumber, change.lineText)
        this.updatePreview()
        return line.snapshotUUIDs
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

        let vcsLines: TrackedLines = undefined
        const modifiedLines = change.lineText.split(this.file.eol)

        if (modifyStartLine) {
            vcsLines = this.file.getLines(modifiedRange)
        } else {
            // TODO: pushStartDown case not handled well yet, line tracking is off
            vcsLines = new TrackedLines(this.file.eol)
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }
        

        const parent = this
        let affectedLines: TrackedLine[] = []
        function deleteLine(line: TrackedLine): void {
            line.delete()
            affectedLines.push(line)
        }

        function updateLine(line: TrackedLine, newContent: string): void {
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

        this.file.updateSnapshots()
        this.updatePreview()

        return affectedLines.map(line => line.snapshotUUIDs).flat()
    }

    public async saveCurrentVersion(uuid: SnapshotUUID): Promise<VCSVersion> {
        const snapshot = this.file.getSnapshot(uuid)
        return snapshot.save()
    }
}