export abstract class Preview {

    public readonly root: HTMLElement

    protected code: string | undefined

    constructor(root: HTMLElement, code?: string) {
        this.root = root
        this.code = code
    }

    public render(): void {
        throw new Error("Method is not implemented!")
    }

    public update(code: string): void {
        this.code = code
        this.render()
    }

    public remove(): void {
        this.root.remove()
    }
}