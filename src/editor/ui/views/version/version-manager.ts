import { View } from "../view"
import { VCSVersion } from "../../../../app/components/data/snapshot"
import { Button } from "../../components/button"

export class VersionManagerView extends View {

    private readonly previewContainer: HTMLDivElement
    private readonly versions = new Map<VCSVersion, Button>()

    private readonly codeContainer: HTMLDivElement

    private readonly minWidth  = 200
    private readonly minHeight = 100
    
    public get previewStyle(): CSSStyleDeclaration { return this.previewContainer.style }
    public get codeStyle():    CSSStyleDeclaration { return this.codeContainer.style }

    private get versionData(): VCSVersion[] { return Array.from(this.versions.keys()) }
    private get previews(): Button[]     { return Array.from(this.versions.values()) }

    public constructor(root: HTMLElement, versions?: VCSVersion[]) {
        super(root)

        // create and style container for versions
        this.previewContainer = document.createElement("div")

        this.previewStyle.boxSizing = "border-box"
        this.previewStyle.width     = "100%"
        this.previewStyle.maxHeight = "25%"
        this.previewStyle.padding   = "5px 5px"
        this.previewStyle.margin    = "0 0"

        this.previewStyle.display             = "grid"
        this.previewStyle.gridTemplateColumns = `repeat(auto-fill, minmax(${this.minWidth}px, 1fr))`
        this.previewStyle.gridAutoRows        = `minmax(${this.minHeight}px, auto)`
        this.previewStyle.gap                 = "10px"
        this.previewStyle.overflow            = "auto"

        this.root.appendChild(this.previewContainer)

        // create and style container for editors
        this.codeContainer = document.createElement("div")
        this.codeStyle.width     = "100%"
        this.codeStyle.maxHeight = "75%"
        this.codeStyle.padding   = "0 0"
        this.codeStyle.margin    = "0 0"
        this.root.appendChild(this.codeContainer)

        if (versions) { this.showVersions(versions) }
    }

    private createPreview(version: VCSVersion): Button {
        return Button.p5jsPreviewToggleButton(this.previewContainer, version, { padding: 5 }, () => console.log("Clicked."))
    }

    public showVersions(versions: VCSVersion[]): void {
        this.removeVersions()
        versions.forEach(version => {
            const preview = this.createPreview(version)
            this.versions.set(version, preview)
        })
    }

    public addVersion(version: VCSVersion): void {
        if (this.versions.has(version)) { return }

        const preview = this.createPreview(version)
        this.versions.set(version, preview)
    }

    public applyDiff(versions: VCSVersion[]): void {
        const currentVersions = this.versionData
        currentVersions.forEach(   version => { if (!versions.includes(version)) { this.removeVersion(version) } })
        versions.reverse().forEach(version => { if (!this.versions.has(version)) { this.addVersion(version) } })
    }

    public removeVersion(version: VCSVersion): void {
        this.versions.get(version)?.remove()
        this.versions.delete(version)
    }

    public removeVersions(): void {
        this.previews.forEach(preview => preview.remove())
        this.versions.clear()
    }

    public override remove(): void {
        super.remove()
        this.removeVersions()

        this.previewContainer.remove()
        this.codeContainer.remove()
    }
}