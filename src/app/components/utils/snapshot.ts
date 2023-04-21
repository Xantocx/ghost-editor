import { VCSAdapter } from "../vcs-provider"
import { PositionProvider } from "../../../editor/utils/line-locator"
import * as crypto from "crypto"

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

export class VCSSnapshot implements PositionProvider {

    public readonly uuid = crypto.randomUUID()
    public readonly adapter: VCSAdapter

    private _startLine: number
    private _endLine: number

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

    constructor(adapter: VCSAdapter, range: IRange) {
        this.adapter = adapter
        
        this._startLine = Math.min(range.startLineNumber, range.endLineNumber)
        this._endLine   = Math.max(range.startLineNumber, range.endLineNumber)
    }

    public update(range: IRange): boolean {
        const start = Math.min(range.startLineNumber, range.endLineNumber)
        const end   = Math.max(range.startLineNumber, range.endLineNumber)

        const updated = this._startLine !== start || this._startLine !== end

        if (updated) {
            this._startLine = start
            this._endLine   = end
        }

        return updated
    }
}