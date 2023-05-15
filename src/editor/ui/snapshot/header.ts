import { GhostSnapshotBanner } from "../widgets/snapshot-banner"
import { IRange } from "../../utils/types"
import { Range } from "monaco-editor"
import { SideScrollButtonList } from "../components/side-scroll-button-list"
import { Button } from "../components/button"

export class GhostSnapshotHeader extends GhostSnapshotBanner {

    private versionList: SideScrollButtonList

    protected override get lineNumber(): number {
        return this.snapshot.startLine
    }

    protected override get lineCount(): number {
        return 3
    }

    protected override contentRange(): IRange {
        const startLine = this.locator.range.startLineNumber
        return new Range(startLine - this.lineCount, 1, startLine - 1, Number.MAX_SAFE_INTEGER)
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

        const addButton = Button.addButton(addButtonDiv, () => { console.log("Safe Version!") })

        container.appendChild(addButtonDiv)
    }

    private createVersionList(container: HTMLElement, elements: string[]): SideScrollButtonList {
        const versionDiv = document.createElement("div")
        versionDiv.style.flexGrow = "1"
        versionDiv.style.overflow = "hidden"
        versionDiv.style.height = "100%"

        container.appendChild(versionDiv)

        return new SideScrollButtonList(versionDiv, elements)
    }
}