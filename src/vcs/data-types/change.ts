import * as monaco from "monaco-editor"
import { IRange, Range } from "../../utils/data-types/server-safe/range"

type TextModel = monaco.editor.ITextModel
type ContentChange = monaco.editor.IModelContentChange
type ContentChangedEvent = monaco.editor.IModelContentChangedEvent

export enum ChangeBehaviour {
    Line,
    MultiLine
}

enum ChangeType {
    Modification,
    Undo,
    Redo
}

class LineRange {
    public readonly startLine: number
    public readonly endLine: number

    constructor(startLine: number, endLine: number) {
        this.startLine = startLine
        this.endLine = endLine
    }
}

function extractChangeType(event: ContentChangedEvent): ChangeType {
    if (event.isRedoing) {
        return ChangeType.Redo
    } else if (event.isUndoing) {
        return ChangeType.Undo
    } else {
        return ChangeType.Modification
    }
}

export type AnyChange = LineChange | MultiLineChange

export abstract class Change {

    public readonly timestamp: number

    public readonly changeBehaviour: ChangeBehaviour
    public readonly changeType: ChangeType
    public readonly isFlushing: boolean

    public readonly modifiedRange: IRange
    public readonly insertedText: string

    public readonly lineRange: LineRange
    public readonly lineText: string

    public readonly fullText: string

    static create(timestamp: number, model: TextModel, eol: string, event: ContentChangedEvent, change: ContentChange): AnyChange {
        
        // should be unnecessary (min/max), but let's be safe for now
        const start = Math.min(change.range.startLineNumber, change.range.endLineNumber)
        const end   = Math.max(change.range.startLineNumber, change.range.endLineNumber)
        const count = end - start + 1

        if (count === 1 && !change.text.includes(eol)) {
            return LineChange.create(timestamp, model, eol, event, change)
        } else {
            return MultiLineChange.create(timestamp, model, eol, event, change)
        }
    }

    constructor(timestamp: number, event: ContentChangedEvent, changeBehaviour: ChangeBehaviour, modifiedRange: IRange, insertedText: string, lineRange: LineRange, lineText: string, fullText: string) {
        this.timestamp = timestamp
        
        this.changeBehaviour = changeBehaviour
        this.changeType = extractChangeType(event)
        this.isFlushing = event.isFlush

        this.modifiedRange = modifiedRange
        this.insertedText = insertedText

        this.lineRange = lineRange
        this.lineText = lineText

        this.fullText = fullText
    }
}

export class ChangeSet extends Array<AnyChange> {

    public readonly timestamp: number
    public readonly event: ContentChangedEvent

    constructor(timestamp: number, model: TextModel, eol: string, event: ContentChangedEvent) {
        const changes = event.changes.map(change => {
            return Change.create(timestamp, model, eol, event, change)
        })

        super(...changes)

        this.timestamp = timestamp
        this.event = event
    }
}

export class LineChange extends Change {

    public readonly lineNumber: number

    static override create(timestamp: number, model: TextModel, eol: string, event: ContentChangedEvent, change: ContentChange): LineChange {
        const lineNumber = change.range.startLineNumber
        const lineText   = model.getLineContent(lineNumber)
        return new LineChange(timestamp, event, change.range, lineNumber, change.text, lineText, model.getValue())
    }

    constructor(timestamp: number, event: ContentChangedEvent, range: IRange, lineNumber: number, insertedText: string, lineText: string, fullText: string) {
        const lineRange = new LineRange(lineNumber, lineNumber)
        super(timestamp, event, ChangeBehaviour.Line, range, insertedText, lineRange, lineText, fullText)
        this.lineNumber = lineNumber
    }
}

export class MultiLineChange extends Change {

    public readonly length: number
    public readonly offset: number

    static override create(timestamp: number, model: TextModel, eol: string, event: ContentChangedEvent, change: ContentChange): MultiLineChange {
        const EOLRegex = new RegExp(eol, "g")

        const insertedText = change.text
        const eolCount     = (insertedText.match(EOLRegex)  || []).length

        const range     = change.range
        const lineRange = new LineRange(range.startLineNumber, range.startLineNumber + eolCount)

        const fullRange = new Range(lineRange.startLine, 1, lineRange.endLine, Number.MAX_SAFE_INTEGER)
        const lineText  = model.getValueInRange(fullRange)

        return new MultiLineChange(timestamp, event, range, change.rangeLength, change.rangeOffset, insertedText, lineRange, lineText, model.getValue())
    }

    constructor(timestamp: number, event: ContentChangedEvent, range: IRange, length: number, offset: number, insertedText: string, lineRange: LineRange, lineText: string, fullText: string) {
        super(timestamp, event, ChangeBehaviour.MultiLine, range, insertedText, lineRange, lineText, fullText)
        this.length = length
        this.offset = offset
    }
}