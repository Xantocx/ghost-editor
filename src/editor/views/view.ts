import Synchronizer from "../utils/synchronizer"
import SubscriptionManager from "../utils/subscription-manager"

export default abstract class View extends SubscriptionManager {

    public readonly root: HTMLElement

    constructor(root: HTMLElement, sychronizer?: Synchronizer) {
        super(sychronizer)
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

export interface CodeProvider {
    getCode(): Promise<string>
    getErrorHint(code: string, errorMessage: string): Promise<string | null>
}

export abstract class CodeProviderView extends View {

    protected provider?: CodeProvider

    constructor(root: HTMLElement, options?: { provider?: CodeProvider, synchronizer?: Synchronizer }) {
        super(root, options?.synchronizer)
        this.provider = options?.provider
    }

    protected async getCode(): Promise<string | undefined> { return await this.provider?.getCode() }

    public update(provider: CodeProvider): void {
        this.provider = provider
        this.render()
    }

    public render(): void {
        throw new Error("Method is not implemented!")
    }
}