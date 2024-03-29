import * as monaco from "monaco-editor"
import { MonacoEditor, Disposable, ContentWidget } from "../../../data-types/convenience/monaco"
import uuid from "../../../utils/uuid"
import LineLocator from "../../../utils/line-locator"
import { DomMouseTracker } from "../../../utils/mouse-tracker"

export default class GhostContentWidget extends DomMouseTracker {

    private readonly uuid: string = uuid(16)
    private readonly editor: MonacoEditor
    private readonly locator: LineLocator

    private scrollSubscription: Disposable | null = null

    private _visible = false
    public get visible(): boolean {
        return this._visible
    }

    private set visible(visibility: boolean) {
        this._visible = visibility
    }

    private _widget: ContentWidget
    private get widget(): ContentWidget {

        if (!this._widget) {
            const loactor = this.locator

            this._widget = {
                getId:       () => { return `${this.uuid}.content.widget` },
                getDomNode:  () => { return this.domNode },
                getPosition: () => { 
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

    constructor(editor: MonacoEditor, domNode: HTMLElement, locator: LineLocator) {
        super(domNode)
        this.editor  = editor
        this.locator = locator
    }

    public show(): void {
        if (!this.visible) {
            this.editor.addContentWidget(this.widget)
            this.visible = true

            this.scrollSubscription = this.editor.onDidScrollChange(() => {
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