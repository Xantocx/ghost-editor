import { GhostSnapshotBanner } from "../widgets/snapshot-banner"
import { IRange } from "../../utils/types"
import { Range } from "monaco-editor"
import { SideScrollButtonList } from "../components/side-scroll-button-list"
import { Button } from "../components/button"

export class GhostSnapshotHeader extends GhostSnapshotBanner {

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

        const addButton = this.createAddButton()
        const customVersions = this.createVersionsList(["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7", "Item 8", "Item 9", "Item 10", "Item 11"], "green")
        const automaticVersions = this.createVersionsList(["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7", "Item 8", "Item 9", "Item 10", "Item 11"], "black")

        container.appendChild(addButton)
        container.appendChild(customVersions)
        container.appendChild(automaticVersions)
    }

    private createAddButton(): HTMLDivElement {
        const addButtonDiv = document.createElement("div")
        addButtonDiv.style.backgroundColor = "red"
        addButtonDiv.style.height = "100%"

        const addButton = new Button(addButtonDiv, "+", () => { console.log("Safe Version!") })
        addButton.style.backgroundColor = "green"
        addButton.style.padding = "5px 10px"
        addButton.style.margin = "5px 5px"

        return addButtonDiv
    }

    private createVersionsList(elements: string[], color: string): HTMLDivElement {
        const versionsDiv = document.createElement("div")
        versionsDiv.style.backgroundColor = color
        versionsDiv.style.flexGrow = "1"
        versionsDiv.style.height = "100%"

        const versionsList = new SideScrollButtonList(versionsDiv, elements)

        return versionsDiv
    }
}