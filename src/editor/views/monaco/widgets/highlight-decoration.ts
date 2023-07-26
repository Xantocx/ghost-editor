import * as monaco from "monaco-editor"
import { MonacoEditor, Decoration, Decorations, DecorationsChangedEvent, Disposable, Range } from "../../../data-types/convenience/monaco"
import uuid from "../../../utils/uuid"
import LineLocator from "../../../utils/line-locator"
import { MouseTracker } from "../../../utils/mouse-tracker"

export default class GhostHighlightDecoration extends MouseTracker {

    private static _styleSheet: CSSStyleSheet | undefined = undefined
    private static get styleSheet(): CSSStyleSheet {
        if (!this._styleSheet) {
            const customStyle = document.createElement("style")
            document.head.appendChild(customStyle) // must append before you can access sheet property
            this._styleSheet = customStyle.sheet
        }

        return this._styleSheet
    }

    private static addCssClass(className: string, rules: string): number {
        const index = this.styleSheet.cssRules.length
        this.styleSheet.insertRule(`.${className} { ${rules} }`, index)
        return index
    }

    private static deleteCssClass(index: number): void {
        this.styleSheet.deleteRule(index)
    }

    private readonly uuid: string = uuid(16)
    private readonly editor: MonacoEditor
    private readonly locator: LineLocator
    private readonly color: string
    private readonly cssRuleIndex: number

    private readonly decorations: Decorations
    private mouseSubscription: Disposable | null = null

    private _visible = false
    public get visible(): boolean {
        return this._visible
    }

    private set visible(visibility: boolean) {
        this._visible = visibility
    }

    public get range(): Range | undefined {
        return this.decorations?.getRanges()[1]
    }

    private get decoration(): Decoration[] {

        const locator = this.locator

        return [
            {
                range: locator.range.collapseToStart(),
                options: {
                    isWholeLine: true,
                    className: `ghostHighlightTop ${this.uuid}`,
                    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                },
            },
            {
                range: locator.range,
                options: {
                    isWholeLine: true,
                    className: `ghostHighlightMid ${this.color} ${this.uuid}`,
                    stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
                },
            },
            {
                range: locator.range.collapseToEnd(),
                options: {
                    isWholeLine: true,
                    className: `ghostHighlightBottom ${this.uuid}`,
                    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                },
            },
        ]
    }

    private get cssRule(): CSSStyleRule | undefined {
        const rule = GhostHighlightDecoration.styleSheet.cssRules[this.cssRuleIndex]
        return rule instanceof CSSStyleRule ? rule : undefined
    }

    private get style(): CSSStyleDeclaration | undefined {
        return this.cssRule?.style
    }

    constructor(editor: MonacoEditor, locator: LineLocator, color: string) {
        super()

        this.editor  = editor
        this.locator = locator
        this.color   = color
        this.cssRuleIndex = GhostHighlightDecoration.addCssClass(this.uuid, "min-width: 800; max-width: 800;")

        this.decorations = this.editor.createDecorationsCollection()
    }

    private setupMouseTracking(): void {
        this.mouseSubscription = this.editor.onMouseMove((event) => {

            const mousePos = event.target.position;

            if (mousePos) {
                const decorationOptions = this.editor.getLineDecorations(mousePos.lineNumber);
                if (decorationOptions?.find(decoration => this.decorations.has(decoration))) {
                    if (!this.mouseOn) {
                        this.mouseChanged(true)
                    }
                    return
                }
            }
            
            if (this.mouseOn) {
                this.mouseChanged(false)
            }
        })
    }

    public show(): void {
        if (!this.visible) {
            this.decorations.set(this.decoration);
            this.setupMouseTracking()
            this.visible = true
        }
    }

    public hide(): void {
        if (this.visible) {

            this.decorations.clear()
            this.mouseSubscription?.dispose()
            this.mouseSubscription = null

            this.visible = false
        }
    }

    public update(): void {
        if (this.visible) {
            this.decorations.set(this.decoration)
        }
    }

    public customizeStyle(updateStyle: (style: CSSStyleDeclaration) => void): void {
        if (this.style) {
            updateStyle(this.style)
        }
    }

    public setWidth(width: number): void {
        if (this.style) {
            this.style.maxWidth = `${width}px`
        }
    }
    
    public onDidChange(callback: (event: DecorationsChangedEvent) => void): Disposable {
        const subscription = this.decorations.onDidChange(callback)
        return this.addSubscription(subscription)
    }

    public override remove(): void {
        this.hide()
        super.remove()
    }
}