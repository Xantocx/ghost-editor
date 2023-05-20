import { VCSVersion } from "../../../app/components/data/snapshot"
import { Disposable } from "../../utils/types"
import { P5JSPreview, SizeConstraints } from "../views/previews/p5js-preview"
import { SubscriptionManager } from "../widgets/mouse-tracker"

export class Button extends SubscriptionManager {

    public static defaultButton(root: HTMLElement, text: string, onClick?: (button: Button) => void): Button {
        return new TextButton(root, text, onClick)
    }

    public static basicButton(root: HTMLElement, text: string, onClick?: (button: Button) => void): Button {
        const button = this.defaultButton(root, text, onClick)

        button.style.backgroundColor = "blue"
        button.style.color = "white"
        button.style.padding = '7px 20px'

        return button
    }

    public static addButton(root: HTMLElement, onClick?: (button: Button) => void): Button {
        const button = this.defaultButton(root, "+", onClick)

        button.style.backgroundColor = "green"
        button.style.color = "white"
        button.style.padding = "5px 10px"
        button.style.margin = "5px"

        return button
    }

    public static fullFieldButton(root: HTMLElement, text: string, onClick?: (button: Button) => void): Button {
        const button = this.defaultButton(root, text, onClick)

        button.style.height = "100%"
        button.style.fontSize = "22px"
        button.style.backgroundColor = "white"
        button.style.color = "black"
        button.style.borderRadius = "0"

        return button
    }

    public static versionButton(root: HTMLElement, version: VCSVersion, sizeConstraints?: SizeConstraints, onClick?: (button: Button) => void): Button {
        return new VersionButton(root, version, sizeConstraints, onClick)
    }

    public static p5jsPreviewButton(root: HTMLElement, version: VCSVersion, sizeConstraints?: SizeConstraints, onClick?: (button: Button) => void): Button {
        return new P5JSPreviewButton(root, version, sizeConstraints, onClick)
    }

    public static p5jsPreviewToggleButton(root: HTMLElement, version: VCSVersion, sizeConstraints?: SizeConstraints, onSelect?: (version: VCSVersion, selected: boolean) => void): Button {
        return new P5JSPreviewToggleButton (root, version, undefined, sizeConstraints, onSelect)
    }

    public static versionPreviewButton(root: HTMLElement, version: VCSVersion, sizeConstraints?: SizeConstraints, onClick?: (button: Button) => void): Button {
        if (version.text.includes("setup") && version.text.includes("draw")) {
            return this.p5jsPreviewButton(root, version, sizeConstraints, onClick)
        } else {
            return this.versionButton(root, version, sizeConstraints, onClick)
        }
    }

    public readonly root: HTMLElement
    public readonly button: HTMLButtonElement

    protected onClickCallbacks: {(button: Button): void}[] = []

    public get style(): CSSStyleDeclaration {
        return this.button.style
    }

    constructor(root: HTMLElement, onClick?: (button: Button) => void) {
        super()

        this.root = root
        this.button = document.createElement("button")

        // default config
        this.style.display = "inline-block"
        this.style.border = "none"
        this.style.borderRadius = "8px"
        this.style.textAlign = "center"
        this.style.textDecoration = "none"
        this.style.fontSize = '14px'
        this.style.cursor = "pointer"

        this.button.onclick = () => { this.onClickCallbacks.forEach(callback => callback(this)) }
        if (onClick) { this.onClick(onClick) }

        this.root.appendChild(this.button)
    }

    public onClick(callback: (button: Button) => void): Disposable {
        this.onClickCallbacks.push(callback)

        const parent = this

        return this.addSubscription({
            dispose() {
                const index = parent.onClickCallbacks.indexOf(callback, 0)
                if (index > -1) { parent.onClickCallbacks.splice(index, 1) }
            }
        })
    }

    public override remove(): void {
        this.button.remove()
        super.remove()
    }
}


export class TextButton extends Button {

    public get text(): string {
        return this.button.textContent ? this.button.textContent : ""
    }

    public set text(text: string) {
        this.button.textContent = text
    }

    constructor(root: HTMLElement, text: string, onClick?: (button: Button) => void) {
        super(root, onClick)
        this.text = text
    }
}

export class VersionButton extends TextButton {

    private readonly sizeConstraints?: SizeConstraints

    private get maxWidth(): number {
        return this.sizeConstraints?.maxWidth ? this.sizeConstraints?.maxWidth : 350
    }

    private get maxHeight(): number {
        return this.sizeConstraints?.maxHeight ? this.sizeConstraints?.maxHeight : 150
    }

    private get padding(): number {
        return this.sizeConstraints?.padding ? this.sizeConstraints?.padding : 0
    }

