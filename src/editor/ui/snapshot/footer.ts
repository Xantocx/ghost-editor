import { InlineEditorBanner } from "../widgets/inline-editor-banner";
import { Disposable, IRange } from "../../utils/types";
import { Range } from "monaco-editor";
import { Slider } from "../components/slider";
import { Button } from "../components/button";

import { Spinner } from "../views/utils/spinner"
import ReactDOM from "react-dom/client"

export class GhostSnapshotFooter extends InlineEditorBanner {

    private addButton: Button
    private slider: Slider

    private get versionCount(): number { return this.snapshot.snapshot.versionCount }
    private get versionIndex(): number { return this.snapshot.snapshot.versionIndex }

    private cachedLineNumber: number
    protected override get lineNumber(): number {
        if (!this.mouseOn || !this.cachedLineNumber) { this.cachedLineNumber = this.snapshot.endLine + 1 }
        return this.cachedLineNumber 
    }

    protected override get lineCount(): number {
        return 2
    }

    private cachedContentRange?: IRange
    protected override getContentRange(): IRange {
        if (!this.mouseOn || !this.cachedContentRange) {
            const endLine = this.locator.range.endLineNumber
            this.cachedContentRange = new Range(endLine + 1, 1, endLine + this.lineCount, Number.MAX_SAFE_INTEGER)
        }
        return this.cachedContentRange!
    }

    private cachedOverlayWidth?: number
    protected override getOverlayWidth(): number {
        if (!this.mouseOn || !this.cachedOverlayWidth) { this.cachedOverlayWidth = super.getOverlayWidth() }
        return this.cachedOverlayWidth!
    }

    protected override setupContent(container: HTMLElement): void {

        ReactDOM

        /*
        container.style.display = "inline-flex"
        container.style.width   = "100%"
        container.style.height  = "100%"
        container.style.border  = "1px solid black" 

        const buttonContainer = document.createElement("div")
        buttonContainer.style.height      = "100%"
        buttonContainer.style.padding     = "0 0"
        buttonContainer.style.margin      = "0 0"
        buttonContainer.style.borderRight = "1px solid black"
        container.appendChild(buttonContainer)

        this.addButton = Button.addButton(buttonContainer, async () => {
            const version = await this.editor.getSession().saveChildBlockVersion(this.snapshot.vcsId)
            this.snapshot.addVersion(version)
            this.editor.activeSnapshot = this.snapshot
        })

        this.slider = new Slider(container, this.snapshot.snapshot.blockId, 0, this.versionCount - 1, this.versionIndex)
        */
    }

    public updateSlider(): void {
        this.slider.update(0, this.versionCount - 1, this.versionIndex)
    }

    public onChange(callback: (value: number) => void): Disposable {
        return this.addSubscription(this.slider.onChange(callback))
    }
}