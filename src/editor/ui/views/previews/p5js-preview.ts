import { Synchronizable, Synchronizer } from "../../../utils/synchronizer";
import { Disposable } from "../../../utils/types";
import { uuid } from "../../../utils/uuid";
import { CodeProvider, CodeProviderPreview } from "./preview";
import { iframeResize } from "iframe-resizer"

export class P5JSPreview extends CodeProviderPreview {

    private static p5jsScript          = new URL("./libs/p5js/p5.min.js", document.baseURI).href
    private static iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", document.baseURI).href

    private readonly uuid: string = uuid(16)

    private readonly container: HTMLDivElement

    private currentCode?: string

    private iframeVisible = false
    private iframe:       HTMLIFrameElement
    
    private hasErrorMessage = false
    private errorMessage: HTMLDivElement

    private readonly errorMessageColor: string

    private resizeObserver?: ResizeObserver
    private onResizeCallbacks: {(width: number, height: number, scaleFactor: number): void}[] = []

    private get id(): string { return `p5js-preview-${this.uuid}` }

    public get style():         CSSStyleDeclaration { return this.container.style }
    public get iFrameResizer(): any | undefined     { return (this.iframe as any).iFrameResizer }

    private readonly padding:   number
    private readonly minWidth:  number
    private readonly minHeight: number

    constructor(root: HTMLElement, options?: { provider?: CodeProvider, padding?: number, minWidth?: number, minHeight?: number, errorMessageColor?: string, synchronizer?: Synchronizer }) {
        super(root, options)
        this.padding           = options?.padding           ? options.padding           : 0
        this.minWidth          = options?.minWidth          ? options.minWidth          : 50
        this.minHeight         = options?.minHeight         ? options.minHeight         : 50
        this.errorMessageColor = options?.errorMessageColor ? options.errorMessageColor : "black"

        this.container = document.createElement("div")
        this.style.position  = "relative"
        this.style.boxSizing = "border-box"
        this.style.width     = "100%"
        this.style.height    = "100%"
        this.style.padding   = `${this.padding}px`
        this.style.margin    = "0"
        this.root.appendChild(this.container)

        // setup iframe
        this.iframe = document.createElement("iframe") as HTMLIFrameElement
        this.iframe.id = this.id
        this.iframe.frameBorder = "0"
        this.iframe.style.position  = "absolute"
        this.iframe.style.top       = "50%"
        this.iframe.style.left      = "50%"
        this.iframe.style.transform = "translate(-50%, -50%)"
        this.iframe.style.padding = "0"
        this.iframe.style.margin  = "0"
        this.iframe.style.border  = "none"

        // setup div for error message, should it be needed
        this.errorMessage = document.createElement("div")
        this.errorMessage.style.display   = "inline-block"
        this.errorMessage.style.boxSizing = "border-box"
        this.errorMessage.style.width     = "100%"
        this.errorMessage.style.height    = "100%"
        this.errorMessage.style.padding   = "3px"
        this.errorMessage.style.color     = this.errorMessageColor
        this.errorMessage.style.border    = `1px solid ${this.errorMessageColor}`

        if (this.provider) { this.render() }
    }

