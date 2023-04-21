import { IRange, Editor } from "../../utils/types"
import { GhostEditor } from "../../editor"
import { GhostSnapshot } from "./snapshot"
import { MouseTracker } from "../basic/mouse-tracker"
import { GhostViewZone } from "../basic/view-zone"
import { GhostOverlayWidget } from "../basic/overlay-widget"
import { GhostContentWidget } from "../basic/content-widget"
import { LineLocator } from "../../utils/line-locator"

export class GhostSnapshotHeader extends MouseTracker {

    private readonly snapshot: GhostSnapshot
    private readonly locator: LineLocator
    private readonly alwaysUseViewZones: boolean

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

    private get lineNumber(): number {
        return this.snapshot.startLine
    }

    private get lineCount(): number {
        return 2
    }

    private get overlayHeight(): number {
        return this.lineCount * this.editor.lineHeight
    }

    private _contentLocator: LineLocator | undefined = undefined
    private get contentLocator(): LineLocator {

        if (!this._contentLocator) {
            const parent = this
            return new LineLocator(this.locator.reference, {
                get range(): IRange {
                    return parent.locator.range.delta(-parent.lineCount)
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
        this.domOverlay.innerHTML = 'My overlay widget';
        this.domOverlay.style.background = 'rgba(50, 50, 255, 0.2)';

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