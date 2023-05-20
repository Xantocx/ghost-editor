import { Disposable } from "../../../utils/types";
import { uuid } from "../../../utils/uuid";
import { CodePreview } from "./preview";
import { iframeResize } from "iframe-resizer"


export interface SizeConstraints {
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    padding?: number
}

export class P5JSPreview extends CodePreview {

    private static p5jsScript = new URL("./libs/p5js/p5.min.js", document.baseURI).href
    private static iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", document.baseURI).href

    private readonly uuid: string = uuid(16)

    private readonly iframeContainer: HTMLDivElement
    private iframe: HTMLIFrameElement

    private readonly sizeConstraints?: SizeConstraints
    private readonly errorMessageColor: string

    private onResizeCallbacks: {(width: number, height: number, scaleFactor: number): void}[] = []

    private get id(): string {
        return `p5js-preview-${this.uuid}`
    }

    private get html(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>p5.js Live Preview</title>
                <script src="${P5JSPreview.p5jsScript}"></script>
                <script src="${P5JSPreview.iframeResizerScript}"></script>
            </head>
            <body>

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
                        ${this.maxHeight ? 'errorMessage.style.display = "inline-block"' : ""}
                        errorMessage.style.${this.maxWidth  ? "width"  : "maxWidth"}  = "${this.desiredWidth  - 8}px" // -8 for message padding and border
                        errorMessage.style.${this.maxHeight ? "height" : "maxHeight"} = "${this.desiredHeight - 8}px" // -8 for message padding and border
                        errorMessage.style.padding = "3px 3px"
                        errorMessage.style.color = "${this.errorMessageColor}"
                        errorMessage.style.border = "1px solid ${this.errorMessageColor}"

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
                                        createErrorMessage("Message: " + error.message${this.desiredHeight > 300 ? ' + "\\n\\nStack:\\n\\n" + error.stack' : "" })
                                    }
                                }

                                window.draw = () => {
                                    try {
                                        userDraw.call(this);
                                    } catch (error) {
                                        stopP5()
                                        createErrorMessage("Message: " + error.message${this.desiredHeight > 300 ? ' + "\\n\\nStack:\\n\\n" + error.stack' : "" })
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

    public get style(): CSSStyleDeclaration {
        return this.iframe.style
    }

    public get iFrameResizer(): any | undefined {
        return (this.iframe as any).iFrameResizer
    }

    private get padding(): number {
        return this.sizeConstraints?.padding ? this.sizeConstraints.padding : 0
    }

    private get minWidth(): number {
        return this.sizeConstraints?.minWidth ? this.sizeConstraints.minWidth : 50
    }

    private get minHeight(): number {
        return this.sizeConstraints?.minHeight ? this.sizeConstraints.minHeight : 50
    }

    private get maxWidth(): number | undefined {
        return this.sizeConstraints?.maxWidth
    }

    private get maxHeight(): number | undefined {
        return this.sizeConstraints?.maxHeight
    }

    private get desiredWidth(): number {
        const rootWidth = Math.max(parseFloat(window.getComputedStyle(this.root).width), this.minWidth)
        return this.padValue(this.maxWidth ? Math.min(this.maxWidth, rootWidth) : rootWidth)
    }

    private get desiredHeight(): number {
        const rootHeight = Math.max(parseFloat(window.getComputedStyle(this.root).height), this.minHeight)
        return this.padValue(this.maxHeight ? Math.min(this.maxHeight, rootHeight) : rootHeight)
    }

    constructor(root: HTMLElement, code?: string, sizeConstraints?: SizeConstraints, errorMessageColor?: string) {
        super(root, code)
        this.sizeConstraints = sizeConstraints
        this.errorMessageColor = errorMessageColor ? errorMessageColor : "black"

        this.iframeContainer = document.createElement("div")
        this.iframeContainer.style.position = "relative"
        this.iframeContainer.style.width  = "100%"
        this.iframeContainer.style.height = "100%"
        this.iframeContainer.style.minWidth = `${this.minWidth}px`
        this.iframeContainer.style.maxWidth = `${this.maxWidth}px`
        this.iframeContainer.style.minHeight = `${this.minHeight}px`
        this.iframeContainer.style.maxHeight = `${this.maxHeight}px`
        this.iframeContainer.style.overflow = "hidden"
        this.root.appendChild(this.iframeContainer)

        this.iframe = document.createElement("iframe") as HTMLIFrameElement
        this.iframe.id = this.id
        this.iframe.frameBorder = "0"

        // make sure preview is displayed with minimal unused space
        this.style.position = "absolute"
        this.style.top = "50%"
        this.style.left = "50%"
        this.style.width = "100%"
        this.style.height = "100%"
        this.style.transform = "translate(-50%, -50%)"

        this.style.padding = "0 0"
        this.style.margin = "0 0"
        this.style.border = "none"

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

    private setupResizing(): void {
        const onResize  = (data: any) => { this.resize(data.width, data.height) }
        this.iframe = iframeResize({ /*log: true,*/ 
                                        checkOrigin: ["file://"], 
                                        sizeWidth: true, 
                                        widthCalculationMethod: "taggedElement",
                                        tolerance: 20, // used to avoid recursive resizing loop over small inaccuracies in size
                                        onResized: onResize
                                   }, `#${this.id}`)[0]

        window.addEventListener("resize", (event) => {
            const width  = parseFloat(this.iframe.style.width)
            const height = parseFloat(this.iframe.style.height)
            this.resize(width, height)
        })
    }

    private resize(iframeWidth: number, iframeHeight: number): void {
        //console.log(`RESIZE ID ${this.id}`)

        const scaleFactor = Math.min(this.desiredWidth / iframeWidth, this.desiredHeight / iframeHeight)

        this.style.transformOrigin = "top left"
        this.style.transform = `scale(${scaleFactor}) translate(-50%, -50%)` // translate is used to center element vertically

        // these values are padded, meaning they assume a padding will be added around them
        const displayWidth  = this.unpadValue(iframeWidth  * scaleFactor)
        const displayHeight = this.unpadValue(iframeHeight * scaleFactor)

        /*
        console.log("CURRENT")
        console.log(iframeWidth)
        console.log(iframeHeight)
        console.log("DESIRED")
        console.log(displayWidth)
        console.log(displayHeight)
        console.log("---------------------")
        */

        // TODO: SCALE DOWN UNUSED DISPLAY WIDTH!

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

    public override async render(): Promise<void> {
        this.iframe.src = this.htmlUrl
    }

    public override remove(): void {
        this.iFrameResizer?.close()
        super.remove()
    }
}