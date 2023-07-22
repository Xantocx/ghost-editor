import { Disposable } from "../../utils/types"
import { VersionViewContainer, VersionViewElement } from "../views/version/version-view"
import { SubscriptionManager } from "../widgets/mouse-tracker"
import { P5JSPreview } from "../views/previews/p5js-preview"
import { CodeProvider } from "../views/view"
import { Synchronizer } from "../../utils/synchronizer"
import { VCSVersion } from "../../../app/components/data/version"

export class Button extends SubscriptionManager {

    public static defaultButton(root: HTMLElement, text: string, onClick?: (button: Button) => void): Button {
        return new TextButton(root, text, onClick)
    }

    public static basicButton(root: HTMLElement, text: string, onClick?: (button: Button) => void): Button {
        const button = this.defaultButton(root, text, onClick)

        button.style.backgroundColor = "blue"
        button.style.color           = "white"
        button.style.padding         = '7px 20px'

        return button
    }

    public static copyButton(root: HTMLElement, onClick?: (button: Button) => void): Button {
        const button = this.defaultButton(root, "+", onClick)

        button.style.backgroundColor = "yellow"
        button.style.color           = "white"
        button.style.padding         = "5px 10px"
        button.style.margin          = "5px"

        return button
    }

    public static addButton(root: HTMLElement, onClick?: (button: Button) => void): Button {
        const button = this.defaultButton(root, "+", onClick)

        button.style.backgroundColor = "green"
        button.style.color           = "white"
        button.style.padding         = "5px 10px"
        button.style.margin          = "5px"

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

    public static versionButton(root: HTMLElement, version: VCSVersion, onClick?: (button: Button) => void): Button {
        return new VersionButton(root, version, onClick)
    }

    public static p5jsPreviewButton<Container extends VersionViewContainer<VCSVersion, P5JSPreviewButton<Container>>>(root: Container, version: VCSVersion, onClick: (button: Button) => void, synchronizer?: Synchronizer): P5JSPreviewButton<Container> {
        return new P5JSPreviewButton(root, version, { onClick, synchronizer })
    }

    public static p5jsPreviewToggleButton<Container extends VersionViewContainer<VCSVersion, P5JSPreviewToggleButton<Container>>>(root: Container, version: VCSVersion, onSelect: (version: VCSVersion, selected: boolean) => void, synchronizer?: Synchronizer): P5JSPreviewToggleButton<Container> {
        return new P5JSPreviewToggleButton(root, version, undefined, { onSelect, synchronizer })
    }

    public readonly root: HTMLElement
    public readonly button: HTMLButtonElement

    protected onClickCallbacks: {(button: Button): void}[] = []

    public get style(): CSSStyleDeclaration {
        return this.button.style
    }

    constructor(root: HTMLElement, options?: { onClick?: (button: Button) => void, synchronizer?: Synchronizer }) {
        super(options?.synchronizer)

        this.root = root
        this.button = document.createElement("button")

        // default config
        this.style.display        = "inline-block"
        this.style.border         = "none"
        this.style.borderRadius   = "8px"
        this.style.textAlign      = "center"
        this.style.textDecoration = "none"
        this.style.fontSize       = '14px'
        this.style.cursor         = "pointer"

        this.button.onclick = () => { this.onClickCallbacks.forEach(callback => callback(this)) }
        if (options?.onClick) { this.onClick(options.onClick) }

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
        super(root, { onClick })
        this.text = text
    }
}

export class IconButton extends Button {
    
    private readonly icon: HTMLElement

    public get iconClass(): string          { return this.icon.getAttribute("class")! }
    public set iconClass(iconClass: string) { this.icon.setAttribute("class", iconClass) }

    public static override defaultButton(root: HTMLElement, iconClass: string, onClick?: ((button: Button) => void)): IconButton {
        const button = new IconButton(root, iconClass, onClick)
        button.style.padding = "5px 7.09px"
        button.style.margin  = "5px"
        return button
    }

