import { IRange } from "../utils/types"
import { Range } from "monaco-editor"

export interface ReferenceProvider {
    topLine: number
}

export interface PositionProvider {
    range: IRange
}

export class LineLocator {

    public readonly reference: ReferenceProvider
    public readonly position: PositionProvider

    public get editorTopLine(): number {
        return this.reference.topLine
    }

    public get range(): Range {
        const range = this.position.range
        return new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn)
    }

    public set range(range: IRange) {
        this.position.range = range
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

    constructor(reference: ReferenceProvider, position: PositionProvider) {
        this.reference = reference
        this.position = position
    }
}