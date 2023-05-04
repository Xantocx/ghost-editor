import { GhostSnapshotBanner } from "../widgets/snapshot-banner";
import { Disposable, IRange } from "../../utils/types";
import { Range } from "monaco-editor";
import { Slider } from "../components/slider";

export class GhostSnapshotFooter extends GhostSnapshotBanner {

    private slider: Slider

    private get versionCount(): number {
        return this.snapshot.snapshot.versionCount
    }

    private get versionIndex(): number {
        return this.snapshot.snapshot.versionIndex
    }

    protected override get lineNumber(): number {
        return this.snapshot.endLine + 1
    }

    protected override get lineCount(): number {
        return 2
    }

    protected override contentRange(): IRange {
        const endLine = this.locator.range.endLineNumber
        return new Range(endLine + 1, 1, endLine + this.lineCount, Number.MAX_SAFE_INTEGER)
    }

    protected override setupContent(container: HTMLElement): void {

        // center slider
        container.style.display = "flex"
        container.style.justifyContent = "center"
        container.style.alignItems = "center"
        container.style.height = "100vh"

        // build slider
        this.slider = new Slider(container, this.snapshot.snapshot.uuid, 0, this.versionCount - 1, this.versionIndex)
    }

    public updateSlider(): void {
        this.slider.update(0, this.versionCount - 1, this.versionIndex)
    }

    public onChange(callback: (value: number) => void): Disposable {
        return this.addSubscription(this.slider.onChange(callback))
    }
}