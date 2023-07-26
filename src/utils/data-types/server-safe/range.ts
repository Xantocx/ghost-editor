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