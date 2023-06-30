import { InlineEditorBanner } from "../widgets/inline-editor-banner"
import { IRange } from "../../utils/types"
import { Range } from "monaco-editor"
import { SideScrollVersionList } from "../components/version-list"
import { Button } from "../components/button"
import { VCSVersion } from "../../../app/components/data/version"

export class GhostSnapshotHeader extends InlineEditorBanner {

    private versionList: SideScrollVersionList

    protected override get lineNumber(): number {
        return this.snapshot.startLine
    }

    protected override get lineCount(): number {
        return 5
    }

    protected override getContentRange(): IRange {
        const startLine = this.locator.range.startLineNumber
        return new Range(startLine - this.lineCount, 1, startLine - 1, Number.MAX_SAFE_INTEGER)
    }

    private get computedHeaderHeight(): number {
        return this.editor.lineHeight * this.lineCount
    }

    protected override setupContent(container: HTMLElement): void {

        // container style to allow for auto resizing of sub-elements
        container.style.display = "flex"
        container.style.height = "100vh"
        container.style.border = "1px solid black"

        this.createAddButton(container)
        this.versionList = this.createVersionList(container, [])
    }

    private createAddButton(container: HTMLElement): void {
        const addButtonDiv = document.createElement("div")
        addButtonDiv.style.display = "flex"
        addButtonDiv.style.justifyContent = "center"
        addButtonDiv.style.alignItems = "center"
        addButtonDiv.style.height = "100%"
        addButtonDiv.style.borderRight = "1px solid black"
        container.appendChild(addButtonDiv)

        const addButton = Button.addButton(addButtonDiv, async () => { 
            const version = await this.editor.getSession().saveChildBlockVersion(this.snapshot.vcsId)
            this.versionList.addVersion(new VCSVersion(this.snapshot, version))
            //this.snapshot.updateVersions(this.versionList.versions)
        })
    }

    private createVersionList(container: HTMLElement, elements: VCSVersion[]): SideScrollVersionList {
        const versionDiv = document.createElement("div")
        versionDiv.style.flexGrow = "1"
        versionDiv.style.overflow = "hidden"
        versionDiv.style.height = "100%"
        container.appendChild(versionDiv)


        const list   = new SideScrollVersionList(versionDiv, elements)
        const height = this.computedHeaderHeight - 20

        list.listStyle.height = height + "px"
        return list
    }
}