import { IRange, Editor, Model, LayoutInfo, Disposable } from "../../utils/types"
import { GhostEditor } from "../../editor"
import { GhostSnapshotHeader } from "./header"
import { GhostSnapshotHighlight } from "./highlight"
import { GhostSnapshotFooter } from "./footer"
import { RangeProvider, LineLocator } from "../../utils/line-locator"
import { VCSSnapshotData, VCSSnapshot } from "../../../app/components/data/snapshot"
import { SnapshotUUID } from "../../../app/components/vcs/vcs-provider"
import { SubscriptionManager } from "../widgets/mouse-tracker"

export class GhostSnapshot extends SubscriptionManager implements RangeProvider {

    public readonly editor: GhostEditor
    public snapshot: VCSSnapshot
    private locator: LineLocator

    public readonly viewZonesOnly: boolean

    private header: GhostSnapshotHeader
    private highlight: GhostSnapshotHighlight
    private footer: GhostSnapshotFooter

    public get uuid(): SnapshotUUID {
        return this.snapshot.uuid
    }

    public get core(): Editor {
        return this.editor.core
    }

    public get model(): Model {
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
        const spaceWidth = this.editor.spaceWidth
        const characterWidth = this.editor.characterWidth

        for (let line = this.startLine; line <= this.endLine; line++) {

            // what a pain...
            const content = model.getLineContent(line)
            const tabCount = content.split("\t").length - 1
            const tabLength = tabCount * tabSize * spaceWidth
            const contentLength = (content.length - tabCount) * characterWidth
            const lineLength = contentLength + tabLength

            longestLine = Math.max(longestLine, lineLength)
        }

        return longestLine
    }

    private get defaultHighlightWidth(): number {
        return 0.7 * this.editorWidth
    }

    public get highlightWidth(): number {
        return Math.max(this.defaultHighlightWidth, this.longestLineWidth + 20)
    }

    public static async create(editor: GhostEditor, range: IRange): Promise<GhostSnapshot | null> {
        const snapshot = await editor.vcs.createSnapshot(range)

        if (!snapshot) { 
            console.warn("Failed to create snapshot!")
            return null
         }

        return new GhostSnapshot(editor, snapshot)
    }

    constructor(editor: GhostEditor, snapshot: VCSSnapshotData, viewZonesOnly?: boolean) {
        super()

        this.editor = editor
        this.viewZonesOnly = viewZonesOnly ? viewZonesOnly : true

        this.load(snapshot)
    }

    public async update(): Promise<void> {
        const snapshot = await this.editor.vcs.getSnapshot(this.uuid)
        this.load(snapshot)
    }

    public load(snapshot: VCSSnapshotData): void {
        this.snapshot = VCSSnapshot.create(this.editor.vcs, snapshot)
        this.locator = new LineLocator(this.editor, this.snapshot)
        this.display()
    }

    private display(): void {

        this.remove()

        const color = this.range.startLineNumber < 30 ? "ghostHighlightRed" : "ghostHighlightGreen"

        this.header    = new GhostSnapshotHeader(this, this.locator, this.viewZonesOnly)
        this.highlight = new GhostSnapshotHighlight(this, this.locator, color)
        this.footer    = new GhostSnapshotFooter(this, this.locator, this.viewZonesOnly)

        this.addSubscription(this.highlight.onDidChange((event) => {
            const newRange = this.highlight.range
            if (newRange) {
                this.range = newRange
                this.header.update()
                this.highlight.update()
                this.footer.update()
            }
        }))

        this.addSubscription(this.footer.onChange(async value => {
            const newText = await this.editor.vcs.applySnapshotVersionIndex(this.uuid, value)
            this.editor.update(newText)
        }))

        if (!this.viewZonesOnly) {
            this.setupHeaderHiding()
        }
    }

    private setupHeaderHiding(): void {
        this.addSubscription(this.header.onMouseEnter((mouseOn: boolean) => {
            if (!mouseOn && !this.highlight.mouseOn) {
                this.header.hide()
            }
        }))
        this.addSubscription(this.footer.onMouseEnter((mouseOn: boolean) => {
            if (!mouseOn && !this.highlight.mouseOn) {
                this.footer.hide()
            }
        }))
        this.addSubscription(this.highlight.onMouseEnter((mouseOn: boolean) => {
            if (mouseOn) {
                this.header.show()
                this.footer.show()
            } else {
                if(!this.header.mouseOn) { this.header.hide() }
                if(!this.footer.mouseOn) { this.footer.hide() }
            }
        }))
    }

    public override remove(): void {
        super.remove()
        this.header?.remove()
        this.highlight?.remove()
        this.footer?.remove()
    }
}