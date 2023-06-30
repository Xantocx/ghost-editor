import { VCSVersion } from "../../../../app/components/data/version";
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

    protected async createCustomView(version: Version): Promise<CustomView> {
        throw new Error("This method should be implemented by you.")
    }

    public async showVersions(versions: Version[]): Promise<void> {
        this.removeVersions()
        for (const version of versions) {
            const codeView = await this.createCustomView(version)
            this.versions.set(version, codeView)
        }
        this.versionsChanged()
    }

    public async addVersion(version: Version): Promise<void> {
        if (this.versions.has(version)) { return }

        const codeView = await this.createCustomView(version)
        this.versions.set(version, codeView)
        this.versionsChanged()
    }

    // returns removed versions
    public async applyDiff(versions: Version[]): Promise<Version[]> {
        const currentVersions = this.getVersions()

        const removedVersions = currentVersions.filter(version => {
            const remove = !versions.includes(version)
            if (remove) { this.removeVersion(version) }
            return remove
        })

        for (const version of versions) {
            if (!this.versions.has(version)) {
                await this.addVersion(version)
            }
        }
        
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

export class TagView extends VersionView<VCSVersion> {}
export class TagViewElement<CustomView extends TagViewElement<CustomView, Container>, Container extends TagViewContainer<CustomView>> extends VersionViewElement<VCSVersion, CustomView, Container> {}
export class TagViewContainer<CustomView extends TagViewElement<CustomView, TagViewContainer<CustomView>>> extends VersionViewContainer<VCSVersion, CustomView> {}
export interface ITagViewContainer extends IVersionViewContainer<VCSVersion> {}