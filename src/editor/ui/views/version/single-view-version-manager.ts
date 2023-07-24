import { View } from "../view"
import { VersionGridView } from "./version-grid-view"
import { VersionCodeView } from "./standalone-version-code-view"
import { IVersionViewContainer } from "./version-view"
import { Synchronizer } from "../../../utils/synchronizer"
import { VCSVersion } from "../../../../app/components/data/version"

export class VersionManagerView extends View implements IVersionViewContainer<VCSVersion> {

    private readonly previewContainer: HTMLDivElement
    private readonly codeContainer:    HTMLDivElement

    private readonly preview: VersionGridView
    private          code?:   VersionCodeView
    
    public get previewStyle(): CSSStyleDeclaration { return this.previewContainer.style }
    public get codeStyle():    CSSStyleDeclaration { return this.codeContainer.style }

    private languageId?:       string
    private codeSynchronizer?: Synchronizer

    public constructor(root: HTMLElement, options?: { languageId?: string, synchronizer?: Synchronizer, versions?: VCSVersion[] }) {
        super(root)

        this.root.style.display = "flex"
        this.root.style.flexDirection = "column"

        // create and style container for versions
        this.previewContainer = document.createElement("div")
        this.previewStyle.boxSizing    = "border-box"
        this.previewStyle.flex         = "1"
        this.previewStyle.width        = "calc(100% - 10px)"
        this.previewStyle.padding      = "5px"
        this.previewStyle.margin       = "5px"
        this.root.appendChild(this.previewContainer)

        // create and style container for editors
        this.codeContainer = document.createElement("div")
        this.codeStyle.boxSizing = "border-box"
        this.codeStyle.flex      = "0"
        this.codeStyle.width     = "calc(100% - 10px)"
        this.codeStyle.padding   = "0"
        this.codeStyle.marginTop = "0"
        this.root.appendChild(this.codeContainer)

        // add version code view
        this.languageId       = options?.languageId
        this.codeSynchronizer = options?.synchronizer
        
        this.preview = new VersionGridView(this.previewContainer, async (version, selected) => {
            await this.code?.remove()
            this.code = selected ? await VersionCodeView.create(this.codeContainer, version, this.languageId, this.codeSynchronizer) : undefined
            
            this.previewStyle.maxHeight = selected ? "calc(25% - 10px)" : ""
            this.codeStyle.flex         = selected ? "3"                : "0"
            this.codeStyle.maxHeight    = selected ? "calc(75% - 10px)" : ""
            this.codeStyle.marginLeft   = selected ? "5px"              : "0"
            this.codeStyle.marginRight  = selected ? "5px"              : "0"
            this.codeStyle.marginBottom = selected ? "5px"              : "0"

            this.preview.versions.forEach((preview, previewVersion) => preview.selected = selected && previewVersion === version)
        }, this.codeSynchronizer)

        this.preview.onVersionsChange(versions => {
            const previewVisible = versions.length > 0
            this.previewStyle.border = previewVisible ? "1px solid black" : ""
        })

        /*
        this.code.onVersionsChange(versions => {
            const codeVisible = versions.length > 0

            this.previewStyle.maxHeight = codeVisible ? "calc(25% - 10px)" : ""

            this.codeStyle.flex         = codeVisible ?                "3" : "0"
            this.codeStyle.maxHeight    = codeVisible ? "calc(75% - 10px)" : ""
            this.codeStyle.padding      = codeVisible ? "5px 5px" : "0 0"
            this.codeStyle.margin       = codeVisible ? "5px 5px" : "0 0"
            this.codeStyle.border       = codeVisible ? "1px solid black"  : ""
        })
        */

        if (options?.versions) { this.showVersions(options?.versions) }
    }

    getVersions(): VCSVersion[] { return this.preview.getVersions() }

    public setLanguageId(languageId: string): void { this.languageId = languageId }

    public async showVersions(versions: VCSVersion[]): Promise<void> {
        await this.preview.showVersions(versions)
        //await this.code.showVersions(versions)
    }

    public async addVersion(version: VCSVersion): Promise<void> {
        await this.preview.addVersion(version)
        //await this.code.addVersion(viewVersion)
    }

    private async removeCodePreview(): Promise<void> {
        await this.code?.remove()
        this.code = undefined
        this.previewStyle.maxHeight = ""
        this.codeStyle.flex         = "0"
        this.codeStyle.maxHeight    = ""
        this.codeStyle.marginLeft   = "0"
        this.codeStyle.marginRight  = "0"
        this.codeStyle.marginBottom = "0"
    }

    private async removenFromCodePreview(version: VCSVersion): Promise<void> {
        if (this.code && version === this.code.version) {
            await this.removeCodePreview()
        }
    }

    public async applyDiff(versions: VCSVersion[]): Promise<void> {
        const removedVersions = await this.preview.applyDiff(versions)
        if (removedVersions.includes(this.code?.version)) {
            await this.removeCodePreview()
        }
    }

    public async removeVersion(version: VCSVersion): Promise<void> {
        this.preview.removeVersion(version)
        await this.removenFromCodePreview(version)
    }

    public async removeVersions(): Promise<void> {
        this.preview.removeVersions()
        await this.removeCodePreview()
    }

    public async remove(): Promise<void> {
        await this.removeVersions()
        this.previewContainer.remove()
        this.codeContainer.remove()
        super.remove()
    }
}