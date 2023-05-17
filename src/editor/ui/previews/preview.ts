import { SubscriptionManager } from "../widgets/mouse-tracker"

export abstract class Preview extends SubscriptionManager {

    public readonly root: HTMLElement

    constructor(root: HTMLElement) {
        super()
        this.root = root
    }

    /*
    public remove(): void {
        this.root.remove()
    }
    */
}

export abstract class CodePreview extends Preview {

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