    private async getHtml(code: string): Promise<string> {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>p5.js Live Preview</title>
                <script src="${P5JSPreview.p5jsScript}"></script>

                <style>
                    html, body { padding: 0; margin: 0; }
                </style>
            </head>
            <body>

                <script>
                    let sentErrorState  = false
                    let hasErrorMessage = false
                    let errorMessage    = undefined
                    let errorStack      = undefined

                    function sendErrorMessage() {
                        const iframe = window.parentIFrame
                        if (hasErrorMessage && !sentErrorState && iframe) {
                            iframe.sendMessage({ hasErrorMessage: true, message: errorMessage, stack: errorStack })
                            sentErrorState = true
                        }
                    }

                    function createErrorMessage(error) {
                        hasErrorMessage = true
                        errorMessage    = error.message
                        errorStack      = error.stack

                        sendErrorMessage()
                    }

                    // setup config object of iFrameResizer
                    window.iFrameResizer = {
                        onReady: () => { sendErrorMessage() }
                    }
                </script>
                <script src="${P5JSPreview.iframeResizerScript}"></script>

                <script>
                    let pauseTimeoutId = undefined
                    function playP5() {
                        if (pauseTimeoutId) {
                            clearTimeout(pauseTimeoutId)
                            pauseTimeoutId = undefined
                        }

                        loop()
                    }

                    function pauseP5(ms) {
                        pauseTimeoutId = setTimeout(() => {
                            noLoop()
                        }, ms)
                    }

                    // not perfect, but gets the job done
                    function stopP5() {
                        noLoop()
                        const p5Canvas = document.getElementsByClassName("p5Canvas")
                        for (let i = 0; i < p5Canvas.length; i++) { p5Canvas[i].remove() }
                    }

                    const code = ${JSON.stringify(code)}

                    if (!code.includes("setup") || !code.includes("draw")) {
                        createErrorMessage({ message: "Your code must include a 'setup' and a 'draw' function to be rendered in this P5JS preview.", stack: "" })
                    } else {
                        try {
                            eval(code)

                            const userSetup = window.setup
                            const userDraw  = window.draw

                            if (userSetup && userDraw) {
                                window.setup = () => {
                                    try {
                                        userSetup.call(this);
                                    } catch (error) {
                                        stopP5()
                                        createErrorMessage(error)
                                    }
                                }

                                window.draw = () => {
                                    try {
                                        userDraw.call(this);
                                    } catch (error) {
                                        stopP5()
                                        createErrorMessage(error)
                                    }
                                }

                                window.addEventListener("mousedown", (event) => { playP5() })
                                window.addEventListener("mouseup", (event) => { pauseP5(3000) })
                                pauseP5(3000)
                            } else {
                                window.setup = undefined
                                window.draw  = undefined
                                createErrorMessage(error)
                            }

                        } catch (error) {
                            createErrorMessage(error)
                        }
                    }
                </script>

                <script>
                    // workaround to allow the use of taggedElement for width calculation when sizing the iframe
                    window.addEventListener("load", event => {
                        const p5Canvas = document.getElementsByClassName("p5Canvas")
                        if (p5Canvas.length > 0) {
                            for (let i = 0; i < p5Canvas.length; i++) { p5Canvas[i].setAttribute("data-iframe-width", "") }
                        } else {
                            const sizingDiv = document.createElement("div")
                            sizingDiv.setAttribute("data-iframe-width", "")
                            document.body.appendChild(sizingDiv)
                        }
                    })
                </script>
            </body>
            </html>
        `
    }

    private async getHtmlUrl(code: string): Promise<string> {
        const htmlBlob = new Blob([await this.getHtml(code)], { type: 'text/html' });
        return URL.createObjectURL(htmlBlob);
    }

    private padValue(value: number): number {
        return value - 2 * this.padding
    }

    private unpadValue(value: number): number {
        return value + 2 * this.padding
    }

    private getContentWidth(): number {
        return this.padValue(Math.max(parseFloat(window.getComputedStyle(this.container).width), this.minWidth))
    }

    private getContentHeight(): number {
        return this.padValue(Math.max(parseFloat(window.getComputedStyle(this.container).height), this.minHeight))
    }

    private setupResizing(): void {
        
        const onResize = (data: any) => { this.resizeIFrame(data.width, data.height) }
        const onError  = (data: any) => { 

            const error = data.message

            this.hasErrorMessage = error.hasErrorMessage
            if (this.hasErrorMessage) {
                this.hideIFrame()

                this.errorMessage.innerText = `Message:\n${error.message}` + (error.stack && this.getContentHeight() > 300 ? `\n\nStack:\n${error.stack}` : "")
                this.container.appendChild(this.errorMessage)
            }
        }

        this.iframe = iframeResize({ /*log: true,*/ 
                                        checkOrigin: ["file://"], 
                                        sizeWidth: true, 
                                        widthCalculationMethod: "taggedElement",
                                        tolerance: 20, // used to avoid recursive resizing loop over small inaccuracies in size
                                        onResized: onResize,
                                        onMessage: onError
                                   }, `#${this.id}`)[0]

        this.resizeObserver = new ResizeObserver((entries) => {
            if (!this.hasErrorMessage) {
                const width  = parseFloat(this.iframe.style.width)
                const height = parseFloat(this.iframe.style.height)
                this.resizeIFrame(width, height)
            }
        })
        this.resizeObserver.observe(this.container)
    }

    private resizeIFrame(iframeWidth: number, iframeHeight: number): void {
        // includes padding
        const scaleFactor = Math.min(this.getContentWidth() / iframeWidth, this.getContentHeight() / iframeHeight)

        this.iframe.style.transformOrigin = "top left"
        this.iframe.style.transform       = `scale(${scaleFactor}) translate(-50%, -50%)` // translate is used to center element vertically

        const contentWidth  = iframeWidth  * scaleFactor
        const contentHeight = iframeHeight * scaleFactor

        /*
        console.log("CURRENT")
        console.log(iframeWidth)
        console.log(iframeHeight)
        console.log("DESIRED")
        console.log(displayWidth)
        console.log(displayHeight)
        console.log("---------------------")
        */

        // these values are padded, meaning they assume a padding will be added around them
        const displayWidth  = this.unpadValue(contentWidth)
        const displayHeight = this.unpadValue(contentHeight)

        this.onResizeCallbacks.forEach(callback => callback(displayWidth, displayHeight, scaleFactor))
    }

    public onResize(callback: (width: number, height: number, scaleFactor: number) => void): Disposable {
        this.onResizeCallbacks.push(callback)

        const parent = this

        return this.addSubscription({
            dispose(): void {
                const index = parent.onResizeCallbacks.indexOf(callback, 0)
                if (index > -1) { parent.onResizeCallbacks.splice(index, 1) }
            }
        })
    }

    private hideIFrame(): void {
        if (this.iframeVisible) {
            this.resizeObserver?.disconnect()
            this.iFrameResizer?.close()
            this.iframe.remove()

            this.resizeObserver = undefined
            this.iframeVisible  = false
        }
    }

    public showIFrame(): void {
        if (!this.iframeVisible) {
            let loadHandler: () => void
            loadHandler = () => {
                this.iframe.removeEventListener("load", loadHandler)
                this.setupResizing()
            }

            this.iframe.addEventListener("load", loadHandler)
            this.container.appendChild(this.iframe)

            this.iframeVisible = true
        }
    }

    public override async sync(trigger: Synchronizable): Promise<void> {
        await this.render()
    }

    public override async render(): Promise<void> {
        if (!this.provider) { return }

        const code = await this.getCode()
        if (code && this.currentCode !== code) {
            this.iframe.src = await this.getHtmlUrl(code)
            this.currentCode = code

            if (this.hasErrorMessage) {
                this.errorMessage.remove()
                this.hasErrorMessage = false
            }

            this.showIFrame()
        }
    }

    public override remove(): void {
        this.showIFrame()
        this.errorMessage.remove()
        super.remove()
    }
}