import { VCSBlockRange } from "../../app/components/vcs/vcs-rework"
import { IRange } from "../utils/types"
import { Range } from "monaco-editor"

export interface ReferenceProvider {
    firstVisibleLine: number
}

export interface RangeProvider {
    range: VCSBlockRange
}

export class LineLocator {

    public referenceProvider: ReferenceProvider
    public rangeProvider: RangeProvider

    public get firstVisibleLine(): number { return this.referenceProvider.firstVisibleLine }

    public get range(): Range {
        const range = this.rangeProvider.range
        return new Range(range.startLine, 1, range.endLine, Number.MAX_VALUE)
    }

    public set range(range: IRange) {
        this.rangeProvider.range = { startLine: range.startLineNumber, endLine: range.endLineNumber }
    }

    public get startLine(): number {
        return Math.min(this.range.startLineNumber, this.range.endLineNumber)
    }

    public get endLine(): number {
        return Math.max(this.range.startLineNumber, this.range.endLineNumber)
    }

    public get startRendered(): boolean {
        return this.firstVisibleLine <= this.startLine
    }

    constructor(reference: ReferenceProvider, position: RangeProvider) {
        this.referenceProvider = reference
        this.rangeProvider = position
    }
}