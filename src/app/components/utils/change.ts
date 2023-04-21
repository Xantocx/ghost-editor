import * as monaco from "monaco-editor"

type Range = monaco.IRange
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

    public readonly changeBehaviour: ChangeBehaviour

    public readonly timestamp: number
    public readonly changeType: ChangeType
    public readonly newText: string
    public readonly isFlushing: boolean

    static create(timestamp: number, event: ContentChangedEvent, change: ContentChange): AnyChange {
        // TODO: VALIDATE THIS CHECK!
        if (change.rangeLength === 1 && !change.text.includes("\n")) {
            return LineChange.create(timestamp, event, change)
        } else {
            return MultiLineChange.create(timestamp, event, change)
        }
    }

    constructor(timestamp: number, event: ContentChangedEvent, changeBehaviour: ChangeBehaviour, newText: string) {
        this.timestamp = timestamp
        this.changeType = extractChangeType(event)
        this.changeBehaviour = changeBehaviour
        this.newText = newText
        this.isFlushing = event.isFlush
    }
}

export class ChangeSet extends Array<AnyChange> {

    public readonly timestamp: number
    public readonly event: ContentChangedEvent

    constructor(timestamp: number, event: ContentChangedEvent) {
        const changes = event.changes.map(change => {
            return Change.create(timestamp, event, change)
        })

        super(...changes)

        this.timestamp = timestamp
        this.event = event
    }
}

export class LineChange extends Change {

    public readonly lineNumber: number

    static override create(timestamp: number, event: ContentChangedEvent, change: ContentChange): LineChange {
        return new LineChange(timestamp, event, change.range.startLineNumber, change.text)
    }

    constructor(timestamp: number, event: ContentChangedEvent, lineNumber: number, newText: string) {
        super(timestamp, event, ChangeBehaviour.Line, newText)
        this.lineNumber = lineNumber
    }
}

export class MultiLineChange extends Change {

    public readonly range: Range
    public readonly length: number
    public readonly offset: number

    static override create(timestamp: number, event: ContentChangedEvent, change: ContentChange): MultiLineChange {
        return new MultiLineChange(timestamp, event, change.range, change.rangeLength, change.rangeOffset, change.text)
    }

    constructor(timestamp: number, event: ContentChangedEvent, range: Range, length: number, offset: number, newText: string) {
        super(timestamp, event, ChangeBehaviour.Line, newText)
        this.range = range
        this.length = length
        this.offset = offset
    }
}