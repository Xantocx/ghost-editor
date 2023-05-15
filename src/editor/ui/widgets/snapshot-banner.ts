import { IRange, Editor } from "../../utils/types"
import { GhostEditor } from "../../editor"
import { GhostSnapshot } from "../snapshot/snapshot"
import { MouseTracker } from "../widgets/mouse-tracker"
import { GhostViewZone } from "../widgets/view-zone"
import { GhostOverlayWidget } from "../widgets/overlay-widget"
import { GhostContentWidget } from "../widgets/content-widget"
import { LineLocator } from "../../utils/line-locator"

export class GhostSnapshotBanner extends MouseTracker {

    protected readonly snapshot: GhostSnapshot
    protected readonly locator: LineLocator
    protected alwaysUseViewZones: boolean

    private readonly domViewZone: HTMLElement
    private readonly domOverlay: HTMLElement

    private readonly viewZone: GhostViewZone
    private readonly overlay: GhostOverlayWidget
    private readonly content: GhostContentWidget

    public get visible(): boolean {
        return this.viewZone.visible || this.content.visible
    }

    public get protected(): boolean {
        return this.mouseOn
    }

    protected get lineNumber(): number {
        return this.snapshot.startLine
    }

    protected get lineCount(): number {
        return this.snapshot.endLine - this.snapshot.startLine + 1
    }

    protected contentRange(): IRange {
        return this.locator.range
    }

    private get editor(): GhostEditor {
        return this.snapshot.editor
    }

    private get core(): Editor {
        return this.snapshot.core
    }

    private get viewZoneMode(): boolean {
        return this.alwaysUseViewZones || this.snapshot.startLine <= this.lineCount
    }

    private get displayModeMismatch(): boolean {
        const wrongContentDisplay = this.viewZoneMode  && this.content.visible
        const wrongOverlayDisplay = !this.viewZoneMode && this.viewZone.visible
        return wrongContentDisplay || wrongOverlayDisplay
    }

    public get overlayStyle(): CSSStyleDeclaration {
        return this.domOverlay.style
    }

    public get overlayWidth(): number {
        return parseFloat(this.overlayStyle.width)
    }

    private get overlayHeight(): number {
        return this.lineCount * this.editor.lineHeight
    }

    private _contentLocator: LineLocator | undefined = undefined
    private get contentLocator(): LineLocator {

        if (!this._contentLocator) {
            const parent = this
            this._contentLocator = new LineLocator(this.locator.referenceProvider, {
                get range(): IRange {
                    return parent.contentRange()
                }
            })
        }

        return this._contentLocator
    }

    constructor(snapshot: GhostSnapshot, locator: LineLocator, alwaysUseViewZones: boolean) {
        super()

        this.snapshot = snapshot
        this.locator = locator
        this.alwaysUseViewZones = alwaysUseViewZones

        this.domViewZone = document.createElement('div')
        this.viewZone = new GhostViewZone(this.core, this.domViewZone, () => { return this.lineNumber }, () => { return this.lineCount })
        
        this.domOverlay = document.createElement('div');
        this.setupContent(this.domOverlay)

        this.overlay = new GhostOverlayWidget(this.core, this.domOverlay)
        this.content = new GhostContentWidget(this.core, this.domOverlay, this.contentLocator)

        this.setupMouseTracking()

        this.addSubscription(this.viewZone.onDimensionsChange((top: number, height: number) => {
            this.updateOverlayDimension(top, height)
        }))

        this.addSubscription(this.core.onDidLayoutChange(event => {
            this.updateContentSize()
        }))

        this.show()
    }

    protected setupContent(container: HTMLElement): void {
        container.style.background = 'rgba(50, 50, 255, 0.2)'
        container.innerText = "TEST BANNER WIDGET"
    }

    private setupMouseTracking() {
        this.overlay.onMouseEnter(mouseOn => {
            this.mouseChanged(mouseOn)
        })
        this.content.onMouseEnter(mouseOn => {
            this.mouseChanged(mouseOn)
        })
    }

    private updateOverlayPosition(top: number): void {
        this.overlayStyle.top    = `${top}px`
        this.overlayStyle.left   = `${this.snapshot.layoutInfo.contentLeft}px`
    }

    private updateOverlaySize(height: number): void {
        this.overlayStyle.height = `${height}px`
        this.overlayStyle.width  = `${this.snapshot.highlightWidth}px`
    }

    private updateOverlayDimension(top: number, height: number): void {
        this.updateOverlayPosition(top)
        this.updateOverlaySize(height)
    }

    private updateContentSize() {
        if (!this.viewZoneMode) {
            this.updateOverlaySize(this.overlayHeight)
        }
    }

    public show(): void {
        if (!this.visible) {
            if (this.viewZoneMode) {
                this.viewZone.show()
                this.overlay.show()
            } else {
                this.updateContentSize()
                this.content.show()
            }
        }
    }

    public hide(): void {
        if (this.visible) {
            this.overlay.hide()
            this.viewZone.hide()
            this.content.hide()
        }
    }

    public update(): void {
        if (this.visible) {
            this.viewZone.update()
            this.overlay.update()
            this.content.update()

            this.updateContentSize()

            if (this.displayModeMismatch) {
                this.hide()
                this.show()
            }
        }
    }

    public removeIssued: boolean = false
    private removeCallbacks: {(): void}[] = []
    public protectedRemove(callback?: () => void): void {

        if (callback) { this.removeCallbacks.push(callback) }
        if (this.removeIssued) { return }

        this.removeIssued = true

        if (this.protected) {
            this.onMouseEnter(mouseOn => {
                if (!this.protected) {
                    this.remove()
                }
            })
        } else {
            this.remove()
        }
    }

    public override remove(): void {
        this.overlay.remove()
        this.viewZone.remove()
        this.content.remove()

        this.domOverlay.remove()
        this.domViewZone.remove()

        super.remove()

        this.removeCallbacks.forEach(callback => { callback() })
        this.removeCallbacks = []
        this.removeIssued = false
    }
}