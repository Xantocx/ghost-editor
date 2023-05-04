import * as monaco from "monaco-editor"
import { Editor, Disposable, ContentWidget } from "../../utils/types"
import { uuid } from "../../utils/uuid"
import { LineLocator } from "../../utils/line-locator"
import { DomMouseTracker } from "./mouse-tracker"

export class GhostContentWidget extends DomMouseTracker {

    private readonly uuid: string = uuid(16)
    private readonly editor: Editor
    private readonly locator: LineLocator

    private scrollSubscription: Disposable | null = null

    private _visible: boolean = false
    public get visible(): boolean {
        return this._visible
    }

    private set visible(visibility: boolean) {
        this._visible = visibility
    }

    private _widget: ContentWidget
    private get widget(): ContentWidget {

        if (!this._widget) {
            const parent = this
            const loactor = this.locator

            this._widget = {
                getId:       function() { return `${parent.uuid}.content.widget` },
                getDomNode:  function() { return parent.domNode },
                getPosition: function() { 
                    return {
                        position: {
                            lineNumber: loactor.startRendered ? loactor.startLine : loactor.endLine + 1,
                            column: 1,
                        },
                        preference: [
                            loactor.startRendered ? monaco.editor.ContentWidgetPositionPreference.EXACT : monaco.editor.ContentWidgetPositionPreference.ABOVE,
                        ],
                    }
                }
            }
        }

        return this._widget
    }

    constructor(editor: Editor, domNode: HTMLElement, locator: LineLocator) {
        super(domNode)
        this.editor  = editor
        this.locator = locator
    }

    public show(): void {
        if (!this.visible) {
            this.editor.addContentWidget(this.widget)
            this.visible = true

            this.scrollSubscription = this.editor.onDidScrollChange((event) => {
                this.update()
            })
        }
    }

    public hide(): void {
        if (this.visible) {
            this.editor.removeContentWidget(this.widget)
            this.visible = false

            this.scrollSubscription?.dispose()
            this.scrollSubscription = null
        }
    }

    public update(): void {
        if (this.visible) {
            this.editor.layoutContentWidget(this.widget)
        }
    }

    public override remove(): void {
        this.hide()
        super.remove()
    }
}