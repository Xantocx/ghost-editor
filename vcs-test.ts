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
    lineState?: LineState
    snapshots?: Snapshot[] | undefined
}

interface LineVersionRelation {
    origin?: LineVersion | undefined
    previous?: LineVersion | undefined
    next?: LineVersion | undefined
    lineState?: LineState | undefined
    injectionPoints?: IInjectionPoint[]
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

    public get headsMap(): LineState {
        return this.lines.headsMap
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

    private nextTimestamp = 0
    public getTimestamp(): number {
        const timestamp = this.nextTimestamp
        this.nextTimestamp++
        return timestamp
    }

    public insertLine(lineNumber: number, content: string, lineState?: LineState): TrackedLine {
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
        return line
    }

    public updateLines(lineNumber: number, content: string[], lineState?: LineState): TrackedLines {
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

        const lineState = relations?.lineState ? relations.lineState : this.file.headsMap
        this.history = new LineHistory(this, lineState, initialContent, loadedLine)

        if (relations) {
            this.previous = relations.previous
            this.next = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
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

    public get headsMap(): LineState {
        const heads = new Map<TrackedLine, LineVersion>()
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
        const injectionPoints = this.getInjectionPoints()

        // always must have a head, which results in somewhat unorthodox definitions of verions here...
        if (loadedLine) {
            // when line is loaded from file, it may never disappear in the version history, it represents the first version
            this.head  = new LineVersion(this, this.getTimestamp(), true, initialContent, { lineState: lineState, injectionPoints: injectionPoints })
            this.start = this.head
            this.end   = this.start
        } else {
            // any line inserted later could also be deleted through version scrubbing
            this.head  = new LineVersion(this, this.getTimestamp(), false, "", { lineState: lineState, injectionPoints: injectionPoints })
            
            this.start = this.head
            this.end   = new LineVersion(this, this.getTimestamp(), true, initialContent, { previous: this.start, lineState: lineState, injectionPoints: injectionPoints })

            this.head  = this.end
        }
    }

    private getTimestamp(): number {
        return this.file.getTimestamp()
    }

    private getInjectionPoints(): IInjectionPoint[] {
        return this.snapshots.map(snapshot => { return snapshot.activeInjectionPoint }).filter(injectionPoint => injectionPoint)
    }

    private cloneHeadToEnd(lineState?: LineState): LineVersion {
        this.end = this.head.clone(this.getTimestamp(), { previous: this.end,
                                                          lineState: lineState,
                                                          injectionPoints: this.getInjectionPoints() })
        this.head = this.end
        return this.head
    }

    public createNewVersion(active: boolean, content: string, lineState?: LineState): LineVersion {
        if (this.head !== this.end) {
            this.cloneHeadToEnd(lineState)
        }

        this.end = new LineVersion(this, this.getTimestamp(), active, content, { previous: this.end, 
                                                                                 lineState: lineState, 
                                                                                 injectionPoints: this.getInjectionPoints() })
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

    private readonly lineState: LineState = new Map<TrackedLine, LineVersion>()
    private readonly injectionPoints: IInjectionPoint[] = []

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

    public get previousVersionCount(): number {
        return this.previous ? this.previous.previousVersionCount + 1 : 0
    }

    public get nextVersionCount(): number {
        return this.next ? this.next.nextVersionCount + 1 : 0
    }

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

    constructor(history: LineHistory, timestamp: number, active: boolean, content: string, relations?: LineVersionRelation) {
        this.history = history
        this.timestamp = timestamp
        this.active = active
        this.content = content

        this.lineState = relations?.lineState ? relations.lineState : this.file.headsMap
        this.injectionPoints = relations?.injectionPoints ? relations.injectionPoints : []

        this.lineState.delete(this.line)

        if (relations) {
            this.origin = relations.origin
            this.previous = relations.previous
            this.next = relations.next

            if (this.origin)   { this.origin.clones.push(this) }
            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public getInjectorComparable(injector: Injector): InjectionComparable {

        const injectionPoint = this.injectionPoints.find(point => { return point.injector === injector })

        if (injectionPoint) { return InjectionComparable.createWithInjectionPoint(injectionPoint, this) } 
        else                { return InjectionComparable.createForVersion(this) }
    }

    public apply(): void {
        this.history.head = this
    }

    public applyToLines(lines: TrackedLines): void {
        if (this.active) {
            lines.forEach(line => {
                if (this.lineState.has(line)) {
                    this.lineState.get(line).apply()
                } else {
                    line.history.start.apply()
                }
            })
        }

        this.apply()
    }

    public clone(timestamp: number, relations?: LineVersionRelation): LineVersion {
        if (!relations?.origin) { relations.origin = this }
        return new LineVersion(this.history, timestamp, this.active, this.content, relations)
    }

    public update(content: string): void {
        this.content = content
    }

    public static compareForInjector(injector: Injector, versionA: LineVersion | undefined, versionB: LineVersion | undefined, undefinedIsGreater: boolean): number {

        // handle undefined values and sort them to the end or beginning of the array, depending on config
        if (versionA && !versionB) {
            return undefinedIsGreater ? -1 :  1
        } else if (!versionA && versionB) {
            return undefinedIsGreater ?  1 : -1
        } else if (!versionA && !versionB) {
            return 0
        }

        const comparableA = versionA.getInjectorComparable(injector)
        const comparableB = versionB.getInjectorComparable(injector)

        return InjectionComparable.compare(comparableA, comparableB)
    }
}

type LineState = Map<TrackedLine, LineVersion>

// any component that allows to (partly) reverse history has to be an injector to allow for the injection of new versions in the reversed segment
interface Injector {
    file:  TrackedFile
    lines: TrackedLines
    activeInjectionPoint: InjectionPoint<this> | undefined
}

interface IInjectionPoint {
    injector: Injector
    parent: IInjectionPoint
    depth: number
    comparable: InjectionComparable
    creationTimestamp: number
    //compare(injectionPoint: IInjectionPoint): number
}

class InjectionComparable {

    public readonly timestamp: number
    public readonly sequenceNumber: number
    public readonly creationTimestamp: number
    public readonly injectionPoint?: IInjectionPoint
    public readonly copied: boolean

    public get hasInjectionPoint(): boolean {
        return this.injectionPoint ? true : false
    }

    public static createWithInjectionPoint(injectionPoint: IInjectionPoint, version: LineVersion): InjectionComparable {
        return new InjectionComparable(injectionPoint.comparable.timestamp, version.timestamp, injectionPoint.creationTimestamp, injectionPoint)
    }

    public static createForVersion(version: LineVersion): InjectionComparable {
        return new InjectionComparable(version.timestamp, version.timestamp, version.timestamp)
    }

    public static compare(comparableA: InjectionComparable, comparableB: InjectionComparable): number {

        const injectionPointA = comparableA.injectionPoint
        const injectionPointB = comparableB.injectionPoint

        // easisest case: timestamp uniquely seperates to versions
        if (comparableA.timestamp !== comparableB.timestamp) { return comparableA.timestamp - comparableB.timestamp }

        // trickier: same timestamp indicates a comparison between two versions nested with injection points -> recursively unwrap if depth is unequal
        else if (comparableA.hasInjectionPoint && comparableB.hasInjectionPoint && injectionPointA.depth !== injectionPointB.depth) {
            if      (injectionPointA.depth > injectionPointB.depth) { return InjectionComparable.compare(injectionPointA.comparable, comparableB) }
            else if (injectionPointA.depth < injectionPointB.depth) { return InjectionComparable.compare(comparableA, injectionPointB.comparable) }
        }

        // wrapped in injection points, but same depth -> sequence number (aka unique timestamp) should help in most cases
        else if (comparableA.sequenceNumber !== comparableB.sequenceNumber) { return comparableA.sequenceNumber - comparableB.sequenceNumber }
        // if we compare an element with an injection point created directly behind it, the injection point will have copied its comparable, indicated by the copied variable
        else if (comparableA.copied !== comparableB.copied)                 { return comparableA.copied ? 1 : -1 }
        // if both are copied (meaning two different injection points at the same position) just sort them by creation time
        else if (comparableA.copied  && comparableB.copied)                 { return comparableA.creationTimestamp - comparableB.creationTimestamp }

        // we should never have to comparables that are both linked to a unique element and not copied by an injection point
        else { throw new Error("Comparing two original comparables with identical values. This should never happen!") }
    }

    protected constructor(timestamp: number, sequenceNumber: number, creationTimestamp: number, injectionPoint?: IInjectionPoint, copied?: boolean) {
        this.timestamp = timestamp
        this.sequenceNumber = sequenceNumber
        this.creationTimestamp = creationTimestamp
        this.injectionPoint = injectionPoint
        this.copied = copied ? copied : false
    }

    public copy(): InjectionComparable {
        return new InjectionComparable(this.timestamp, this.sequenceNumber, this.creationTimestamp, this.injectionPoint, true)
    }

    public isLessThan(comparable: InjectionComparable): boolean {
        return InjectionComparable.compare(this, comparable) < 0
    }

    public isEqualTo(comparable: InjectionComparable): boolean {
        return InjectionComparable.compare(this, comparable) === 0
    }

    public isGreaterThan(comparable: InjectionComparable): boolean {
        return InjectionComparable.compare(this, comparable) > 0
    }
}

class InjectionPoint<InjectorClass extends Injector> implements IInjectionPoint {

    public readonly injector: InjectorClass
    public readonly lineState: LineState
    public readonly comparable: InjectionComparable
    public readonly depth: number
    public readonly creationTimestamp: number

    public get parent(): IInjectionPoint | undefined {
        return this.comparable.injectionPoint
    }

    public get timestamp(): number {
        return this.comparable.timestamp
    }

    public get versions(): LineVersion[] {
        return Array.from(this.lineState.values())
    }

    constructor(injector: InjectorClass, lineState: LineState) {
        this.injector   = injector
        this.lineState  = lineState
        this.comparable = this.computeComparable()
        this.depth = this.parent ? this.parent.depth + 1 : 0
        this.creationTimestamp = this.injector.file.getTimestamp()
    }

    private computeComparable(): InjectionComparable {

        let injectionVersion: LineVersion | undefined = undefined
        let injectionComparable: InjectionComparable | undefined = undefined

        this.versions.forEach(version => {
            const versionComparable = version.getInjectorComparable(this.injector)
            if (!injectionComparable || injectionComparable.isLessThan(versionComparable)) {
                injectionVersion = version
                injectionComparable = versionComparable
            }
        })

        return injectionComparable.copy()
    }

    /*
    // what if the largest timestamp comes from a injection point? this must be considered !!!
    private computeTimestamp(): number {

        let timestamp = -1

        this.versions.forEach(version => { 
            const alternativeTimestamp = version.getInjectorComparable(this.injector).timestamp
            timestamp = Math.max(timestamp, alternativeTimestamp)
         })

        return timestamp
    }
    */

    /*
    public compare(injectionPoint: IInjectionPoint): number {

        let pointA: IInjectionPoint = this
        let pointB: IInjectionPoint = injectionPoint

        while(pointA.depth > pointB.depth) { pointA = pointA.parent }
        while(pointA.depth < pointB.depth) { pointB = pointB.parent }

        return InjectionComparable.compare(pointA.comparable, pointB.comparable)
    }
    */
}

class Snapshot extends TrackedBlock implements Injector {

    public readonly uuid = crypto.randomUUID()
    public readonly file: TrackedFile

    private timeline: LineVersion[]

    public activeInjectionPoint: InjectionPoint<this> | undefined = undefined

    public get versionCount(): number {
        return this.timeline.length
    }

    public get versionIndex(): number {
        this.computeTimeline()
        const index = this.timeline.indexOf(this.latestHead, 0)
        if (index < 0) { throw new Error("Latest head not in timeline!") }
        return index
    }

    public get latestHead(): LineVersion {
        return this.heads.sort((headA, headB) => { return headA.timestamp - headB.timestamp })[this.lineCount - 1]
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

    private computeTimeline(): void {
        const timeline = this.lines.map(line => line.history.versions).flat().filter(version => { return !version.isHead } )
        timeline.push(this.latestHead)
        this.timeline = timeline.sort( (versionA, versionB) => {

            if (versionA.originTimestamp === versionB.originTimestamp) {
                return versionA === versionB.tracedOrigin ? -1 : 1
            }

            return versionA.originTimestamp - versionB.originTimestamp
         })
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

        this.computeTimeline()
    }

    public update(update: VCSSnapshotData): void {
        console.log("Line Update")

        this.removeLines()

        this.firstLine = this.file.getLine(update._startLine)
        this.lastLine  = this.file.getLine(update._endLine)

        this.addLines()
    }

    public updateLines(): void {
        this.removeLines()
        this.addLines()
    }

    // TODO: CANNOT RETURN TO ANY CONFIG!
    public applyIndex(targetIndex: number): void {
        this.computeTimeline()
        this.timeline[targetIndex].applyToLines(this.lines)
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

/*
class Snapshot extends TrackedBlock implements Injector {

    public readonly uuid = crypto.randomUUID()
    public readonly file: TrackedFile

    public activeInjectionPoint: InjectionPoint<this> | undefined = undefined

    public get versionCount(): number {
        let count = 0
        this.lines.forEach(line => { count += line.history.versionCount })
        return count - this.lineCount + 1 // substract the number of versions selected by default (the head for each line), and add one for all of them
    }

    public get versionIndex(): number {
        return this.previousVersionCount
    }

    public get latestHead(): LineVersion {
        return this.heads.sort((headA, headB) => { return LineVersion.compareForInjector(this, headA, headB, false) })[this.lineCount - 1]
    }

    private get previousVersionCount(): number {
        let count = 0
        this.heads.forEach(head => { count += head.previousVersionCount })
        return count
    }

    private get nextVersionCount(): number {
        let count = 0
        this.heads.forEach(head => { count += head.nextVersionCount })
        return count
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

    public update(update: VCSSnapshotData): void {
        console.log("Line Update")

        this.removeLines()

        this.firstLine = this.file.getLine(update._startLine)
        this.lastLine  = this.file.getLine(update._endLine)

        this.addLines()
    }

    public updateLines(): void {
        this.removeLines()
        this.addLines()
    }

    // TODO: CANNOT RETURN TO ANY CONFIG!
    public applyIndex(targetIndex: number): void {
        const headsMap = this.headsMap
        let   index = this.versionIndex

        // TODO: Maybe find a way to unify the two while loops to simplify code

        while(index < targetIndex) {
            let heads = Array.from(headsMap.values())
            // sorting next changes for each head by timestamp and select the lowest one to find out which head will change next
            heads.sort((headA, headB) => { return LineVersion.compareForInjector(this, headA.next, headB.next, true) })

            const headToUpdate = heads[0]
            const newHead = headToUpdate.next
            if (!newHead) { throw new Error("Cannot satisfy index requirement for snapshot when counting up!") }

            //headToUpdate.histoy.head = newHead
            newHead.applyToLines(this.lines)
            headsMap.set(headToUpdate.line, newHead)

            index++
        }

        while(index > targetIndex) {
            let heads = Array.from(headsMap.values())
            // sorting heads by timestamp, then reversing to get the head that was last modified to revert this modification first
            heads.sort((headA, headB) => { 

                const previousA = headA.previous
                const previousB = headB.previous

                if      (!previousA &&  previousB) { return -1 }
                else if ( previousA && !previousB) { return  1 }
                else if (!previousA && !previousB) { return  0 }

                return LineVersion.compareForInjector(this, headA, headB, false) 

            }).reverse()

            const headToUpdate = heads[0]
            const newHead = headToUpdate.previous
            if (!newHead) { throw new Error("Cannot satisfy index requirement for snapshot when counting down!") }

            //headToUpdate.histoy.head = newHead
            newHead.applyToLines(this.lines)
            headsMap.set(headToUpdate.line, newHead)

            index--
        }

        // create injection point if necessary
        if (this.nextVersionCount > 0) {
            this.activeInjectionPoint = new InjectionPoint(this, this.headsMap)
        } else {
            this.activeInjectionPoint = undefined
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
*/

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
        this.updatePreview()
        return this.file.currentText
    }

    public async lineChanged(change: LineChange): Promise<SnapshotUUID[]> {
        const line = this.file.updateLine(change.lineNumber, change.lineText)
        this.updatePreview()
        return line.snapshotUUIDs
    }

    public async linesChanged(change: MultiLineChange): Promise<SnapshotUUID[]> {

        console.log("Text Update")

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

        const modifiedLines = change.lineText.split(this.file.eol)
        let   affectedLines: TrackedLine[] = []

        const modifiedRange = {
            startLine: change.modifiedRange.startLineNumber,
            endLine:   change.modifiedRange.endLineNumber
        }

        let vcsLines: TrackedLines = new TrackedLines(this.file.eol)
        if (modifyStartLine) {
            vcsLines = this.file.getLines(modifiedRange)
            //affectedLines.push(vcsLines.at(0).update(modifiedLines[0]).line)
        } else {
            // TODO: pushStartDown case not handled well yet, line tracking is off
            if (pushStartLineUp) { 
                modifiedRange.startLine--
                modifiedRange.endLine--
            }
        }


        let linesToConsider = Math.max(vcsLines.length, modifiedLines.length)

        while (linesToConsider - 1 >= 1) {
            const i = linesToConsider - 1

            if (i < vcsLines.length) {
                const line = vcsLines.at(i)
                if (i < modifiedLines.length) {
                    break
                } else {
                    affectedLines.push(line.delete().line)
                }
            } else {
                break
            }

            linesToConsider--
        }

        let lineState = this.file.headsMap

        if (modifyStartLine) {
            affectedLines.push(vcsLines.at(0).update(modifiedLines[0], lineState).line)
        }

        for (let i = 1; i < linesToConsider; i++) {
            if (i < vcsLines.length) {
                const line = vcsLines.at(i)
                if (i < modifiedLines.length) {
                    affectedLines.push(line.update(modifiedLines[i], lineState).line)
                } else {
                    affectedLines.push(line.delete().line)
                }
            } else {
                affectedLines.push(this.file.insertLine(modifiedRange.startLine + i, modifiedLines[i]))
            }
        }

        this.file.updateSnapshots()
        this.updatePreview()

        return affectedLines.map(line => line.snapshotUUIDs).flat()
    }

    public getVersions(snapshot: VCSSnapshotData): void {
        console.log("GET VERSION NOT IMPLEMENTED")
    }
}