import { Disposable } from "../../utils/types"
import { SubscriptionManager } from "../widgets/mouse-tracker"

export class Button extends SubscriptionManager {

    public static defaultButton(root: HTMLElement, text: string, onClick?: () => void): Button {
        const button = new Button(root, text, onClick)

        button.style.border = "none"
        button.style.borderRadius = "8px"
        button.style.textAlign = "center"
        button.style.textDecoration = "none"
        button.style.display = "inline-block"
        button.style.fontSize = '14px'
        button.style.cursor = "pointer"

        return button
    }

    public static basicButton(root: HTMLElement, text: string, onClick?: () => void): Button {
        const button = this.defaultButton(root, text, onClick)

        button.style.backgroundColor = "blue"
        button.style.color = "white"
        button.style.padding = '7px 20px'

        return button
    }

    public static addButton(root: HTMLElement, onClick?: () => void): Button {
        const button = this.defaultButton(root, "+", onClick)

        button.style.backgroundColor = "green"
        button.style.color = "white"
        button.style.padding = "5px 10px"
        button.style.margin = "5px"

        return button
    }

    public static fullFieldButton(root: HTMLElement, text: string, onClick?: () => void): Button {
        const button = this.defaultButton(root, text, onClick)

        button.style.height = "100%"
        button.style.fontSize = "22px"
        button.style.backgroundColor = "white"
        button.style.color = "black"
        button.style.borderRadius = "0"

        return button
    }

    public readonly root: HTMLElement
    public readonly button: HTMLButtonElement

    private onClickCallbacks: {(): void}[] = []

    public get text(): string {
        return this.button.textContent ? this.button.textContent : ""
    }

    public set text(text: string) {
        this.button.textContent = text
    }

    public get style(): CSSStyleDeclaration {
        return this.button.style
    }

    constructor(root: HTMLElement, text: string, onClick?: () => void) {
        super()

        this.root = root
        this.button = document.createElement("button")

        this.button.onclick = () => { this.onClickCallbacks.forEach(callback => callback()) }

        this.text = text
        if (onClick) { this.onClick(onClick) }

        this.root.appendChild(this.button)
    }

    public onClick(callback: () => void): Disposable {
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