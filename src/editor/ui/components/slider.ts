import { Disposable } from "../../utils/types"
import { SubscriptionManager } from "../widgets/mouse-tracker"

export class Slider extends SubscriptionManager {

    public readonly uuid: string
    public readonly root: HTMLElement
    public readonly slider: HTMLInputElement

    private onChangeSubscribers: {(value: number): void}[] = []

    public get style(): CSSStyleDeclaration {
        return this.slider.style
    }

    constructor(root: HTMLElement, uuid: string, min: number, max: number, defaultValue: number) {
        super()

        this.root = root
        this.uuid = uuid
        this.slider = document.createElement("input") as HTMLInputElement

        // Set slider style
        this.slider.style.width = "100%"

        // Set the attributes for the slider
        this.slider.type = 'range';
        this.slider.id = `slider-${this.uuid}`;
        this.slider.min   = `${min}`;
        this.slider.max   = `${max}`;
        this.slider.value = `${defaultValue}`;
        this.slider.step = '1';

        // Add callback
        this.slider.addEventListener("input", () => {
            const value = parseInt(this.slider.value)
            this.onChangeSubscribers.forEach(callback => {
                callback(value)
            })
        })

        this.root.appendChild(this.slider)
    }

    public update(min: number, max: number, defaultValue: number): void {
        console.log("SLIDER UPDATE")
        this.slider.min   = `${min}`;
        this.slider.max   = `${max}`;
        this.slider.value = `${defaultValue}`;
    }

    public onChange(callback: (value: number) => void): Disposable {
        this.onChangeSubscribers.push(callback)

        const parent = this

        return this.addSubscription({
            dispose() {
                const index = parent.onChangeSubscribers.indexOf(callback)
                if (index > -1) { parent.onChangeSubscribers.splice(index, 1) }
            },
        })
    }

    public remove(): void {
        super.remove()
        this.slider.remove()
    }
}