import { View } from "./view"
import { VCSVersion } from "../../../app/components/data/snapshot"
import { Button } from "../components/button"

export class VersionsView extends View {

    private readonly versionsContainer: HTMLDivElement
    private readonly versions = new Map<VCSVersion, Button>()

    private readonly codeContainer: HTMLDivElement
    
    public get versionsContainerStyle(): CSSStyleDeclaration {
        return this.versionsContainer.style
    }

    public get codeContainerStyle(): CSSStyleDeclaration {
        return this.codeContainer.style
    }

    public constructor(root: HTMLElement, versions?: VCSVersion[]) {
        super(root)

        // create and style container for versions
        this.versionsContainer = document.createElement("div")

        this.versionsContainerStyle.width = "100%"
        this.versionsContainerStyle.maxHeight = "25%"
        this.versionsContainerStyle.padding = "0 0"
        this.versionsContainerStyle.margin = "0 0"

        this.versionsContainerStyle.display = "grid"
        this.versionsContainerStyle.gridTemplateColumns = "repeat(auto-fill, minmax(20px, 1fr))"
        this.versionsContainerStyle.gap = "10px"

        this.root.appendChild(this.versionsContainer)

        // create and style container for editors
        this.codeContainer = document.createElement("div")
        this.codeContainerStyle.width = "100%"
        this.codeContainerStyle.maxHeight = "75%"
        this.codeContainerStyle.padding = "0 0"
        this.codeContainerStyle.margin = "0 0"
        this.root.appendChild(this.codeContainer)

        if (versions) { this.showVersions(versions) }
    }

    public showVersions(versions: VCSVersion[]): void {
        this.removeVersions()
        versions.forEach(version => {
            const button = Button.p5jsPreviewButton(this.versionsContainer, version, {}, () => console.log("Clicked."))
            this.versions.set(version, button)
        })
    }

    public removeVersions(): void {
        Array.from(this.versions.values()).forEach(button => button.remove())
        this.versions.clear()
    }

    public override remove(): void {
        super.remove()
        this.removeVersions()

        this.versionsContainer.remove()
        this.codeContainer.remove()
    }
}