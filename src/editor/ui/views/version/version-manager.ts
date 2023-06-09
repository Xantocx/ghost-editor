import { VCSVersion } from "../../../../app/components/data/snapshot"
import { View } from "../view"
import { VersionGridView } from "./version-grid-view"
import { VersionCodeViewList } from "./version-code-view"
import { IVCSVersionViewContainer } from "./version-view"
import { Synchronizer } from "../../../utils/synchronizer"
import { SessionFactory, VCSSession } from "../../../../app/components/vcs/vcs-provider"

export interface ViewVersion extends VCSVersion {
    session: VCSSession
}

export class VersionManagerView extends View implements IVCSVersionViewContainer {

    private readonly sessionFactory: SessionFactory
    private readonly versions = new Map<VCSVersion, ViewVersion>()

    private readonly previewContainer: HTMLDivElement
    private readonly codeContainer:    HTMLDivElement

    private readonly preview: VersionGridView
    private readonly code:    VersionCodeViewList
    
    public get previewStyle(): CSSStyleDeclaration { return this.previewContainer.style }
    public get codeStyle():    CSSStyleDeclaration { return this.codeContainer.style }

    public constructor(root: HTMLElement, sessionFactory: SessionFactory, options?: { languageId?: string, synchronizer?: Synchronizer, versions?: VCSVersion[] }) {
        super(root)
        this.sessionFactory = sessionFactory

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
        this.code    = new VersionCodeViewList(this.codeContainer, options?.languageId, options?.synchronizer)
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

        if (options?.versions) { this.showVersions(options?.versions) }
    }

    public getVersions(): ViewVersion[] { return Array.from(this.versions.values()) }

    public setLanguageId(languageId: string): void { this.code.setLanguageId(languageId) }

    private async createSession(version: VCSVersion): Promise<VCSSession> {
        const result  = await this.sessionFactory.createSession({ tagId: version.tagId })
        return result.session
    }

    private async replaceViewVersions(versions: VCSVersion[]): Promise<void> {
        this.removeViewVwersions()
        await Promise.all(versions.map(async version => await this.addViewVersion(version)))
    }

    private async addViewVersion(version: VCSVersion): Promise<ViewVersion> {
        const session = await this.createSession(version)
        const viewVersion = {
            blockId:             version.blockId,
            tagId:               version.tagId,
            name:                version.name,
            text:                version.text,
            automaticSuggestion: version.automaticSuggestion,
            session:             session
        }

        this.versions.set(version, viewVersion)
        return viewVersion
    }

    private async removeViewVersion(version: VCSVersion): Promise<void> {
        this.versions.get(version)?.session?.close()
        this.versions.delete(version)
    }

    private removeViewVwersions(): void {
        this.getVersions().forEach(version => version.session.close())
        this.versions.clear()
    }

    public async showVersions(versions: VCSVersion[]): Promise<void> {
        this.replaceViewVersions(versions)

        this.preview.showVersions(this.getVersions())
        //this.code.showVersions(versions)
    }

    public async addVersion(version: VCSVersion): Promise<void> {
        const viewVersion = await this.addViewVersion(version)
        
        this.preview.addVersion(viewVersion)
        //this.code.addVersion(viewVersion)
    }

    public applyDiff(versions: VCSVersion[]): void {
        const removedVersions = this.preview.applyDiff(versions)
        removedVersions.forEach(version => {
            this.code.removeVersion(version)
            this.removeViewVersion(version)
        })
    }

    public removeVersion(version: VCSVersion): void {
        this.preview.removeVersion(version)
        this.code.removeVersion(version)

        this.removeViewVersion(version)
    }

    public removeVersions(): void {
        this.preview.removeVersions()
        this.code.removeVersions()

        this.removeViewVwersions()
    }

    public override remove(): void {
        this.removeVersions()
        this.previewContainer.remove()
        this.codeContainer.remove()
        super.remove()
    }
}