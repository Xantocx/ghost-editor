import { IRange, MonacoEditor, MonacoModel, LayoutInfo } from "../../utils/types"
import { GhostEditor } from "../views/editor/editor"
import { GhostSnapshotHeader } from "./header"
import { GhostSnapshotHighlight } from "./highlight"
import { GhostSnapshotFooter } from "./footer"
import { RangeProvider, LineLocator } from "../../utils/line-locator"
import { VCSSnapshotData, VCSSnapshot, VCSVersion } from "../../../app/components/data/snapshot"
import { SnapshotUUID, VCSSession } from "../../../app/components/vcs/vcs-provider"
import { SubscriptionManager } from "../widgets/mouse-tracker"
import { MetaView } from "../views/meta-view"

export class GhostSnapshot extends SubscriptionManager implements RangeProvider {

    private readonly color = "ghostHighlightGray"

    public readonly editor: GhostEditor
    public snapshot: VCSSnapshot
    private readonly locator: LineLocator

    public readonly viewZonesOnly: boolean
    public readonly toggleMode: boolean

    private header: GhostSnapshotHeader
    private highlight: GhostSnapshotHighlight
    private footer: GhostSnapshotFooter

    private readonly sideViewIdentifier = "versionManager"
    public  versions: VCSVersion[] = []

    public get uuid(): SnapshotUUID {
        return this.snapshot.uuid
    }

    public get core(): MonacoEditor {
        return this.editor.core
    }

    public get model(): MonacoModel {
        return this.editor.getTextModel()
    }

    public get sideView(): MetaView | undefined {
        return this.editor.sideView
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
        return this.layoutInfo.minimap.minimapLeft - this.layoutInfo.contentLeft - 2 // -2 for style reasons
    }

