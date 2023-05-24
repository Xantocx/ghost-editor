import { IRange } from "../utils/types"
import { Range } from "monaco-editor"

export interface ReferenceProvider {
    firstVisibleLine: number
}

export interface RangeProvider {
    range: IRange
}

export class LineLocator {

    public referenceProvider: ReferenceProvider
    public rangeProvider: RangeProvider

    public get firstVisibleLine(): number { return this.referenceProvider.firstVisibleLine }

    public get range(): Range {
        const range = this.rangeProvider.range
        return new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn)
    }

    public set range(range: IRange) {
        this.rangeProvider.range = range
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