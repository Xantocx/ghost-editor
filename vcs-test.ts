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
    snapshots?: Snapshot[] | undefined
}

interface LineVersionRelation {
    origin?: LineVersion | undefined
    previous?: LineVersion | undefined
    next?: LineVersion | undefined
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

    constructor(eol: string, firstLine?: TrackedLine | undefined, lastLine?: TrackedLine | undefined) {
        this.eol = eol
        this.firstLine = firstLine
        this.lastLine  = lastLine
    }

    public get lineCount(): number {
        return this.lines.length
    }

    public get activeLines(): TrackedLines {
        return this.lines.filter(line => { return line.currentlyActive })
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
        const newLastLine = this.lastLineNumber + 1
        const adjustedLineNumber = Math.min(Math.max(lineNumber, 1), newLastLine)
        const snapshots = this.getSnapshots(Math.min(adjustedLineNumber, this.lastLineNumber))

        if (adjustedLineNumber === 1) {
            const firstActive = this.firstActiveLine
            const insertedLine = new TrackedLine(this, content, false, { 
                previous:  firstActive.previous,
                next:      firstActive,
                snapshots: snapshots
            })

            if (!insertedLine.previous) { 
                this.firstLine = insertedLine
            }

            return insertedLine
        } else if (adjustedLineNumber === newLastLine) {
            const lastActive  = this.lastActiveLine
            const insertedLine = new TrackedLine(this, content, false, { 
                previous:  lastActive,
                next:      lastActive.next,
                snapshots: snapshots
            })

            if (!insertedLine.next) { 
                this.lastLine = insertedLine
            }

            return insertedLine
        } else {
            const currentLine = this.getLine(adjustedLineNumber)
            const newLine  = new TrackedLine(this, content, false, { 
                previous:  currentLine.previous, 
                next:      currentLine ,
                snapshots: snapshots
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
        line.delete()
        return line
    }

    public deleteLines(range: LineRange): TrackedLines {

        const lines = this.getLines(range)

        lines.forEach(line => {
            line.delete()
        })

        return lines
    }

    public updateLine(lineNumber: number, content: string): SnapshotUUID[] {
        const line = this.getLine(lineNumber)
        line.update(content)
        return line.affectedSnapshotUUIDs
    }

    public updateLines(lineNumber: number, content: string[]): SnapshotUUID[] {
        const count = content.length
        const lines = this.getLines({ startLine: lineNumber, endLine: lineNumber + count - 1 })

        lines.forEach((line, index) => {
            line.update(content[index])
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

    constructor(file: TrackedFile, initialContent: string, loadedLine: boolean, relations?: TrackedLineRelation) {
        this.file = file
        this.snapshots = relations?.snapshots ? relations.snapshots : []
        this.history = new LineHistory(this, initialContent, loadedLine)

        if (relations) {
            this.previous = relations.previous
            this.next = relations.next

            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public update(content: string): LineVersion {
        if (content === this.currentContent) { return this.history.head }
        return this.history.createNewVersion(true, content)
    }

    public delete(): LineVersion {
        return this.history.deleteLine()
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

    public get injectionPoints(): IInjectionPoint[] {
        return this.line.snapshots.map(snapshot => { return snapshot.activeInjectionPoint }).filter(injectionPoint => injectionPoint)
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

    constructor(line: TrackedLine, initialContent: string, loadedLine?: boolean) {
        this.line  = line

        if (loadedLine) {
            // when line is loaded from file, it may never disappear in the version history, it represents the first version
            console.log("CREATION STRATEGY 1")
            console.log(this.injectionPoints)
            this.head  = new LineVersion(this, this.getTimestamp(), true, initialContent, { injectionPoints: this.injectionPoints })
            this.start = this.head
            this.end   = this.start
        } else {
            // any line inserted later could also be deleted through version scrubbing
            console.log("CREATION STRATEGY 2")
            console.log(this.injectionPoints)
            this.head  = new LineVersion(this, this.getTimestamp(), false, "", { injectionPoints: this.injectionPoints }) // necessary to make sure the line state for each version is computed correctly
            this.start = this.head
            console.log("CREATION STRATEGY 3")
            console.log(this.injectionPoints)
            this.end   = new LineVersion(this, this.getTimestamp(), true, initialContent, { previous: this.start, injectionPoints: this.injectionPoints })
        }

        this.head  = this.end
    }

    private getTimestamp(): number {
        return this.file.getTimestamp()
    }

    private cloneHeadToEnd(): LineVersion {
        this.end = this.head.clone(this.getTimestamp(), { previous: this.end, injectionPoints: this.injectionPoints })
        this.head = this.end
        return this.head
    }

    public createNewVersion(active: boolean, content: string): LineVersion {
        if (this.head !== this.end) {
            this.cloneHeadToEnd()
        }

        console.log("CREATION STRATEGY 4")
        //console.log(this.injectionPoints)
        this.end = new LineVersion(this, this.getTimestamp(), active, content, { previous: this.end, injectionPoints: this.injectionPoints })
        this.head = this.end
        
        return this.head
    }

    public deleteLine(): LineVersion {
        return this.createNewVersion(false, "")
    }

}

class LineVersion {

    public readonly histoy: LineHistory

    public readonly timestamp: number
    public readonly active: boolean
    public readonly content: string

    private readonly lineState: LineState = new Map<TrackedLine, LineVersion>()

    public readonly origin: LineVersion | undefined
    private clones: LineVersion[] = []

    public previous: LineVersion | undefined
    public next: LineVersion | undefined

    private readonly injectionPoints: IInjectionPoint[] = []

    private get tracedOrigin(): LineVersion | undefined {

        let current: LineVersion = this

        while (current.origin || current.previous) {
            if (current.origin) { return current.origin }
            else                { current = current.previous }
        }

        return undefined
    }

    public get file(): TrackedFile {
        return this.line.file
    }

    public get line(): TrackedLine {
        return this.histoy.line
    }

    public get isHead(): boolean {
        return this.histoy.head === this
    }

    public get previousVersionCount(): number {
        return this.previous ? this.previous.previousVersionCount + 1 : 0
    }

    public get nextVersionCount(): number {
        return this.next ? this.next.nextVersionCount + 1 : 0
    }

    public get versionOrder(): number {
        return this.previousVersionCount + 1
    }

    public get originTimestamp(): number {
        const timestamp = this.tracedOrigin?.timestamp
        return timestamp ? timestamp : this.timestamp
    }

    constructor(history: LineHistory, timestamp: number, active: boolean, content: string, relations?: LineVersionRelation) {
        this.histoy = history
        this.timestamp = timestamp
        this.active = active
        this.content = content

        this.lineState = this.file.headsMap
        if (this.histoy.head) { this.lineState.set(this.line, this.histoy.head) }

        if (relations) {
            this.origin = relations.origin
            this.previous = relations.previous
            this.next = relations.next
            this.injectionPoints = relations.injectionPoints

            if (this.origin)   { this.origin.clones.push(this) }
            if (this.previous) { this.previous.next = this }
            if (this.next)     { this.next.previous = this }
        }
    }

    public getInjectorComparable(injector: Injector, log?: boolean): InjectionComparable {

        const injectionPoint = this.injectionPoints?.find(point => { return point.injector === injector })

        if (injectionPoint) {
            return InjectionComparable.createWithInjectionPoint(injectionPoint, this)
        } else {
            return InjectionComparable.create(this)
        }

        /*
        if (injectionPoint) { 
            if (log) { console.log("Actual: " + this.timestamp + " vs Injection Point Adjusted: " + injectionPoint.getAdjustedTimestamp(this)) }
            return injectionPoint.getAdjustedTimestamp(this)
        }

        // alternative computation if no insertion point was provided
        let lastPreviousVersion: LineVersion | undefined = undefined

        injector.lines.forEach(line => {
            if (this.lineState.has(line)) {
                const alternative = this.lineState.get(line)
                if (!lastPreviousVersion || alternative.timestamp > lastPreviousVersion.timestamp) {
                    lastPreviousVersion = alternative
                }
            }
        })

        if (log) { 
            const result = lastPreviousVersion ? lastPreviousVersion.timestamp : this.timestamp
            console.log("Actual: " + this.timestamp + " vs Last Previous Version: " + result)
        }

        return lastPreviousVersion ? lastPreviousVersion.timestamp : this.timestamp
        */
    }

    public apply(): void {
        this.histoy.head = this
    }

    public clone(timestamp: number, relations?: LineVersionRelation): LineVersion {
        if (!relations?.origin) { relations.origin = this }
        console.log("CREATION STRATEGY 5")
            console.log(this.injectionPoints)
        return new LineVersion(this.histoy, timestamp, this.active, this.content, relations)
    }

    // TODO: FIX THAT SORTING TO MAKE SENSE IN ALL CASES, ESPECIALLY AFTER EDITING
    public static compare(snapshot: Snapshot, versionA: LineVersion | undefined, versionB: LineVersion | undefined, undefinedIsGreater: boolean): number {

        if (versionA && !versionB) {
            return undefinedIsGreater ? -1 :  1
        } else if (!versionA && versionB) {
            return undefinedIsGreater ?  1 : -1
        } else if (!versionA && !versionB) {
            return 0
        }

        const comparableA = versionA.getInjectorComparable(snapshot)
        const comparableB = versionB.getInjectorComparable(snapshot)

        return InjectionComparable.compare(comparableA, comparableB)

        /*
        const snapshotTimestampA = versionA.getInjectorTimestamp(snapshot)
        const snapshotTimestampB = versionB.getInjectorTimestamp(snapshot)

        const timestampA = versionA.timestamp
        const timestampB = versionB.timestamp

        const lineA = versionA.line
        const lineB = versionB.line

        // order them by origin timestamps instead of own timestamps, this way changes based on this origin will follow immediately on the origin
        if (snapshotTimestampA !== snapshotTimestampB) { 
            return snapshotTimestampA < snapshotTimestampB ? -1 : 1
        } else if (timestampA !== timestampB) {
            return timestampA < timestampB ? -1 : 1
        } else if (lineA === lineB) {
            return versionA.versionOrder < versionB.versionOrder ? -1 : 1
        } else {
            return lineA.linePosition < lineB.linePosition ? -1 : 1
        }
        */
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
    timestamp: number
    getAdjustedTimestamp(version: LineVersion): number
}

class InjectionComparable {

    public readonly timestamp: number
    public readonly sequenceNumber: number

    public static createWithInjectionPoint(injectionPoint: IInjectionPoint, version: LineVersion): InjectionComparable {
        return new InjectionComparable(injectionPoint.timestamp, version.timestamp)
    }

    public static create(version: LineVersion): InjectionComparable {
        return new InjectionComparable(version.timestamp, version.timestamp)
    }

    public static compare(comparableA: InjectionComparable, comparableB: InjectionComparable): number {
        if (comparableA.timestamp !== comparableB.timestamp) { return comparableA.timestamp      - comparableB.timestamp }
        else                                                 { return comparableA.sequenceNumber - comparableB.sequenceNumber }
    }

    protected constructor(timestamp: number, sequenceNumber: number) {
        this.timestamp = timestamp
        this.sequenceNumber = sequenceNumber
    }
}

/*
class InjectionPointComparable extends InjectionComparable {

    constructor(injectionPoint: IInjectionPoint, version: LineVersion) {
        super(injectionPoint.timestamp, version.timestamp)
    }
}

class VersionComparable extends InjectionComparable {

    constructor(version: LineVersion) {
        super(version.timestamp, version.timestamp)
    }
}
*/

class InjectionPoint<InjectorClass extends Injector> implements IInjectionPoint {

    public readonly injector: InjectorClass
    public readonly lineState: LineState
    public readonly timestamp: number

    public readonly creationTimestamp: number

    public get versions(): LineVersion[] {
        return Array.from(this.lineState.values())
    }

    constructor(injector: InjectorClass, lineState: LineState) {
        this.injector  = injector
        this.lineState = lineState
        this.timestamp = this.computeTimestamp()

        this.creationTimestamp = this.injector.file.getTimestamp()
    }

    private computeTimestamp(): number {
        let timestamp = -1
        this.versions.forEach(version => { timestamp = Math.max(timestamp, version.timestamp) })
        return timestamp
    }

    public getAdjustedTimestamp(version: LineVersion): number {
        return this.timestamp + (version.timestamp - this.creationTimestamp)
    }
}

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
        return this.heads.sort((headA, headB) => { return LineVersion.compare(this, headA, headB, false) })[this.lineCount - 1]
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

    public applyIndex(targetIndex: number): void {
        const headsMap = this.headsMap
        let   index = this.versionIndex

        while(index < targetIndex) {
            let heads = Array.from(headsMap.values())
            heads.sort((headA, headB) => { return LineVersion.compare(this, headA.next, headB.next, true) })

            const headToUpdate = heads[0]
            const newHead = headToUpdate.next
            if (!newHead) { throw new Error("Cannot satisfy index requirement for snapshot when counting up!") }

            //console.log("NEW HEAD:\nComputed Timestamp: " + newHead.getInjectorTimestamp(this) + "\nTimestamp: " + newHead.timestamp)

            headToUpdate.histoy.head = newHead
            headsMap.set(headToUpdate.line, newHead)

            index++

            if (index === targetIndex) {
                console.log(newHead.getInjectorComparable(this))
                //console.log("Injector Timestamp: " + newHead.getInjectorTimestamp(this) + " vs Actual Timestamp: " + newHead.timestamp)
            }
        }

        while(index > targetIndex) {
            let heads = Array.from(headsMap.values())
            heads.sort((headA, headB) => { return LineVersion.compare(this, headA.previous, headB.previous, false) }).reverse()

            const headToUpdate = heads[0]
            const newHead = headToUpdate.previous
            if (!newHead) { throw new Error("Cannot satisfy index requirement for snapshot when counting down!") }

            //console.log("NEW HEAD:\nComputed Timestamp: " + newHead.getInjectorTimestamp(this) + "\nTimestamp: " + newHead.timestamp)

            headToUpdate.histoy.head = newHead
            headsMap.set(headToUpdate.line, newHead)

            index--

            if (index === targetIndex) {
                console.log(newHead.getInjectorComparable(this))
                //console.log("Injector Timestamp: " + newHead.getInjectorTimestamp(this) + " vs Actual Timestamp: " + newHead.timestamp)
            }
        }

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
        const uuids = this.file.updateLine(change.lineNumber, change.lineText)
        this.updatePreview()
        return uuids
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

        const modifyStartLine = !insertOnly || !(pushStartLineDown) && !(pushStartLineUp)

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
            firstLine.update(modifiedLines[0])
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
                    line.update(modifiedLines[i])
                } else {
                    line.delete()
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