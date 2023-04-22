import { VCSProvider } from "../vcs/vcs-provider"
import { PositionProvider } from "../../../editor/utils/line-locator"

export interface IRange {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
}

export class Range implements IRange {

    public startLineNumber: number
    public startColumn: number
    public endLineNumber: number
    public endColumn: number

    constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number) {
        this.startLineNumber = startLineNumber
        this.startColumn = startColumn
        this.endLineNumber = endLineNumber
        this.endColumn = endColumn
    }
}

export interface VCSSnapshotData {
    uuid: string
    _startLine: number
    _endLine: number
}

export class VCSSnapshot implements VCSSnapshotData, PositionProvider {

    public readonly uuid: string
    public readonly provider: VCSProvider

    public _startLine: number
    public _endLine: number

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
        if (this.update(range)) {
            this.updateServer()
        }
    }

    public static create(provider: VCSProvider, snapshot: VCSSnapshotData): VCSSnapshot {
        const range = new Range(snapshot._startLine, 1, snapshot._endLine, Number.MAX_SAFE_INTEGER)
        return new VCSSnapshot(snapshot.uuid, provider, range)
    }

    constructor(uuid: string, provider: VCSProvider, range: IRange) {
        this.uuid = uuid
        this.provider = provider
        
        this._startLine = Math.min(range.startLineNumber, range.endLineNumber)
        this._endLine   = Math.max(range.startLineNumber, range.endLineNumber)
    }

    private updateServer(): void {
        this.provider.updateSnapshot(this.compress())
    }

    public compress(): VCSSnapshotData {

        const parent = this

        return {
            uuid: parent.uuid,
            _startLine: parent.startLine,
            _endLine: parent.endLine
        }
    }

    public update(range: IRange): boolean {
        const start = Math.min(range.startLineNumber, range.endLineNumber)
        const end   = Math.max(range.startLineNumber, range.endLineNumber)

        const updated = this._startLine !== start || this._endLine !== end

        if (updated) {
            this._startLine = start
            this._endLine   = end
        }

        return updated
    }
}