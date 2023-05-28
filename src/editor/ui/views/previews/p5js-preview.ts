import { sleep } from "../../../utils/helpers";
import { Disposable } from "../../../utils/types";
import { uuid } from "../../../utils/uuid";
import { CodePreview } from "./preview";
import { iframeResize } from "iframe-resizer"

export class P5JSPreview extends CodePreview {

    private static p5jsScript          = new URL("./libs/p5js/p5.min.js", document.baseURI).href
    private static iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", document.baseURI).href

    private readonly uuid: string = uuid(16)

    private readonly iframeContainer: HTMLDivElement
    private iframe: HTMLIFrameElement
    private hasErrorMessage = false

    private readonly errorMessageColor: string

    private onResizeCallbacks: {(width: number, height: number, scaleFactor: number): void}[] = []

    private get id(): string { return `p5js-preview-${this.uuid}` }

    private get html(): string {

        const contentWidth  = this.getContentWidth()
        const contentHeight = this.getContentHeight()

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
                    // setup config object of iFrameResizer
                    window.iFrameResizer = {
                        onReady:   ()   => {
                            window.parentIFrame?.sendMessage(document.getElementById("error-message") !== null)
                        },
                        onMessage: data => {
                            console.log("TEST")
                            console.log(data)
                            const errorMessage = document.getElementById("error-message")
                            if (errorMessage) {
                                errorMessage.style.width  = data.width  + "px"
                                errorMessage.style.height = data.height + "px"
                            }
                        }
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

                    function createErrorMessage(text) {
                        const errorMessage = document.createElement("div")

                        errorMessage.id = "error-message"
                        errorMessage.setAttribute("data-iframe-width", "")
                        errorMessage.innerText = text

                        // the way maxHeight is used should probably be made more explicit
                        errorMessage.style.display   = "inline-block"
                        errorMessage.style.boxSizing = "border-box"
                        errorMessage.style.width     = "${contentWidth}px"
                        errorMessage.style.height    = "${contentHeight}px"
                        errorMessage.style.padding   = "3px"
                        errorMessage.style.color     = "${this.errorMessageColor}"
                        errorMessage.style.border    = "1px solid ${this.errorMessageColor}"

                        document.body.appendChild(errorMessage);
                    }

                    const code = ${JSON.stringify(this.code)}

                    if (!code.includes("setup") || !code.includes("draw")) {
                        createErrorMessage("Your code must include a 'setup' and a 'draw' function to be rendered in this P5JS preview.")
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
                                        createErrorMessage("Message: " + error.message${contentHeight > 300 ? ' + "\\n\\nStack:\\n\\n" + error.stack' : "" })
                                    }
                                }

                                window.draw = () => {
                                    try {
                                        userDraw.call(this);
                                    } catch (error) {
                                        stopP5()
                                        createErrorMessage("Message: " + error.message${contentHeight > 300 ? ' + "\\n\\nStack:\\n\\n" + error.stack' : "" })
                                    }
                                }

                                window.addEventListener("mousedown", (event) => { playP5() })
                                window.addEventListener("mouseup", (event) => { pauseP5(3000) })
                                pauseP5(3000)
                            } else {
                                window.setup = undefined
                                window.draw  = undefined
                                createErrorMessage("Your code must include a 'setup' and a 'draw' function to be rendered in this P5JS preview.")
                            }

                        } catch (error) {
                            createErrorMessage(error.message)
                        }
                    }
                </script>

                <script>
                    // workaround to allow the use of taggedElement for width calculation when sizing the iframe
                    window.addEventListener("load", event => {
                        const p5Canvas = document.getElementsByClassName("p5Canvas")
                        for (let i = 0; i < p5Canvas.length; i++) {
                            p5Canvas[i].setAttribute("data-iframe-width", "")
                        }
                    })
                </script>
            </body>
            </html>
        `
    }

    private get htmlUrl(): string {
        const htmlBlob = new Blob([this.html], { type: 'text/html' });
        return URL.createObjectURL(htmlBlob);
    }

    public get style():         CSSStyleDeclaration { return this.iframeContainer.style }
    public get iFrameResizer(): any | undefined     { return (this.iframe as any).iFrameResizer }

    private readonly padding:   number
    private readonly minWidth:  number
    private readonly minHeight: number

    constructor(root: HTMLElement, options?: { code?: string, padding?: number, minWidth?: number, minHeight?: number, errorMessageColor?: string }) {
        super(root, options?.code)
        this.padding           = options?.padding           ? options.padding           : 0
        this.minWidth          = options?.minWidth          ? options.minWidth          : 50
        this.minHeight         = options?.minHeight         ? options.minHeight         : 50
        this.errorMessageColor = options?.errorMessageColor ? options.errorMessageColor : "black"

        this.iframeContainer = document.createElement("div")
        this.style.position  = "relative"
        this.style.boxSizing = "border-box"
        this.style.width     = "100%"
        this.style.height    = "100%"
        this.style.margin    = "0 0"
        this.style.overflow  = "hidden"
        this.root.appendChild(this.iframeContainer)

        this.iframe = document.createElement("iframe") as HTMLIFrameElement
        this.iframe.id = this.id
        this.iframe.frameBorder = "0"

        // make sure preview is displayed with minimal unused space
        this.iframe.style.position = "absolute"
        this.iframe.style.top       = "50%"
        this.iframe.style.left      = "50%"
        this.iframe.style.width     = "100%"
        this.iframe.style.height    = "100%"
        this.iframe.style.transform = "translate(-50%, -50%)"

        this.iframe.style.padding = "0 0"
        this.iframe.style.margin  = "0 0"
        this.iframe.style.border  = "none"

        let loadHandler: () => void
        loadHandler = () => {
            this.iframe.removeEventListener("load", loadHandler)
            this.setupResizing()
            if (this.code) { this.render() }
        }

        this.iframe.addEventListener("load", loadHandler)
        this.iframeContainer.appendChild(this.iframe)
    }

    private padValue(value: number): number {
        return value - 2 * this.padding
    }

    private unpadValue(value: number): number {
        return value + 2 * this.padding
    }

    private getContentWidth(): number {
        return this.padValue(Math.max(parseFloat(window.getComputedStyle(this.iframeContainer).width), this.minWidth))
    }

    private getContentHeight(): number {
        return this.padValue(Math.max(parseFloat(window.getComputedStyle(this.iframeContainer).height), this.minHeight))
    }

    private setupResizing(): void {
        const onResize  = (data: any) => { this.resize(data.width, data.height) }
        const onMessage = (data: any) => { 
            this.hasErrorMessage = data.message

            if (this.hasErrorMessage) {
                //this.iframe.style.top       = "auto"
                //this.iframe.style.left      = "auto"
                this.iframe.style.transform = "translate(-50%, -50%)"
            }

            this.resizeErrorMessage()
        }
        this.iframe = iframeResize({ /*log: true,*/ 
                                        checkOrigin: ["file://"], 
                                        sizeWidth: true, 
                                        widthCalculationMethod: "taggedElement",
                                        tolerance: 20, // used to avoid recursive resizing loop over small inaccuracies in size
                                        onResized: onResize,
                                        onMessage: onMessage
                                   }, `#${this.id}`)[0]

        window.addEventListener("resize", (event) => {
            const width  = parseFloat(this.iframe.style.width)
            const height = parseFloat(this.iframe.style.height)
            this.resize(width, height)
        })
    }

    private resizeErrorMessage(): void {
        const contentWidth  = this.getContentWidth()
        const contentHeight = this.getContentHeight()

        console.log(contentWidth)

        const displayWidth  = this.unpadValue(contentWidth)
        const displayHeight = this.unpadValue(contentHeight)

        this.iFrameResizer?.sendMessage( { width: contentWidth, height: contentHeight })
        this.onResizeCallbacks.forEach(callback => callback(displayWidth, displayHeight, 1))
    }

    private resize(iframeWidth: number, iframeHeight: number): void {
        if (this.hasErrorMessage) { 
            this.resizeErrorMessage()
        } else {
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

    public override async render(): Promise<void> {
        this.iframe.src = this.htmlUrl
    }

    public override remove(): void {
        this.iFrameResizer?.close()
        super.remove()
    }
}