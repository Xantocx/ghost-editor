import { Disposable } from "../../utils/types"
import { SubscriptionManager } from "../widgets/mouse-tracker"

export class Button extends SubscriptionManager {

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

        this.applyDefaultStyle()
        this.button.onclick = () => { this.onClickCallbacks.forEach(callback => callback()) }

        this.text = text
        if (onClick) { this.onClick(onClick) }

        this.root.appendChild(this.button)
    }

    public applyDefaultStyle(): void {
        this.style.backgroundColor = "blue"
        this.style.color = "white"
        this.style.border = "none"
        this.style.padding = `7px 20px`
        this.style.textAlign = "center"
        this.style.textDecoration = "none"
        this.style.display = "inline-block"
        this.style.fontSize = `16px`
        this.style.cursor = "pointer"
        this.style.borderRadius = "8px"
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