import SubscriptionManager from "./subscription-manager"
import Disposable from "../../utils/data-types/server-safe/disposable"

export abstract class MouseTracker extends SubscriptionManager {

    public mouseOn = false
    private mouseEventSubscribers: {(mouseOn: boolean): void}[] = []

    protected mouseChanged(mouseOn: boolean): void {
        this.mouseOn = mouseOn
        this.mouseEventSubscribers.forEach(callback => callback(mouseOn))
    }

    public onMouseEnter(callback: (mouseOn: boolean) => void): Disposable {
        //callback(this.mouseOn)
        this.mouseEventSubscribers.push(callback)

        const subscription = {
            dispose: () => {
                const index = this.mouseEventSubscribers.indexOf(callback)
                if (index > -1) { this.mouseEventSubscribers.splice(index, 1) }
            }
        }

        return this.addSubscription(subscription)
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
        this.domNode.addEventListener("mouseenter", () => {
            this.mouseChanged(true)
        });

        this.domNode.addEventListener("mouseleave", () => {
            this.mouseChanged(false)
        });
    }

    public override remove(): void {
        super.remove()
        this.domNode.remove()
    }
}