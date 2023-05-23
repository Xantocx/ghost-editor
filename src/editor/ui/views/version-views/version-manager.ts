import { View } from "../view"
import { VCSVersion } from "../../../../app/components/data/snapshot"
import { Button } from "../../components/button"

export class VersionManagerView extends View {

    private readonly versionsContainer: HTMLDivElement
    private readonly versions = new Map<VCSVersion, Button>()

    private readonly codeContainer: HTMLDivElement

    private readonly minWidth = 200
    private readonly minHeight = 100
    
    public get versionsStyle():        CSSStyleDeclaration { return this.versionsContainer.style }
    public get codeStyle():            CSSStyleDeclaration { return this.codeContainer.style }

    public constructor(root: HTMLElement, versions?: VCSVersion[]) {
        super(root)

        // create and style container for versions
        this.versionsContainer = document.createElement("div")

        this.versionsStyle.width = "100%"
        this.versionsStyle.maxHeight = "15%"
        this.versionsStyle.padding = "0 0"
        this.versionsStyle.margin = "0 0"

        this.versionsStyle.display = "grid"
        this.versionsStyle.gridTemplateColumns = `repeat(auto-fill, minmax(${this.minWidth}px, 1fr))`
        this.versionsStyle.gridAutoRows = `minmax(${this.minHeight}px, auto)`
        this.versionsStyle.gap = "10px"

        this.root.appendChild(this.versionsContainer)

        // create and style container for editors
        this.codeContainer = document.createElement("div")
        this.codeStyle.width = "100%"
        this.codeStyle.maxHeight = "75%"
        this.codeStyle.padding = "0 0"
        this.codeStyle.margin = "0 0"
        this.root.appendChild(this.codeContainer)

        if (versions) { this.showVersions(versions) }
    }

    public showVersions(versions: VCSVersion[]): void {
        this.removeVersions()
        versions.forEach(version => {
            const button = Button.p5jsPreviewToggleButton(this.versionsContainer, version, { padding: 5 }, () => console.log("Clicked."))
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