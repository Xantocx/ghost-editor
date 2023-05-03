import { GhostSnapshotHeader } from "./header";
import { LineLocator } from "../../utils/line-locator";
import { IRange } from "../../utils/types";
import { Range } from "monaco-editor";
import { Slider } from "../components/slider";

export class GhostSnapshotFooter extends GhostSnapshotHeader {

    private slider: Slider

    protected override get lineNumber(): number {
        return this.snapshot.endLine + 1
    }

    protected override get lineCount(): number {
        return 2
    }

    protected override get contentLocator(): LineLocator {

        if (!this._contentLocator) {
            const parent = this
            return new LineLocator(this.locator.referenceProvider, {
                get range(): IRange {
                    const endLine = parent.locator.range.endLineNumber
                    return new Range(endLine + 1, 1, endLine + parent.lineCount, Number.MAX_SAFE_INTEGER)
                }
            })
        }

        return this._contentLocator
    }

    protected override setupContent(container: HTMLElement): void {

        // center slider
        container.style.display = "flex"
        container.style.justifyContent = "center"
        container.style.alignItems = "center"
        container.style.height = "100vh"

        // build slider
        this.slider = new Slider(container, this.snapshot.snapshot.uuid, 0, 100, 50)
        this.slider.onChange(value => {
            console.log(value)
        })
    }
}