import { MonacoEditor, OverlayWidget } from "../../../data-types/convenience/monaco"
import uuid from "../../../utils/uuid"
import { DomMouseTracker } from "../../../utils/mouse-tracker"

export default class GhostOverlayWidget extends DomMouseTracker {

    private readonly uuid: string = uuid(16)
    private readonly editor: MonacoEditor

    private _visible = false
    public get visible(): boolean {
        return this._visible
    }

    private set visible(visibility: boolean) {
        this._visible = visibility
    }

    private _widget: OverlayWidget
    private get widget(): OverlayWidget {

        if (!this._widget) {
            this._widget = {
                getId:       () => { return `${this.uuid}.overlay.widget` },
                getDomNode:  () => { return this.domNode },
                getPosition: () => { return null }
            }
        }

        return this._widget
    }

    constructor(editor: MonacoEditor, domNode: HTMLElement,) {
        super(domNode)
        this.editor  = editor
    }

    public show(): void {
        if (!this.visible) {
            this.editor.addOverlayWidget(this.widget)
            this.visible = true
        }
    }

    public hide(): void {
        if (this.visible) {
            this.editor.removeOverlayWidget(this.widget)
            this.visible = false
        }
    }

    public update(): void {
        if (this.visible) {
            this.editor.layoutOverlayWidget(this.widget)
        }
    }

    public override remove(): void {
        this.hide()
        super.remove()
    }
}