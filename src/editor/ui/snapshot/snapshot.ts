import { IRange, MonacoEditor, MonacoModel, LayoutInfo } from "../../utils/types"
import { GhostEditor } from "../views/editor/editor"
import { GhostSnapshotHeader } from "./header"
import { GhostSnapshotHighlight } from "./highlight"
import { GhostSnapshotFooter } from "./footer"
import { RangeProvider, LineLocator } from "../../utils/line-locator"
import { SubscriptionManager } from "../widgets/mouse-tracker"
import { MetaView } from "../views/meta-view"
import { VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockSession, VCSTagInfo } from "../../../app/components/vcs/vcs-rework"
import { VCSSnapshot } from "../../../app/components/data/snapshot"
import { VCSVersion } from "../../../app/components/data/version"
import { throttle } from "../../utils/helpers"

export class GhostSnapshot extends SubscriptionManager implements RangeProvider {

    private readonly color = "ghostHighlightGray"

    public  readonly editor:   GhostEditor
    public           snapshot: VCSSnapshot
    private readonly locator:  LineLocator

    private readonly versions: VCSVersion[]

    public readonly viewZonesOnly: boolean
    public readonly toggleMode:    boolean

    private header: GhostSnapshotHeader
    private highlight: GhostSnapshotHighlight
    private footer: GhostSnapshotFooter

    private readonly sideViewIdentifier = "versionManager"

    public get vcsId():      VCSBlockId { return this.snapshot.blockInfo }
    public get blockId():    string     { return this.snapshot.blockId }
    public get vcsBlockId(): VCSBlockId { return this.session.createChildIdFrom(this.blockId) }

    public get core():  MonacoEditor { return this.editor.core }
    public get model(): MonacoModel  { return this.editor.getTextModel() }

    public get sideView(): MetaView | undefined { return this.editor.sideView }

    public get range():     VCSBlockRange  { return this.snapshot.range }
    public set range(range: VCSBlockRange) { this.snapshot.range = range }

    public get startLine(): number { return this.snapshot.startLine }
    public get endLine():   number { return this.snapshot.endLine }
    public get lineCount(): number { return this.snapshot.lineCount }

    public get layoutInfo():     LayoutInfo { return this.core.getLayoutInfo() }
    public get editorWidth():    number     { return this.layoutInfo.minimap.minimapLeft - this.layoutInfo.contentLeft - 2 } // -2 for style reasons
    public get highlightWidth(): number     { return Math.max(this.defaultHighlightWidth, this.longestLineWidth + 20) }

    private get defaultHighlightWidth(): number { return 0.7 * this.editorWidth }

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

    public get menuVisible(): boolean { return this.header?.visible || this.footer?.visible }
    public get menuActive():  boolean { return this.header?.mouseOn || this.footer?.mouseOn }

    public get session(): VCSBlockSession { return this.editor.getSession() }

    public static async create(editor: GhostEditor, range: VCSBlockRange): Promise<GhostSnapshot | null> {
        const snapshot = await editor.getSession().createChild(range)

        if (!snapshot) { 
            console.warn("Failed to create snapshot!")
            return null
         }

        return new GhostSnapshot(editor, snapshot)
    }

    public constructor(editor: GhostEditor, snapshot: VCSBlockInfo, viewZonesOnly?: boolean, toggleMode?: boolean) {
        super()

        this.editor = editor
        this.viewZonesOnly = viewZonesOnly ? viewZonesOnly : true //TODO: fix positioning of banners when using overlays instead of viewzones
        this.toggleMode    = toggleMode    ? toggleMode    : true

        this.snapshot = new VCSSnapshot(snapshot, this.session)
        this.locator  = new LineLocator(this.editor, this.snapshot)
        this.versions = snapshot.tags.map(tag => new VCSVersion(this, tag))

        this.display()
    }

    private display(): void {
        //this.setupHeader()
        this.highlight = new GhostSnapshotHighlight(this, this.locator, this.color)
        this.setupFooter()

        this.addSubscription(this.highlight.onDidChange((event) => {
            const newRange = this.highlight.range
            if (newRange) {
                this.range = { startLine: newRange.startLineNumber, endLine: newRange.endLineNumber }
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

        // value updating -> TODO: test throttle timer, but this is fucking genius, just saying.
        this.addSubscription(this.footer.onChange(throttle(async value => {
            const newText = await this.session.setChildBlockVersionIndex(this.vcsId, value)
            await this.editor.reload(newText)
        }, 100)))

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

    public addVersion(tag: VCSTagInfo): void {
        this.versions.push(new VCSVersion(this, tag))
    }

    /*
    public updateVersions(tags: VCSTag[]): void {
        this.versions = tags.map(tag => new VCSVersion(this, tag))
        this.updateVersionManager()
    }
    */

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

    public overlapsWith(range: VCSBlockRange): boolean {
        return this.startLine <= range.endLine && this.endLine >= range.startLine
    }

    public async manualUpdate(): Promise<void> {
        await this.update(true)
    }

    public async update(manualUpdate?: boolean): Promise<void> {
        await this.updateFrom({ manualUpdate })
    }

    public async manualUpdateFrom(snapshotData: VCSBlockInfo): Promise<void> {
        await this.updateFrom({ snapshotData, manualUpdate: true })
    }

    public async updateFrom(options?: { snapshotData?: VCSBlockInfo, manualUpdate?: boolean }): Promise<void> {
        await this.snapshot.reload(options?.snapshotData)

        this.header?.update()
        this.highlight?.update()
        this.footer?.update()

        if (!options?.manualUpdate) { this.footer?.updateSlider() }
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

    public async delete(): Promise<void> {
        this.remove()
        await this.session.deleteChild(this.vcsId)
    }
}