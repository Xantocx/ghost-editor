import { View } from "./view";

export type ViewIdentifier = string

class ViewWrapper<WrappedView extends View, UpdateArguments> extends View {

    public readonly container: HTMLDivElement

    public wrappedView?: WrappedView = undefined
    public showCallback?:   (view: WrappedView)                        => void = undefined
    public updateCallback?: (view: WrappedView, args: UpdateArguments) => void = undefined
    public hideCallback?:   (view: WrappedView)                        => void = undefined

    private isVisible: boolean = false

    public constructor(root: HTMLElement, builder?: (root: HTMLElement) => WrappedView, options?: { showCallback?: (view: WrappedView) => void, updateCallback?: (view: WrappedView, args: UpdateArguments) => void, hideCallback?: (view: WrappedView) => void, show?: boolean }) {
        super(root)
        
        this.container = document.createElement("div")
        this.container.style.boxSizing = "border-box"
        this.container.style.width     = "100%"
        this.container.style.height    = "100%"
        this.container.style.maxWidth  = "100%"
        this.container.style.maxHeight = "100%"
        this.container.style.padding   = "0 0"
        this.container.style.margin    = "0 0"
        this.container.style.overflow  = "hidden"

        if (builder) { this.wrap(builder, options) }
        if (options?.show) { this.show() }
    }

    public unwrap(): void {
        Array.from(this.container.children).forEach(child => child.remove())
        this.wrappedView = undefined
        this.updateCallback = undefined
    }

    public wrap(builder: (root: HTMLElement) => WrappedView, options?: { showCallback?: (view: WrappedView) => void, updateCallback?: (view: WrappedView, args: UpdateArguments) => void, hideCallback?: (view: WrappedView) => void }): View {
        this.unwrap()
        this.wrappedView    = builder(this.container)
        this.showCallback   = options?.showCallback
        this.updateCallback = options?.updateCallback
        this.hideCallback   = options?.hideCallback
        return this.wrappedView!
    }

    public show(): WrappedView | undefined {
        if (!this.isVisible) {
            this.root.appendChild(this.container)
            this.afterShowing()
            this.isVisible = true
        }

        return this.wrappedView
    }

    public hide(): void {
        if (this.isVisible) {
            this.beforeHiding()
            this.container.remove()
            this.isVisible = false
        }
    }

    public update(args: UpdateArguments): void {
        if (this.wrappedView && this.updateCallback) { this.updateCallback(this.wrappedView, args) }
    }

    public afterShowing(): void {
        if (this.wrappedView && this.showCallback) { this.showCallback(this.wrappedView) }
    }

    public beforeHiding(): void {
        if (this.wrappedView && this.hideCallback) { this.hideCallback(this.wrappedView) }
    }

    public override remove(): void {
        this.hide()
        super.remove()
    }
}

type AnyWrappedView = ViewWrapper<any, any>

export class MetaView extends View {

    public identifiers: Record<string, string> = {}

    private readonly views = new Map<ViewIdentifier, AnyWrappedView>()
    public currentViewIdentifier?: ViewIdentifier

    private get currentWrappedView(): AnyWrappedView | undefined {
        return this.currentViewIdentifier ? this.getWrappedView(this.currentViewIdentifier) : undefined
    }

    public get currentView(): View | undefined {
        return this.currentViewIdentifier ? this.getView(this.currentViewIdentifier) : undefined
    }

    public constructor(root: HTMLElement) {
        super(root)
    }

    private setIdentifier(identifier: ViewIdentifier, wrapper: AnyWrappedView): void {
        this.views.set(identifier, wrapper)
        this.identifiers[identifier] = identifier
    }

    public removeIdentifier(identifier: ViewIdentifier): void {
        this.views.delete(identifier)
        delete this.identifiers[identifier]
    }

    private getWrappedView(identifier: ViewIdentifier): AnyWrappedView {
        if (this.views.has(identifier)) {
            return this.views.get(identifier)!
        } else {
            throw new Error(`This MetaView does not contain a view for the identifier "${identifier}"`)
        }
    }

    public getView(identifier: ViewIdentifier): View {
        return this.getWrappedView(identifier).wrappedView!
    }

    public addView<WrappedView extends View, UpdateArguments>(identifier: ViewIdentifier, 
                                                              builder: (root: HTMLElement) => WrappedView, 
                                                              options?: {
                                                                showCallback?:   (view: WrappedView)                        => void,
                                                                updateCallback?: (view: WrappedView, args: UpdateArguments) => void,
                                                                hideCallback?:   (view: WrappedView)                        => void,
                                                                show?: boolean 
                                                              }): View {

        if (this.views.has(identifier)) { throw new Error(`Please remove the existing view for ${identifier} before adding a new one!`) }

        const wrapper = new ViewWrapper(this.root, builder, { showCallback: options?.showCallback, updateCallback: options?.updateCallback, hideCallback: options?.hideCallback })
        this.setIdentifier(identifier, wrapper)

        if (options?.show) { this.showView(identifier) }

        return wrapper.wrappedView!
    }

    public removeView(identifier: ViewIdentifier): View | undefined {
        if (!this.views.has(identifier)) { return undefined }
        if (this.currentViewIdentifier === identifier) { this.hideViews() }

        const view = this.getView(identifier)
        this.removeIdentifier(identifier)

        return view
    }

    public showView(identifier: ViewIdentifier): View {
        if (this.currentViewIdentifier === identifier) { return this.getView(identifier) }

        this.hideViews()
        this.currentViewIdentifier = identifier
        return this.currentWrappedView!.show()!
    }

    public hideViews(): void {
        this.currentWrappedView?.hide()
        this.currentViewIdentifier = undefined
    }

    public updateCurrentView<UpdateArguments>(args: UpdateArguments): void {
        this.currentWrappedView?.update(args)
    }

    public update<UpdateArguments>(identifier: ViewIdentifier, args: UpdateArguments): void {
        this.getWrappedView(identifier).update(args)
    }
}