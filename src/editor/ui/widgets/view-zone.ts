import * as monaco from "monaco-editor"
import { MonacoEditor, ViewZone, Disposable } from "../../utils/types"
import { DomMouseTracker } from "./mouse-tracker"

export class GhostViewZone extends DomMouseTracker {

    private id: string | null = null
    private readonly editor: MonacoEditor

    private readonly lineNumber: () => number
    private readonly lineCount:  () => number

    private top:    number = 0
    private height: number = 0

    private dimensionsSubscribers: {(top: number, height: number): void}[] = []

    private _visible: boolean = false
    public get visible(): boolean {
        return this._visible
    }

    private set visible(visibility: boolean) {
        this._visible = visibility
    }

    private get zone(): ViewZone {

        const parent = this

        return {
            afterLineNumber: parent.lineNumber() - 1,
            heightInLines: parent.lineCount(),
            domNode: parent.domNode,
            onDomNodeTop:     (top)    => { parent.top    = top;    parent.updateDimensions(); },
            onComputedHeight: (height) => { parent.height = height; parent.updateDimensions(); },
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