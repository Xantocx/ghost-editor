import { VCSVersion } from "../../../../app/components/data/snapshot";
import { Synchronizer } from "../../../utils/synchronizer";
import { Disposable } from "../../../utils/types";
import { View } from "../view";

export abstract class VersionView extends View {
    
    public readonly version:   VCSVersion

    public constructor(root: HTMLElement, version: VCSVersion, synchronizer?: Synchronizer) {
        super(root, synchronizer)
        this.version = version
    }
}

export abstract class VersionViewElement<CustomView extends VersionViewElement<CustomView, Container>, Container extends VersionViewContainer<CustomView>> extends VersionView {

    public readonly container: Container

    public constructor(root: Container, version: VCSVersion) {
        super(root.container, version)
    }
}

export interface IVersionViewContainer extends View {
    getVersions(): VCSVersion[]
    showVersions(versions: VCSVersion[]): void
    addVersion(version: VCSVersion): void
    applyDiff(versions: VCSVersion[]): void
    removeVersion(version: VCSVersion): void
    removeVersions(): void
}

export abstract class VersionViewContainer<CustomView extends VersionViewElement<CustomView, VersionViewContainer<CustomView>>> extends View implements IVersionViewContainer {

    public readonly container: HTMLElement
    public readonly versions = new Map<VCSVersion, CustomView>()

    private readonly versionsChangedCallbacks: { (versions: VCSVersion[]): void }[] = []

    public get style(): CSSStyleDeclaration { return this.container.style }

    public constructor(container: HTMLElement, synchronizer?: Synchronizer) {
        super(container, synchronizer)
        this.container = container
    }

    public getVersions(): VCSVersion[] { return Array.from(this.versions.keys()) }
    public getViews():    CustomView[] { return Array.from(this.versions.values()) }

    private versionsChanged(): void {
        const versions = this.getVersions()
        this.versionsChangedCallbacks.forEach(callback => callback(versions))
    }

    protected createCustomView(version: VCSVersion): CustomView {
        throw new Error("This method should be implemented by you.")
    }

    public showVersions(versions: VCSVersion[]): void {
        this.removeVersions()
        versions.forEach(version => {
            const codeView = this.createCustomView(version)
            this.versions.set(version, codeView)
        })
        this.versionsChanged()
    }

    public addVersion(version: VCSVersion): void {
        if (this.versions.has(version)) { return }

        const codeView = this.createCustomView(version)
        this.versions.set(version, codeView)
        this.versionsChanged()
    }

    // returns removed versions
    public applyDiff(versions: VCSVersion[]): VCSVersion[] {
        const currentVersions = this.getVersions()

        const removedVersions = currentVersions.filter(version => {
            const remove = !versions.includes(version)
            if (remove) { this.removeVersion(version) }
            return remove
        })

        versions.reverse().forEach(version => { if (!this.versions.has(version)) { this.addVersion(version) } })
        
        this.versionsChanged()
        return removedVersions
    }

    public removeVersion(version: VCSVersion): void {
        this.versions.get(version)?.remove()
        this.versions.delete(version)
        this.versionsChanged()
    }

    public removeVersions(): void {
        this.getViews().forEach(codeView => codeView.remove())
        this.versions.clear()
        this.versionsChanged()
    }

    public onVersionsChange(callback: (versions: VCSVersion[]) => void): Disposable {
        this.versionsChangedCallbacks.push(callback)

        const parent = this

        return this.addSubscription({
            dispose() {
                const index = parent.versionsChangedCallbacks.indexOf(callback, 0)
                if (index > -1) { parent.versionsChangedCallbacks.splice(index, 1) }
            },
        })
    }

    public override remove(): void {
        this.removeVersions()
        this.container.remove()
        super.remove()
    }
}