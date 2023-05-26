import { VCSVersion } from "../../../../app/components/data/snapshot"
import { View } from "../view"
import { VersionGridView } from "./version-grid-view"
import { VersionCodeViewList } from "./version-code-view"
import { IVersionViewContainer } from "./version-view"

export class VersionManagerView extends View implements IVersionViewContainer {

    private readonly previewContainer: HTMLDivElement
    private readonly codeContainer:    HTMLDivElement

    private readonly preview: VersionGridView
    private readonly code:    VersionCodeViewList
    
    public get previewStyle(): CSSStyleDeclaration { return this.previewContainer.style }
    public get codeStyle():    CSSStyleDeclaration { return this.codeContainer.style }

    public constructor(root: HTMLElement, versions?: VCSVersion[]) {
        super(root)

        // create and style container for versions
        this.previewContainer = document.createElement("div")
        this.previewStyle.boxSizing    = "border-box"
        this.previewStyle.width        = "100%"
        this.previewStyle.maxHeight    = "25%"
        this.previewStyle.padding      = "5px 5px"
        this.previewStyle.margin       = "5px 5px"
        this.root.appendChild(this.previewContainer)

        // create and style container for editors
        this.codeContainer = document.createElement("div")
        this.codeStyle.boxSizing = "border-box"
        this.codeStyle.width     = "100%"
        this.codeStyle.maxHeight = "75%"
        this.codeStyle.padding   = "5px 5px"
        this.codeStyle.margin    = "5px 5px"
        this.root.appendChild(this.codeContainer)

        // add version code view
        this.code    = new VersionCodeViewList(this.codeContainer)
        this.preview = new VersionGridView(this.previewContainer, (version, selected) => {
            if (selected) { this.code.addVersion(version) }
            else          { this.code.removeVersion(version) }
        })

        this.preview.onVersionsChange(versions => {
            this.previewStyle.border = versions.length > 0 ? "1px solid black" : ""
        })

        this.code.onVersionsChange(versions => [
            this.codeStyle.border = versions.length > 0 ? "1px solid black" : ""
        ])

        if (versions) { this.showVersions(versions) }
    }

    public getVersions(): VCSVersion[] { return this.preview.getVersions() }

    public showVersions(versions: VCSVersion[]): void {
        this.preview.showVersions(versions)
        //this.code.showVersions(versions)
    }

    public addVersion(version: VCSVersion): void {
        this.preview.addVersion(version)
        //this.code.addVersion(version)
    }

    public applyDiff(versions: VCSVersion[]): void {
        this.preview.applyDiff(versions)
        //this.code.applyDiff(versions)
    }

    public removeVersion(version: VCSVersion): void {
        this.preview.removeVersion(version)
        //this.code.removeVersion(version)
    }

    public removeVersions(): void {
        this.preview.removeVersions()
        //this.code.removeVersions()
    }

    public override remove(): void {
        this.removeVersions()
        this.previewContainer.remove()
        this.codeContainer.remove()
        super.remove()
    }
}