import { Range } from "../utils/types"

export interface ReferenceProvider {
    topLine: number
}

export interface PositionProvider {
    range: Range
}

export class LineLocator {

    public readonly reference: ReferenceProvider
    public readonly position: PositionProvider

    public get editorTopLine(): number {
        return this.reference.topLine
    }

    public get range(): Range {
        return this.position.range
    }

    public set range(new_range) {
        this.position.range = new_range
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