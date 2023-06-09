import { IRange, Range } from "../utils/range"
import { SnapshotUUID, Text, VCSProvider, VCSSession, TagId } from "../vcs/vcs-provider"
import { RangeProvider } from "../../../editor/utils/line-locator"

export interface VCSSnapshotData {
    uuid: SnapshotUUID
    _startLine: number
    _endLine: number
    versionCount: number
    versionIndex: number
}

export interface VCSVersion {
    blockId:             string
    tagId:               TagId
    name:                string
    text:                Text
    automaticSuggestion: boolean
}

export class VCSSnapshot implements VCSSnapshotData, RangeProvider {

    public readonly uuid: string
    public readonly session: VCSSession

    public _startLine: number
    public _endLine: number

    public versionCount: number
    public versionIndex: number

    public get startLine(): number {
        return this._startLine
    }

    public set startLine(line: number) {
        if (this._startLine !== line) {
            this._startLine = line
            this.updateServer()
        }
    }

    public get endLine(): number {
        return this._endLine
    }

    public set endLine(line: number) {
        if (this._endLine !== line) {
            this._endLine = line
            this.updateServer()
        }
    }

    public get lineCount(): number {
        return this.endLine - this.startLine + 1
    }

    public get range(): IRange {
        return new Range(this.startLine, 1, this.endLine, Number.MAX_SAFE_INTEGER)
    }

    public set range(range: IRange) {
        // used to update server, not anymore for overlapping reasons when inserting lines too late
        this.update(range)
    }

    public static create(session: VCSSession, snapshot: VCSSnapshotData): VCSSnapshot {
        const range = new Range(snapshot._startLine, 1, snapshot._endLine, Number.MAX_SAFE_INTEGER)
        return new VCSSnapshot(snapshot.uuid, session, range, snapshot.versionCount, snapshot.versionIndex)
    }

    constructor(uuid: string, session: VCSSession, range: IRange, versionCount: number, versionIndex: number) {
        this.uuid = uuid
        this.session = session
        
        this._startLine = Math.min(range.startLineNumber, range.endLineNumber)
        this._endLine   = Math.max(range.startLineNumber, range.endLineNumber)

        this.versionCount = versionCount
        this.versionIndex = versionIndex
    }

    private update(range: IRange): boolean {
        const start = Math.min(range.startLineNumber, range.endLineNumber)
        const end   = Math.max(range.startLineNumber, range.endLineNumber)

        const updated = this._startLine !== start || this._endLine !== end

        if (updated) {
            this._startLine = start
            this._endLine   = end
        }

        return updated
    }

    private updateServer(): void {
        this.session.updateSnapshot(this.compress())
    }

    public compress(): VCSSnapshotData {

        const parent = this

        return {
            uuid: parent.uuid,
            _startLine: parent.startLine,
            _endLine: parent.endLine,
            versionCount: parent.versionCount,
            versionIndex: parent.versionIndex
        }
    }

    public manualUpdate(range: IRange) {
        if (this.update(range)) {
            this.updateServer()
        }
    }
}