    public static copyButton(root: HTMLElement, onClick?: (button: Button) => void): IconButton {
        const button = this.defaultButton(root, "fas fa-arrow-right-to-bracket", onClick)
        button.style.backgroundColor = "orange"
        button.icon.style.color      = "white"
        button.icon.style.transform  = "scaleX(-1)"
        return button
    }

    public constructor(root: HTMLElement, iconClass: string, onClick?: (button: Button) => void) {
        super(root, { onClick })    

        this.icon      = document.createElement("i");
        this.iconClass = iconClass

        this.button.appendChild(this.icon)
    }
}

export class VersionButton extends TextButton {

    constructor(root: HTMLElement, version: VCSVersion, onClick?: (button: Button) => void) {
        super(root, version.name, onClick)

        this.style.display = "inline-block"
        this.style.margin = "0"

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


export class P5JSPreviewButton<Container extends VersionViewContainer<VCSVersion, P5JSPreviewButton<Container>>> extends Button implements VersionViewElement<VCSVersion, P5JSPreviewButton<Container>, VersionViewContainer<VCSVersion, P5JSPreviewButton<Container>>> {

    public  readonly container: Container
    public  readonly version:  VCSVersion
    private readonly preview:  P5JSPreview

    private readonly namePadding = 5

    constructor(container: Container, version: VCSVersion, options?: { onClick?: (button: Button) => void, synchronizer?: Synchronizer }) {
        super(container.container, { onClick: options?.onClick })
        this.version = version

        this.style.display         = "inline-flex"
        this.style.overflow        = "hidden"
        this.style.padding         = "0"
        this.style.margin          = "0"
        this.style.backgroundColor = version.automaticSuggestion ? "gray" : "blue"
        this.style.border          = "none"
        this.style.borderRadius    = "8px"
        this.style.cursor          = "pointer"

        const name = document.createElement("div")
        name.textContent = version.name
        name.style.display        = "block"
        name.style.alignSelf      = "center"
        name.style.flex           = "1"
        name.style.boxSizing      = "border-box"
        name.style.padding        = `${this.namePadding}px ${this.namePadding}px`
        name.style.margin         = "0"
        name.style.color          = "white"
        name.style.textAlign      = "center"
        name.style.textDecoration = "none"
        name.style.wordWrap       = "break-word"
        name.style.overflowWrap   = "break-word"
        name.style.fontSize       = '14px'
        this.button.appendChild(name)

        const previewContainer = document.createElement("div")
        previewContainer.style.flex    = "3"
        previewContainer.style.height  = "100%"
        previewContainer.style.padding = "0"
        previewContainer.style.margin  = "0"
        this.button.appendChild(previewContainer)

        this.preview = new P5JSPreview(previewContainer, { provider: version, padding: 5, errorMessageColor: "white", synchronizer: options?.synchronizer })
    }

    public override remove(): void {
        this.preview.remove()
        super.remove()
    }
}


export class P5JSPreviewToggleButton<Container extends VersionViewContainer<VCSVersion, P5JSPreviewToggleButton<Container>>> extends P5JSPreviewButton<Container> {

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

    constructor(container: Container, 
                version: VCSVersion,
                colors?: {selected?: string, default?: string}, 
                options?: {
                    onSelect?: (version: VCSVersion, selected: boolean) => void,
                    synchronizer?: Synchronizer
                }) {

        super(container, version, options)
        this.colors = colors

        this.button.onclick = () => {
            this.selected = !this.selected
            this.onClickCallbacks.forEach(callback => callback(this)) 
        }

        this.selected = false
        if (options?.onSelect) { this.onSelect(options.onSelect) }
    }

    public onSelect(callback: (version: VCSVersion, selected: boolean) => void): Disposable {
        return super.onClick(button => {
            callback(this.version, this.selected)
        })
    }
}