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

    private cachedLineNumber: number
    protected override get lineNumber(): number {
        if (!this.mouseOn || !this.cachedLineNumber) { this.cachedLineNumber = this.snapshot.endLine + 1 }
        return this.cachedLineNumber 
    }

    protected override get lineCount(): number {
        return 2
    }

    private cachedContentRange: IRange
    protected override contentRange(): IRange {
        if (!this.mouseOn || !this.cachedContentRange) {
            const endLine = this.locator.range.endLineNumber
            this.cachedContentRange = new Range(endLine + 1, 1, endLine + this.lineCount, Number.MAX_SAFE_INTEGER)
        }
        return this.cachedContentRange
    }

    protected override setupContent(container: HTMLElement): void {
        this.slider = new Slider(container, this.snapshot.snapshot.uuid, 0, this.versionCount - 1, this.versionIndex)
    }

    public updateSlider(): void {
        this.slider.update(0, this.versionCount - 1, this.versionIndex)
    }

    public onChange(callback: (value: number) => void): Disposable {
        return this.addSubscription(this.slider.onChange(callback))
    }
}