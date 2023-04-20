import { Disposable } from "../../utils/types"

export class MouseTracker {

    public mouseOn: boolean = false
    private mouseEventSubscribers: {(mouseOn: boolean): void}[] = []

    protected mouseChanged(mouseOn: boolean): void {
        this.mouseOn = mouseOn
        this.mouseEventSubscribers.forEach(callback => callback(mouseOn))
    }

    public onMouseEnter(callback: (mouseOn: boolean) => void): Disposable {
        callback(this.mouseOn)
        this.mouseEventSubscribers.push(callback)
        return {
            dispose: () => {
                const index = this.mouseEventSubscribers.indexOf(callback)
                if (index > -1) { this.mouseEventSubscribers.splice(index, 1) }
            }
        }
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
}