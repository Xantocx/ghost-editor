import * as monaco from "monaco-editor"
import { Range, Selection, Editor, Model, LayoutInfo } from "../../utils/types"
import { GhostEditor } from "../../editor"
import { GhostSnapshotHeader } from "./header"
import { GhostSnapshotHighlight } from "./highlight"
import { PositionProvider, LineLocator } from "../../utils/line-locator"

export class GhostSnapshot implements PositionProvider {

    public readonly editor: GhostEditor
    private readonly locator: LineLocator

    private header: GhostSnapshotHeader
    private highlight: GhostSnapshotHighlight

    private _range: Range
    public get range(): Range {
        return this._range
    }

    public set range(new_range: Range) {
        const lastColumn = this.model ? this.model.getLineMaxColumn(new_range.endLineNumber) : Number.MAX_SAFE_INTEGER
        this._range = new monaco.Range(new_range.startLineNumber, 1, new_range.endLineNumber, lastColumn)
    }

    public get core(): Editor {
        return this.editor.core
    }

    public get model(): Model | null {
        return this.editor.model
    }

    public get start(): number {
        return Math.min(this.range.startLineNumber, this.range.endLineNumber)
    }

    public get end(): number {
        return Math.max(this.range.startLineNumber, this.range.endLineNumber)
    }

    public get lineCount(): number {
        return this.end - this.start + 1
    }

    public get layoutInfo(): LayoutInfo {
        return this.core.getLayoutInfo();
    }

    public get editorWidth(): number {
        return this.layoutInfo.minimap.minimapLeft - this.layoutInfo.contentLeft
    }

    public get longestLineWidth(): number {

        let longestLine = 0

        const model = this.editor.model
        const tabSize = this.editor.tabSize
        if (model) {
            for (let line = this.start; line <= this.end; line++) {

                // what a pain...
                const content = model.getLineContent(line)
                const tabCount = content.split("\t").length - 1
                const tabLength = (tabSize ? (tabCount) * tabSize : 0) * this.editor.spaceWidth
                const contentLength = (content.length - tabCount) * this.editor.characterWidth
                const lineLength = contentLength + tabLength

                longestLine = Math.max(longestLine, lineLength)
            }
        }

        return longestLine
    }

    private get defaultHighlightWidth(): number {
        return 0.7 * this.editorWidth
    }

    public get highlightWidth(): number {
        return Math.max(this.defaultHighlightWidth, this.longestLineWidth + 20)
    }

    constructor(editor: GhostEditor, selection: Selection) {
        this.editor = editor
        this.range = selection

        this.locator = new LineLocator(editor, this)

        this.display()
    }

    private display(): void {

        const color = this.range.startLineNumber < 30 ? "ghostHighlightRed" : "ghostHighlightGreen"

        this.header    = new GhostSnapshotHeader(this, this.locator, false)
        this.highlight = new GhostSnapshotHighlight(this, this.locator, color)

        const changeSubscription = this.highlight.onDidChange((event) => {
            const new_range = this.highlight.range
            if (new_range) {
                this.range = new_range
                this.header.update()
                this.highlight.update()
            }
        })

        this.setupHeaderHiding()
    }

    private setupHeaderHiding(): void {
        const headerMouseSubscription = this.header.onMouseEnter((mouseOn: boolean) => {
            if (!mouseOn && !this.highlight.mouseOn) {
                this.header.hide()
            }
        })
        const highlightMouseSubscription = this.highlight.onMouseEnter((mouseOn: boolean) => {
            if (mouseOn) {
                this.header.show()
            } else if(!this.header.mouseOn) {
                this.header.hide()
            }
        })
    }
}