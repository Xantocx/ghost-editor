import { SubscriptionManager } from "./subscription-manager"
import { Disposable } from "../../utils/types"

export abstract class MouseTracker extends SubscriptionManager {

    public mouseOn: boolean = false
    private mouseEventSubscribers: {(mouseOn: boolean): void}[] = []

    protected mouseChanged(mouseOn: boolean): void {
        this.mouseOn = mouseOn
        this.mouseEventSubscribers.forEach(callback => callback(mouseOn))
    }

    public onMouseEnter(callback: (mouseOn: boolean) => void): Disposable {
        //callback(this.mouseOn)
        this.mouseEventSubscribers.push(callback)

        const parent = this

        const subscription = {
            dispose() {
                const index = parent.mouseEventSubscribers.indexOf(callback)
                if (index > -1) { parent.mouseEventSubscribers.splice(index, 1) }
            }
        }

        return this.addSubscription(subscription)
    }

    public override remove(): void {
        super.remove()
    }
}

export class DomMouseTracker extends MouseTracker {

    public readonly domNode: HTMLElement

    constructor(domNode: HTMLElement) {
        super()

        this.domNode = domNode
        this.setupMouseTracking()
    }

    private setupMouseTracking(): void {
        this.domNode.addEventListener("mouseenter", (event) => {
            this.mouseChanged(true)
        });

        this.domNode.addEventListener("mouseleave", (event) => {
            this.mouseChanged(false)
        });
    }

    public override remove(): void {
        super.remove()
        this.domNode.remove()
    }
}