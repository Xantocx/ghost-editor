import { IRange, Editor, Model, LayoutInfo } from "../../utils/types"
import { GhostEditor } from "../../editor"
import { GhostSnapshotHeader } from "./header"
import { GhostSnapshotHighlight } from "./highlight"
import { PositionProvider, LineLocator } from "../../utils/line-locator"
import { VCSSnapshotData, VCSSnapshot } from "../../../app/components/data/snapshot"

export class GhostSnapshot implements PositionProvider {

    public readonly editor: GhostEditor
    private readonly snapshot: VCSSnapshot
    private readonly locator: LineLocator

    private header: GhostSnapshotHeader
    private highlight: GhostSnapshotHighlight

    public get core(): Editor {
        return this.editor.core
    }

    public get model(): Model | null {
        return this.editor.model
    }

    public get range(): IRange {
        return this.snapshot.range
    }

    public set range(range: IRange) {
        this.snapshot.range = range
    }

    public get startLine(): number {
        return this.snapshot.startLine
    }

    public get endLine(): number {
        return this.snapshot.endLine
    }

    public get lineCount(): number {
        return this.snapshot.lineCount
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
            for (let line = this.startLine; line <= this.endLine; line++) {

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

    public static async create(editor: GhostEditor, range: IRange): Promise<GhostSnapshot> {
        const snapshot = await editor.vcs.createSnapshot(range)
        return new GhostSnapshot(editor, snapshot)
    }

    constructor(editor: GhostEditor, snapshot: VCSSnapshotData) {
        this.editor = editor
        this.snapshot = VCSSnapshot.create(editor.vcs, snapshot)

        this.locator = new LineLocator(editor, this.snapshot)

        this.display(true)
    }

    private display(viewZonesOnly: boolean): void {

        const color = this.range.startLineNumber < 30 ? "ghostHighlightRed" : "ghostHighlightGreen"

        this.header    = new GhostSnapshotHeader(this, this.locator, viewZonesOnly)
        this.highlight = new GhostSnapshotHighlight(this, this.locator, color)

        const changeSubscription = this.highlight.onDidChange((event) => {
            const newRange = this.highlight.range
            if (newRange) {
                this.range = newRange
                this.header.update()
                this.highlight.update()
            }
        })

        if (!viewZonesOnly) {
            this.setupHeaderHiding()
        }
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