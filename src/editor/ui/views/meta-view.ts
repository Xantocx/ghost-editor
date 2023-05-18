import { View } from "./view";

export type ViewIdentifier = string

class WrappedView extends View {

    public readonly container: HTMLDivElement
    public wrappedView?: View = undefined

    private isVisible: boolean = false

    public get containerStyle(): CSSStyleDeclaration {
        return this.container.style
    }

    public constructor(root: HTMLElement, show?: boolean) {
        super(root)
        
        this.container = document.createElement("div")
        this.containerStyle.width  = "100%"
        this.containerStyle.height = "100%"

        if (show) { this.show() }
    }

    public unwrap(): void {
        Array.from(this.container.children).forEach(child => child.remove())
        this.wrappedView = undefined
    }

    public wrap(builder: (root: HTMLElement) => View): View {
        this.unwrap()
        this.wrappedView = builder(this.container)
        return this.wrappedView!
    }

    public show(): View | undefined {
        if (!this.isVisible) {
            this.root.appendChild(this.container)
            this.isVisible = true
        }

        return this.wrappedView
    }

    public hide(): void {
        if (this.isVisible) {
            this.container.remove()
            this.isVisible = false
        }
    }

    public override remove(): void {
        this.hide()
        super.remove()
    }
}

export class MetaView extends View {

    private readonly views = new Map<ViewIdentifier, WrappedView>()
    private currentViewIdentifier?: ViewIdentifier

    private get currentWrappedView(): WrappedView | undefined {
        return this.currentViewIdentifier ? this.getWrappedView(this.currentViewIdentifier) : undefined
    }

    public get currentView(): View | undefined {
        return this.currentViewIdentifier ? this.getView(this.currentViewIdentifier) : undefined
    }

    public constructor(root: HTMLElement) {
        super(root)
    }

    private getWrappedView(identifier: ViewIdentifier): WrappedView {
        if (this.views.has(identifier)) {
            return this.views.get(identifier)!
        } else {
            throw new Error(`This MetaView does not contain a view for the identifier "${identifier}"`)
        }
    }

    public getView(identifier: ViewIdentifier): View {
        return this.getWrappedView(identifier).wrappedView!
    }

    public addView(identifier: ViewIdentifier, builder: (root: HTMLElement) => View, show?: boolean): View {
        if (this.views.has(identifier)) { throw new Error(`Please remove the existing view for ${identifier} before adding a new one!`) }

        const wrapper = new WrappedView(this.root)
        this.views.set(identifier, wrapper)
        const view = wrapper.wrap(builder)

        if (show) { this.showView(identifier) }

        return view
    }

    public removeView(identifier: ViewIdentifier): View | undefined {
        if (!this.views.has(identifier)) { return undefined }
        if (this.currentViewIdentifier === identifier) { this.hideViews() }

        const view = this.getView(identifier)
        this.views.delete(identifier)

        return view
    }

    public showView(identifier: ViewIdentifier): View {
        this.hideViews()
        this.currentViewIdentifier = identifier
        return this.currentWrappedView!.show()!
    }

    public hideViews(): void {
        this.currentWrappedView?.hide()
        this.currentViewIdentifier = undefined
    }
}