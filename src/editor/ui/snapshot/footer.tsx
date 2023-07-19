import { InlineEditorBanner } from "../widgets/inline-editor-banner";
import { Disposable, IRange } from "../../utils/types";
import { Range } from "monaco-editor";

import React from "react"
import './footer.css'

import LoadingView, { LoadingEventEmitter } from "../views/utils/loadingView"
import { createRoot } from "react-dom/client"

import TextButton, { TextButtonProps } from "../components/react-button"
import Slider, { SliderProps } from "../components/slider"
import { VCSBlockSession } from "../../../app/components/vcs/vcs-rework";


interface FooterContentProps {
    buttonProps?: TextButtonProps
    sliderProps:  SliderProps
}

const FooterContent: React.FC<FooterContentProps> = ({ buttonProps, sliderProps }: FooterContentProps) => {

    buttonProps                       = buttonProps ? buttonProps : { style: {} }
    buttonProps.text                  = "+"
    buttonProps.style.backgroundColor = "green"
    buttonProps.style.color           = "white"
    buttonProps.style.padding         = "5px 10px"
    buttonProps.style.margin          = "5px"

    return (
        <div className="layout-container">
            <div className="button-container">
                <TextButton {...buttonProps} />
            </div>
            <Slider {...sliderProps} />
        </div>
    )
};


export class GhostSnapshotFooter extends InlineEditorBanner {

    public static readonly loadingEventEmitter = new LoadingEventEmitter()

    private get session(): VCSBlockSession { return this.snapshot.session }

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
        
        const onButtonClick = async () => {
            const version = await this.editor.getSession().saveChildBlockVersion(this.snapshot.vcsId)
            this.snapshot.addVersion(version)
            this.editor.activeSnapshot = this.snapshot
        }

        const onSliderChange = (value: number) => {
            this.sliderCallbacks.forEach(callback => callback(value))
        }

        const root = createRoot(container)
        root.render(<LoadingView loadData={async () => {
            await this.session.waitForCurrentRequests();
            return {
                buttonProps: {
                    style:   {},
                    onClick: onButtonClick
                },
                sliderProps: {
                    uuid: this.snapshot.blockId,
                    min: 0,
                    max: this.versionCount - 1,
                    defaultValue: this.versionIndex,
                    onChange: onSliderChange
                }
            } as FooterContentProps
        }} ContentView={FooterContent} loadingEventEmitter={GhostSnapshotFooter.loadingEventEmitter} />)
    }

    public updateSlider(): void {
        GhostSnapshotFooter.loadingEventEmitter.reload()
    }

    private readonly sliderCallbacks: {(value: number): void}[] = []
    public onChange(callback: (value: number) => void): Disposable {

        this.sliderCallbacks.push(callback)

        const parent = this
        return this.addSubscription({
            dispose() {
                const index = parent.sliderCallbacks.indexOf(callback)
                if (index > -1) { parent.sliderCallbacks.splice(index, 1) }
            },
        })
    }
}