import * as monaco from "monaco-editor"
import { MonacoEditor, ViewZone, Disposable } from "../../../data-types/convenience/monaco"
import { DomMouseTracker } from "../../../utils/mouse-tracker"

export default class GhostViewZone extends DomMouseTracker {

    private id: string | null = null
    private readonly editor: MonacoEditor

    private readonly lineNumber: () => number
    private readonly lineCount:  () => number

    private top    = 0
    private height = 0

    private dimensionsSubscribers: {(top: number, height: number): void}[] = []

    private _visible = false
    public get visible(): boolean {
        return this._visible
    }

    private set visible(visibility: boolean) {
        this._visible = visibility
    }

    private get zone(): ViewZone {
        return {
            afterLineNumber: this.lineNumber() - 1,
            heightInLines: this.lineCount(),
            domNode: this.domNode,
            onDomNodeTop:     (top)    => { this.top    = top;    this.updateDimensions(); },
            onComputedHeight: (height) => { this.height = height; this.updateDimensions(); },
        };
    }

    constructor(editor: MonacoEditor, domNode: HTMLElement, lineNumber: () => number, lineCount: () => number) {
        super(domNode)

        this.editor  = editor
        this.lineNumber = lineNumber
        this.lineCount = lineCount
    }

    private updateDimensions(): void {
        this.dimensionsSubscribers.forEach(callback => {
            callback(this.top, this.height)
        })
    }

    public show(): void {
        if (!this.visible) {
            this.editor.changeViewZones(accessor => {
                this.id = accessor.addZone(this.zone)
            })
            this.visible = true
        }
    }

    public hide(): void {
        if (this.visible) {
            this.editor.changeViewZones(accessor => {
                if (this.id) { accessor.removeZone(this.id) }
            })
            this.visible = false
        }
    }

    public batchHide(accessor: monaco.editor.IViewZoneChangeAccessor): void {
        if (this.visible) {
            if (this.id) { accessor.removeZone(this.id) }
            this.visible = false
        }
    }

    public update(): void {
        if (this.visible) {
            this.editor.changeViewZones(accessor => {
                if (this.id) { accessor.removeZone(this.id) }
                this.id = accessor.addZone(this.zone);
            })
        }
    }

    public onDimensionsChange(callback: (top: number, height: number) => void): Disposable {
        callback(this.top, this.height)
        this.dimensionsSubscribers.push(callback)
        return this.addSubscription({
            dispose: () => {
                const index = this.dimensionsSubscribers.indexOf(callback)
                if (index > -1) { this.dimensionsSubscribers.splice(index, 1) }
            }
        })
    }

    public remove(): void {
        this.hide()
        super.remove()
    }
}