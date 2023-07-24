import { IDisposable } from "monaco-editor";
import { Synchronizer, Synchronizable } from "../../utils/synchronizer";
import { View } from "./view";

export type ViewIdentifier = string

class ViewWrapper<WrappedView extends View, UpdateArguments> extends View {

    public readonly container: HTMLDivElement

    public wrappedView?: WrappedView = undefined
    public showCallback?:   (view: WrappedView)                        => void | Promise<void> = undefined
    public updateCallback?: (view: WrappedView, args: UpdateArguments) => void | Promise<void> = undefined
    public hideCallback?:   (view: WrappedView)                        => void | Promise<void> = undefined

    private isVisible: boolean = false

    public constructor(root: HTMLElement, builder?: (root: HTMLElement) => WrappedView, options?: { showCallback?: (view: WrappedView) => void | Promise<void>, updateCallback?: (view: WrappedView, args: UpdateArguments) => void | Promise<void>, hideCallback?: (view: WrappedView) => void | Promise<void>, show?: boolean }) {
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

    public wrap(builder: (root: HTMLElement) => WrappedView, options?: { showCallback?: (view: WrappedView) => void | Promise<void>, updateCallback?: (view: WrappedView, args: UpdateArguments) => void | Promise<void>, hideCallback?: (view: WrappedView) => void | Promise<void> }): View {
        this.unwrap()
        this.wrappedView    = builder(this.container)
        this.showCallback   = options?.showCallback
        this.updateCallback = options?.updateCallback
        this.hideCallback   = options?.hideCallback
        return this.wrappedView!
    }

    public async show(): Promise<WrappedView | undefined> {
        if (!this.isVisible) {
            this.root.appendChild(this.container)
            await this.afterShowing()
            this.isVisible = true
        }

        return this.wrappedView
    }

    public async hide(): Promise<void> {
        if (this.isVisible) {
            await this.beforeHiding()
            this.container.remove()
            this.isVisible = false
        }
    }

    public async update(args: UpdateArguments): Promise<void> {
        if (this.wrappedView && this.updateCallback) { await this.updateCallback(this.wrappedView, args) }
    }

    public async afterShowing(): Promise<void> {
        if (this.wrappedView && this.showCallback) { await this.showCallback(this.wrappedView) }
    }

    public async beforeHiding(): Promise<void> {
        if (this.wrappedView && this.hideCallback) { await this.hideCallback(this.wrappedView) }
    }

    public override remove(): void {
        this.hide()
        super.remove()
    }
}

class ReactViewWrapper extends ViewWrapper<View, void> {
    
    public constructor(root: HTMLElement, builder?: (root: HTMLElement) => void, show?: boolean) {
        super(root)
        if (builder) { builder(this.container) }
        if (show)    { this.show() }
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

    public async addView<WrappedView extends View, UpdateArguments>(identifier: ViewIdentifier, 
                                                              builder: (root: HTMLElement) => WrappedView, 
                                                              options?: {
                                                                showCallback?:   (view: WrappedView)                        => void,
                                                                updateCallback?: (view: WrappedView, args: UpdateArguments) => void,
                                                                hideCallback?:   (view: WrappedView)                        => void,
                                                                show?: boolean 
                                                              }): Promise<View> {

        if (this.views.has(identifier)) { throw new Error(`Please remove the existing view for ${identifier} before adding a new one!`) }

        const wrapper = new ViewWrapper(this.root, builder, { showCallback: options?.showCallback, updateCallback: options?.updateCallback, hideCallback: options?.hideCallback })
        this.setIdentifier(identifier, wrapper)

        if (options?.show) { await this.showView(identifier) }

        return wrapper.wrappedView!
    }

    public async addReactView(identifier: ViewIdentifier, builder: (root: HTMLElement) => void, show?: boolean): Promise<void> {
        if (this.views.has(identifier)) { throw new Error(`Please remove the existing view for ${identifier} before adding a new one!`) }

        const wrapper = new ReactViewWrapper(this.root, builder)
        this.setIdentifier(identifier, wrapper)

        if (show) { await this.showView(identifier) }
    }

    public async removeView(identifier: ViewIdentifier): Promise<View | undefined> {
        if (!this.views.has(identifier)) { return undefined }
        if (this.currentViewIdentifier === identifier) { await this.hideViews() }

        const view = this.getView(identifier)
        this.removeIdentifier(identifier)

        return view
    }

    public async showView(identifier: ViewIdentifier): Promise<View> {
        if (this.currentViewIdentifier === identifier) { return this.getView(identifier) }

        await this.hideViews()
        this.currentViewIdentifier = identifier
        return this.currentWrappedView!.show()!
    }

    public async hideViews(): Promise<void> {
        await this.currentWrappedView?.hide()
        this.currentViewIdentifier = undefined
    }

    public async updateCurrentView<UpdateArguments>(args: UpdateArguments): Promise<void> {
        await this.currentWrappedView?.update(args)
    }

    public async update<UpdateArguments>(identifier: ViewIdentifier, args: UpdateArguments): Promise<void> {
        await this.getWrappedView(identifier).update(args)
    }
}