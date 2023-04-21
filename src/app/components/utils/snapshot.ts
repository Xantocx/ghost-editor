import { VCSAdapter } from "../vcs-provider"
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

export interface VCSAdapterSnapshot {
    uuid: string
    _startLine: number
    _endLine: number
}

export class VCSSnapshot implements VCSAdapterSnapshot, PositionProvider {

    public readonly uuid: string
    public readonly adapter: VCSAdapter

    public _startLine: number
    public _endLine: number

    public get startLine(): number {
        return this._startLine
    }

    public set startLine(line: number) {
        if (this._startLine !== line) {
            this._startLine = line
            this.adapter.updateSnapshot(this)
        }
    }

    public get endLine(): number {
        return this._endLine
    }

    public set endLine(line: number) {
        if (this._endLine !== line) {
            this._endLine = line
            this.adapter.updateSnapshot(this)
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
            this.adapter.updateSnapshot(this)
        }
    }

    public static recover(adapter: VCSAdapter, snapshot: VCSAdapterSnapshot): VCSSnapshot {
        const range = new Range(snapshot._startLine, 1, snapshot._endLine, Number.MAX_SAFE_INTEGER)
        return new VCSSnapshot(snapshot.uuid, adapter, range)
    }

    constructor(uuid: string, adapter: VCSAdapter, range: IRange) {
        this.uuid = uuid
        this.adapter = adapter
        
        this._startLine = Math.min(range.startLineNumber, range.endLineNumber)
        this._endLine   = Math.max(range.startLineNumber, range.endLineNumber)
    }

    public compress(): VCSAdapterSnapshot {

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