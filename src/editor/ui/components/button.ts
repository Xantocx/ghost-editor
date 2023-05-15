import { VCSVersion } from "../../../app/components/data/snapshot"
import { Disposable } from "../../utils/types"
import { P5JSPreview } from "../previews/ps5js-preview"
import { SubscriptionManager } from "../widgets/mouse-tracker"

export class Button extends SubscriptionManager {

    public static defaultButton(root: HTMLElement, text: string, onClick?: (button: Button) => void): Button {
        const button = new TextButton(root, text, onClick)

        button.style.border = "none"
        button.style.borderRadius = "8px"
        button.style.textAlign = "center"
        button.style.textDecoration = "none"
        button.style.display = "inline-block"
        button.style.fontSize = '14px'
        button.style.cursor = "pointer"

        return button
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

    public static p5jsPreviewButton(root: HTMLElement, version: VCSVersion, onClick?: (button: Button) => void): Button {
        return new P5JSPreviewButton(root, version, onClick)
    }

    public readonly root: HTMLElement
    public readonly button: HTMLButtonElement

    private onClickCallbacks: {(button: Button): void}[] = []

    public get style(): CSSStyleDeclaration {
        return this.button.style
    }

    constructor(root: HTMLElement, onClick?: (button: Button) => void) {
        super()

        this.root = root
        this.button = document.createElement("button")

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
                if (index > -1) { parent.onClickCallbacks = parent.onClickCallbacks.splice(index, 1) }
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


export class P5JSPreviewButton extends Button {

    public readonly version: VCSVersion
    private readonly preview: P5JSPreview

    constructor(root: HTMLElement, version: VCSVersion, onClick?: (button: Button) => void) {
        super(root, onClick)
        this.version = version

        this.style.backgroundColor = version.automaticSuggestion ? "gray" : "blue"
        this.style.border = "none"
        this.style.borderRadius = "8px"
        this.style.display = "inline-block"
        this.style.cursor = "pointer"

        /*
        const name = document.createElement("div")
        name.textContent = version.name
        name.style.textAlign = "center"
        name.style.textDecoration = "none"
        name.style.fontSize = '14px'
        this.button.appendChild(name)
        */

        console.log(version.text)

        this.preview = new P5JSPreview(this.button, version.text)
        this.preview.iframeStyle.flexGrow = "1"
    }

    /*
    public override remove(): void {
        this.preview.remove()
        super.remove()
    }
    */
}