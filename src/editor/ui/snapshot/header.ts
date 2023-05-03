import { IRange, Editor } from "../../utils/types"
import { GhostEditor } from "../../editor"
import { GhostSnapshot } from "./snapshot"
import { MouseTracker } from "../widgets/mouse-tracker"
import { GhostViewZone } from "../widgets/view-zone"
import { GhostOverlayWidget } from "../widgets/overlay-widget"
import { GhostContentWidget } from "../widgets/content-widget"
import { LineLocator } from "../../utils/line-locator"
import { Slider } from "../components/slider"
import { Range } from "monaco-editor"

export class GhostSnapshotHeader extends MouseTracker {

    protected readonly snapshot: GhostSnapshot
    protected readonly locator: LineLocator
    protected readonly alwaysUseViewZones: boolean

    private readonly domViewZone: HTMLElement
    private readonly domOverlay: HTMLElement

    private readonly viewZone: GhostViewZone
    private readonly overlay: GhostOverlayWidget
    private readonly content: GhostContentWidget

    public get visible(): boolean {
        return this.viewZone.visible || this.content.visible
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

    private get overlayStyle(): CSSStyleDeclaration {
        return this.domOverlay.style
    }

    protected get lineNumber(): number {
        return this.snapshot.startLine
    }

    protected get lineCount(): number {
        return 2
    }

    private get overlayHeight(): number {
        return this.lineCount * this.editor.lineHeight
    }

    protected _contentLocator: LineLocator | undefined = undefined
    protected get contentLocator(): LineLocator {

        if (!this._contentLocator) {
            const parent = this
            return new LineLocator(this.locator.referenceProvider, {
                get range(): IRange {
                    const startLine = parent.locator.range.startLineNumber
                    return new Range(startLine - parent.lineCount, 1, startLine - 1, Number.MAX_SAFE_INTEGER)
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

        const dimsensionSubscriper = this.viewZone.onDimensionsChange((top: number, height: number) => {
            this.updateOverlayDimension(top, height)
        })

        const layoutSubscription = this.core.onDidLayoutChange(event => {
            this.updateContentSize()
        })

        this.show()
    }

    protected setupContent(container: HTMLElement): void {
        container.style.background = 'rgba(50, 50, 255, 0.2)'
        container.innerText = "HEADER WIDGET"
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
        this.overlayStyle.width  = `${this.snapshot.highlightWidth + 2}px`
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
}