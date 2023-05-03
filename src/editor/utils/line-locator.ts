import { IRange } from "../utils/types"
import { Range } from "monaco-editor"

export interface ReferenceProvider {
    topLine: number
}

export interface RangeProvider {
    range: IRange
}

export class LineLocator {

    public readonly referenceProvider: ReferenceProvider
    public readonly rangeProvider: RangeProvider

    public get editorTopLine(): number {
        return this.referenceProvider.topLine
    }

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
        return this.editorTopLine <= this.startLine
    }

    constructor(reference: ReferenceProvider, position: RangeProvider) {
        this.referenceProvider = reference
        this.rangeProvider = position
    }
}