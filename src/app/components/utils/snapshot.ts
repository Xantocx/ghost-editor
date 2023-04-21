import { VCSAdapter } from "../vcs-provider"

export class VCSSnapshot {

    public readonly uuid = crypto.randomUUID()

    public readonly adapter: VCSAdapter

    private _startLine: number
    public get startLine(): number {
        return this._startLine
    }

    public set startLine(line: number) {
        this._startLine = line
    }

    private _endLine: number
    public get endLine(): number {
        return this._endLine
    }

    public set endLine(line: number) {
        this._endLine = line
    }
}