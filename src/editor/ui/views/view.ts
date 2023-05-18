import { SubscriptionManager } from "../widgets/mouse-tracker"

export abstract class View extends SubscriptionManager {

    public readonly root: HTMLElement

    constructor(root: HTMLElement) {
        super()
        this.root = root
    }
}

export abstract class CodeView extends View {

    protected code: string | undefined

    constructor(root: HTMLElement, code?: string) {
        super(root)
        this.code = code
    }

    public render(): void {
        throw new Error("Method is not implemented!")
    }

    public update(code: string): void {
        this.code = code
        this.render()
    }
}