    public get longestLineWidth(): number {

        let longestLine = 0

        const model = this.model
        const tabSize = this.editor.tabSize
        const spaceWidth = this.editor.spaceWidth
        const characterWidth = this.editor.characterWidth

        for (let line = this.startLine; line <= this.endLine; line++) {

            let lineLength: number = 0

            try {
                // what a pain...
                const content = model.getLineContent(line)
                const tabCount = content.split("\t").length - 1
                const tabLength = tabCount * tabSize * spaceWidth
                const contentLength = (content.length - tabCount) * characterWidth
                lineLength = contentLength + tabLength
            } catch {
                // This may fail if the snapshot got text is already updated to be shorter than the snapshot, or if the snapshot is updated to be longer than the text.
                // Unfortunately, I cannot really prevent that, as setting the text will always immediately trigger a resizing. I could maybe pause the resizing then, but
                // just ignoring the error and defaulting to length 0 for the missing line works just as well without complex modifications of the code in terms of updates.
                // TODO: For the future, a proper system to avoid this error would be nice.
            }

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

    public get menuVisible(): boolean {
        return this.header?.visible || this.footer?.visible
    }

    public get menuActive(): boolean {
        return this.header?.mouseOn || this.footer?.mouseOn
    }

    public static async create(editor: GhostEditor, range: IRange): Promise<GhostSnapshot | null> {
        const snapshot = await editor.getSession().createSnapshot(range)

        if (!snapshot) { 
            console.warn("Failed to create snapshot!")
            return null
         }

        return new GhostSnapshot(editor, snapshot)
    }

    public get session(): VCSSession { return this.editor.getSession() }

    constructor(editor: GhostEditor, snapshot: VCSSnapshotData, viewZonesOnly?: boolean, toggleMode?: boolean) {
        super()

        this.editor = editor
        this.viewZonesOnly = viewZonesOnly ? viewZonesOnly : true //TODO: fix positioning of banners when using overlays instead of viewzones
        this.toggleMode    = toggleMode    ? toggleMode    : true

        this.snapshot = VCSSnapshot.create(this.session, snapshot)
        this.locator = new LineLocator(this.editor, this.snapshot)

        this.display()
    }

    private display(): void {
        //this.setupHeader()
        this.highlight = new GhostSnapshotHighlight(this, this.locator, this.color)
        this.setupFooter()

        this.addSubscription(this.highlight.onDidChange((event) => {
            const newRange = this.highlight.range
            if (newRange) {
                this.range = newRange
                this.header?.update()
                this.highlight.update()
                this.footer?.update()
            }
        }))
    }

    private setupHeader(): void {

        this.header = new GhostSnapshotHeader(this, this.locator, this.viewZonesOnly)

        if (!this.viewZonesOnly && !this.toggleMode) {
            this.addSubscription(this.header.onMouseEnter((mouseOn: boolean) => {
                if (!mouseOn && !this.highlight.mouseOn) {
                    this.header.hide()
                }
            }))
            this.addSubscription(this.highlight.onMouseEnter((mouseOn: boolean) => {
                if (mouseOn) {
                    this.header.show()
                } else {
                    if(!this.header.mouseOn) { this.header.hide() }
                }
            }))
        }
    }

    private setupFooter(): void {

        this.footer = new GhostSnapshotFooter(this, this.locator, this.viewZonesOnly)

        // value updating
        this.addSubscription(this.footer.onChange(async value => {
            const newText = await this.session.applySnapshotVersionIndex(this.uuid, value)
            this.editor.update(newText)
        }))

        // footer hiding
        if (this.toggleMode) {
            this.addSubscription(this.footer.onMouseEnter((mouseOn: boolean) => {
                if (!mouseOn && !this.highlight?.mouseOn && !this.editor.selectedSnapshots.includes(this)) {
                    this.footer.hide()
                }
            }))
        } else {
            this.addSubscription(this.footer.onMouseEnter((mouseOn: boolean) => {
                if (!mouseOn && !this.highlight?.mouseOn) {
                    this.footer.hide()
                }
            }))
            this.addSubscription(this.highlight.onMouseEnter((mouseOn: boolean) => {
                if (mouseOn) {
                    this.footer.show()
                } else {
                    if(!this.footer.mouseOn) { this.footer.hide() }
                }
            }))
        }
    }

    public showVersionManager(): void {
        this.sideView?.showView(this.sideViewIdentifier)
        this.updateVersionManager()
    }

    public hideVersionManager(): void {
        this.editor.showDefaultSideView()
    }

    public updateVersionManager(): void {
        this.sideView?.update(this.sideViewIdentifier, { versions: this.versions })
    }

    public updateVersions(versions: VCSVersion[]): void {
        this.versions = versions
        this.updateVersionManager()
    }

    /*
    public protectedRemove(callback?: () => void): void {
        if (this.footerProtected) {
            super.remove()
            this.header.remove()
            this.highlight.remove()
            this.footer.protectedRemove(callback)
        } else {
            this.remove()
            if (callback) { callback() }
        }
    }
    */

    public containsLine(lineNumber: number): boolean {
        return this.startLine <= lineNumber && this.endLine >= lineNumber
    }

    public overlapsWith(range: IRange): boolean {
        return this.startLine <= range.endLineNumber && this.endLine >= range.startLineNumber
    }

    public manualUpdate(): void {
        this.update(true)
    }

    public async update(manualUpdate?: boolean): Promise<void> {
        const snapshot = await this.session.getSnapshot(this.uuid)
        
        this.snapshot = VCSSnapshot.create(this.session, snapshot)
        this.locator.rangeProvider = this.snapshot

        this.header?.update()
        this.highlight?.update()
        this.footer?.update()

        if (!manualUpdate) { this.footer?.updateSlider() }
    }

    public showMenu(): void {
        this.header?.show()
        this.footer?.show()
        //this.showVersionsView()
    }

    public hideMenu(): void {
        this.editor.core.changeViewZones(accessor => {
            this.header?.batchHide(accessor)
            this.footer?.batchHide(accessor)
        })

        //this.hideVersionsView()
    }

    public toggleMenu(): void {
        if (this.menuVisible) {
            this.hideMenu()
        } else {
            this.showMenu()
        }
    }

    public override remove(): void {
        super.remove()
        this.header?.remove()
        this.highlight?.remove()
        this.footer?.remove()
    }

    public delete(): void {
        this.remove()
        this.session.deleteSnapshot(this.uuid)
    }
}