import InlineEditorBanner from "../widgets/inline-editor-banner";
import { Disposable, IRange } from "../../../data-types/convenience/monaco";
import { Range } from "monaco-editor";

import React from "react"
import './footer.css'

import LoadingView, { LoadingEventEmitter } from "../../react/loadingView"
import { Root, createRoot } from "react-dom/client"

import { TextButton, TextButtonProps } from "../../basics/react-button"
import Slider, { SliderProps } from "../../basics/slider"
import { VCSBlockSession } from "../../../../vcs/provider";


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


export default class GhostSnapshotFooter extends InlineEditorBanner {

    public static readonly loadingEventEmitter = new LoadingEventEmitter()

    private get session(): VCSBlockSession { return this.snapshot.session }

    private get versionCount(): number { return this.snapshot.snapshot.versionCount }
    private get versionIndex(): number { return this.snapshot.snapshot.versionIndex }

    private loadingViewRoot?: Root

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
        return this.cachedContentRange
    }

    private cachedOverlayWidth?: number
    protected override getOverlayWidth(): number {
        if (!this.mouseOn || !this.cachedOverlayWidth) { this.cachedOverlayWidth = super.getOverlayWidth() }
        return this.cachedOverlayWidth
    }

    protected override setupContent(container: HTMLElement): void {
        
        const onButtonClick = () => {
            this.buttonCallbacks.forEach(callback => callback())
        }

        const onSliderChange = (value: number) => {
            this.sliderCallbacks.forEach(callback => callback(value))
        }

        this.loadingViewRoot = createRoot(container)
        this.loadingViewRoot.render(<LoadingView loadData={async () => {
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

    private readonly buttonCallbacks: {(): void}[] = []
    public onClick(callback: () => void): Disposable {

        this.buttonCallbacks.push(callback)

        return this.addSubscription({
            dispose: () => {
                const index = this.buttonCallbacks.indexOf(callback)
                if (index > -1) { this.buttonCallbacks.splice(index, 1) }
            },
        })
    }

    private readonly sliderCallbacks: {(value: number): void}[] = []
    public onChange(callback: (value: number) => void): Disposable {

        this.sliderCallbacks.push(callback)

        return this.addSubscription({
            dispose: () => {
                const index = this.sliderCallbacks.indexOf(callback)
                if (index > -1) { this.sliderCallbacks.splice(index, 1) }
            },
        })
    }

    public override remove(): void {
        this.loadingViewRoot?.unmount()
        this.loadingViewRoot = undefined
        super.remove()
    }
}