    constructor(root: HTMLElement, version: VCSVersion, sizeConstraints?: SizeConstraints, onClick?: (button: Button) => void) {
        super(root, version.name, onClick)
        this.sizeConstraints = sizeConstraints

        this.style.display = "inline-block"
        this.style.maxWidth = `${this.maxWidth}px`
        this.style.height = `${this.maxHeight}px`
        this.style.padding = `${this.padding}px ${this.padding}px`
        this.style.margin = "0 0"

        this.style.backgroundColor = version.automaticSuggestion ? "gray" : "blue"
        this.style.border = "none"
        this.style.borderRadius = "8px"
        this.style.cursor = "pointer"

        this.style.color = "white"
        this.style.textAlign = "center"
        this.style.textDecoration = "none"
        this.style.wordWrap = "break-word"
        this.style.overflowWrap = "break-word"
        this.style.fontSize = '14px'
    }
}


export class P5JSPreviewButton extends Button {

    public readonly version: VCSVersion
    private readonly preview: P5JSPreview

    private readonly sizeConstraints?: SizeConstraints
    private readonly previewSize: number = 0.7
    private readonly namePadding = 5

    private get maxWidth(): number {
        return this.sizeConstraints?.maxWidth ? this.sizeConstraints?.maxWidth : 350
    }

    private get maxHeight(): number {
        return this.sizeConstraints?.maxHeight ? this.sizeConstraints?.maxHeight : 150
    }

    constructor(root: HTMLElement, version: VCSVersion, sizeConstraints?: SizeConstraints, onClick?: (button: Button) => void) {
        super(root, onClick)
        this.version = version
        this.sizeConstraints = sizeConstraints

        this.style.display = "inline-flex"
        this.style.overflow = "hidden"
        this.style.maxWidth = `${this.maxWidth}px`
        this.style.maxHeight = `${this.maxHeight}px`
        this.style.padding = "0 0"
        this.style.margin = "0 0"
        this.style.backgroundColor = version.automaticSuggestion ? "gray" : "blue"
        this.style.border = "none"
        this.style.borderRadius = "8px"
        this.style.cursor = "pointer"

        const name = document.createElement("div")
        name.textContent = version.name
        name.style.display = "block"
        name.style.alignSelf = "center"
        name.style.maxWidth = `${(1 - this.previewSize) * this.maxWidth}px`
        name.style.padding = `${this.namePadding}px ${this.namePadding}px`
        name.style.margin = "0 0"
        name.style.color = "white"
        name.style.textAlign = "center"
        name.style.textDecoration = "none"
        name.style.wordWrap = "break-word"
        name.style.overflowWrap = "break-word"
        name.style.fontSize = '14px'
        this.button.appendChild(name)

        const previewContainer = document.createElement("div")
        previewContainer.style.width = `${this.previewSize * this.maxWidth}px`
        previewContainer.style.height = "100%"
        previewContainer.style.padding = "0 0"
        previewContainer.style.margin = "0 0"
        this.button.appendChild(previewContainer)

        this.preview = new P5JSPreview(previewContainer, 
                                       version.text, 
                                       { 
                                         minWidth: this.sizeConstraints?.minWidth,
                                         minHeight: this.sizeConstraints?.minHeight, 
                                         maxHeight: this.maxHeight, 
                                         padding: this.sizeConstraints?.padding 
                                       }, 
                                       "white")

        this.preview.onResize((width, height, scaleFactor) => {
            // give up rest of maximum width for name (always >= 25%)
            name.style.maxWidth = `${this.maxWidth - width - 2 * this.namePadding}px`
        })
    }

    public override remove(): void {
        this.preview.remove()
        super.remove()
    }
}


export class P5JSPreviewToggleButton extends P5JSPreviewButton {

    private readonly colors?: {selected?: string, default?: string}

    private get selectedColor(): string {
        return this.colors?.selected ? this.colors.selected : "green"
    }

    private get defaultColor(): string {
        return this.colors?.default ? this.colors.default : "gray"
    }

    private _selected: boolean
    private get selected(): boolean { return this._selected }
    private set selected(selected: boolean) { 
        this._selected = selected
        this.style.backgroundColor = selected ? this.selectedColor : this.defaultColor
    }

    constructor(root: HTMLElement, 
                version: VCSVersion, 
                colors?: {selected?: string, default?: string}, 
                sizeConstraints?: SizeConstraints, 
                onSelect?: (version: VCSVersion, selected: boolean) => void) {

        super(root, version, sizeConstraints)
        this.colors = colors

        this.button.onclick = () => {
            this.selected = !this.selected
            this.onClickCallbacks.forEach(callback => callback(this)) 
        }

        this.selected = false
        if (onSelect) { this.onSelect(onSelect) }
    }

    public onSelect(callback: (version: VCSVersion, selected: boolean) => void): Disposable {
        return super.onClick(button => {
            callback(this.version, this.selected)
        })
    }
}