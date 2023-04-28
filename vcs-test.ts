import { LineChange, MultiLineChange, AnyChange, ChangeSet } from "./src/app/components/data/change";
import { VCSSnapshotData, VCSSnapshot } from "./src/app/components/data/snapshot";
import { IRange } from "./src/app/components/utils/range";
import { VCSServer } from "./src/app/components/vcs/vcs-provider";


class TrackedFile {

    private filePath: string | null
    private lines: TrackedLine[]
    private snapshots: Snapshot[]

    public static create(filePath: string | null, content: string, eol: string): TrackedFile {
        const file

        const lines = content.split(eol)
        const trackedLines = lines.map(line => {
            return new TrackedLine(file, lineNumber, timestamp, line)
        })
    }

    constructor(filePath: string | null, lines?: TrackedLine[], snapshots?: Snapshot[]) {
        this.filePath = filePath
        this.lines = lines ? lines : []
        this.snapshots = snapshots ? snapshots : []
    }
}

class TrackedLine {

    public readonly file: TrackedFile
    public readonly history: LineHistory

    private lineNumber: number

    constructor(file: TrackedFile, lineNumber: number, initialTimestamp: number, initialContent: string) {
        this.file = file
        this.history = new LineHistory(this, initialTimestamp, initialContent)

        this.lineNumber = lineNumber
    }
}

class LineHistory {

    public readonly line: TrackedLine
    
    private head: LineVersion

    private start: LineVersion
    private end: LineVersion

    constructor(line: TrackedLine, initialTimestamp: number, initialContent: string) {
        this.line = line
        this.start = new LineVersion(this, initialTimestamp, initialContent, {})
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

    constructor(history: LineHistory, timestamp: number, content: string, relations: LineVersionRelation) {
        this.histoy = history
        this.timestamp = timestamp
        this.content = content

        this.origin = relations.origin
        this.previous = relations.previous
        this.next = relations.next
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