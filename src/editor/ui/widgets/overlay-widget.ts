import { Editor, OverlayWidget } from "../../utils/types"
import { uuid } from "../../utils/uuid"
import { LineLocator } from "../../utils/line-locator"
import { DomMouseTracker } from "./mouse-tracker"

export class GhostOverlayWidget extends DomMouseTracker {

    private readonly uuid: string = uuid(16)
    private readonly editor: Editor
    private readonly locator: LineLocator

    private _visible: boolean = false
    public get visible(): boolean {
        return this._visible
    }

    private set visible(visibility: boolean) {
        this._visible = visibility
    }

    private _widget: OverlayWidget
    private get widget(): OverlayWidget {

        if (!this._widget) {
            const parent = this

            this._widget = {
                getId:       function() { return `${parent.uuid}.overlay.widget` },
                getDomNode:  function() { return parent.domNode },
                getPosition: function() { return null }
            }
        }

        return this._widget
    }

    constructor(editor: Editor, domNode: HTMLElement,) {
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
}