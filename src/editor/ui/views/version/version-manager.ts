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

    public constructor(root: HTMLElement, languageId?: string, versions?: VCSVersion[]) {
        super(root)

        this.root.style.display = "flex"
        this.root.style.flexDirection = "column"

        // create and style container for versions
        this.previewContainer = document.createElement("div")
        this.previewStyle.boxSizing    = "border-box"
        this.previewStyle.flex         = "1"
        this.previewStyle.width        = "calc(100% - 10px)"
        this.previewStyle.padding      = "5px 5px"
        this.previewStyle.margin       = "5px 5px"
        this.root.appendChild(this.previewContainer)

        // create and style container for editors
        this.codeContainer = document.createElement("div")
        this.codeStyle.boxSizing = "border-box"
        this.codeStyle.flex      = "0"
        this.codeStyle.width     = "calc(100% - 10px)"
        this.root.appendChild(this.codeContainer)

        // add version code view
        this.code    = new VersionCodeViewList(this.codeContainer, languageId)
        this.preview = new VersionGridView(this.previewContainer, (version, selected) => {
            if (selected) { this.code.addVersion(version) }
            else          { this.code.removeVersion(version) }
        })

        this.preview.onVersionsChange(versions => {
            const previewVisible = versions.length > 0
            this.previewStyle.border = previewVisible ? "1px solid black" : ""
        })

        this.code.onVersionsChange(versions => {
            const codeVisible = versions.length > 0

            this.previewStyle.maxHeight = codeVisible ? "calc(25% - 10px)" : ""

            this.codeStyle.flex         = codeVisible ?                "3" : "0"
            this.codeStyle.maxHeight    = codeVisible ? "calc(75% - 10px)" : ""
            this.codeStyle.padding      = codeVisible ? "5px 5px" : "0 0"
            this.codeStyle.margin       = codeVisible ? "5px 5px" : "0 0"
            this.codeStyle.border       = codeVisible ? "1px solid black"  : ""
        })

        if (versions) { this.showVersions(versions) }
    }

    public setLanguageId(languageId: string): void { this.code.setLanguageId(languageId) }

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