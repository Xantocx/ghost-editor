import { VCSVersion } from "../../../../app/components/data/snapshot";
import { Synchronizer } from "../../../utils/synchronizer";
import { Disposable } from "../../../utils/types";
import { View } from "../view";

export abstract class VersionView<Version> extends View {
    
    public readonly version: Version

    public constructor(root: HTMLElement, version: Version, synchronizer?: Synchronizer) {
        super(root, synchronizer)
        this.version = version
    }
}

export abstract class VersionViewElement<Version, CustomView extends VersionViewElement<Version, CustomView, Container>, Container extends VersionViewContainer<Version, CustomView>> extends VersionView<Version> {

    public readonly container: Container

    public constructor(root: Container, version: Version) {
        super(root.container, version)
    }
}

export interface IVersionViewContainer<Version> extends View {
    getVersions(): Version[]
    showVersions(versions: Version[]): void
    addVersion(version: Version): void
    applyDiff(versions: Version[]): void
    removeVersion(version: Version): void
    removeVersions(): void
}

export abstract class VersionViewContainer<Version, CustomView extends VersionViewElement<Version, CustomView, VersionViewContainer<Version, CustomView>>> extends View implements IVersionViewContainer<Version> {

    public readonly container: HTMLElement
    public readonly versions = new Map<Version, CustomView>()

    private readonly versionsChangedCallbacks: { (versions: Version[]): void }[] = []

    public get style(): CSSStyleDeclaration { return this.container.style }

    public constructor(container: HTMLElement, synchronizer?: Synchronizer) {
        super(container, synchronizer)
        this.container = container
    }

    public getVersions(): Version[]    { return Array.from(this.versions.keys()) }
    public getViews():    CustomView[] { return Array.from(this.versions.values()) }

    private versionsChanged(): void {
        const versions = this.getVersions()
        this.versionsChangedCallbacks.forEach(callback => callback(versions))
    }

    protected createCustomView(version: Version): CustomView {
        throw new Error("This method should be implemented by you.")
    }

    public showVersions(versions: Version[]): void {
        this.removeVersions()
        versions.forEach(version => {
            const codeView = this.createCustomView(version)
            this.versions.set(version, codeView)
        })
        this.versionsChanged()
    }

    public addVersion(version: Version): void {
        if (this.versions.has(version)) { return }

        const codeView = this.createCustomView(version)
        this.versions.set(version, codeView)
        this.versionsChanged()
    }

    // returns removed versions
    public applyDiff(versions: Version[]): Version[] {
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

    public removeVersion(version: Version): void {
        this.versions.get(version)?.remove()
        this.versions.delete(version)
        this.versionsChanged()
    }

    public removeVersions(): void {
        this.getViews().forEach(codeView => codeView.remove())
        this.versions.clear()
        this.versionsChanged()
    }

    public onVersionsChange(callback: (versions: Version[]) => void): Disposable {
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

export class VCSVersionView extends VersionView<VCSVersion> {}
export class VCSVersionViewElement<CustomView extends VCSVersionViewElement<CustomView, Container>, Container extends VCSVersionViewContainer<CustomView>> extends VersionViewElement<VCSVersion, CustomView, Container> {}
export class VCSVersionViewContainer<CustomView extends VCSVersionViewElement<CustomView, VCSVersionViewContainer<CustomView>>> extends VersionViewContainer<VCSVersion, CustomView> {}
export interface IVCSVersionViewContainer extends IVersionViewContainer<VCSVersion> {}