import { Disposable } from "../../../utils/types";
import { uuid } from "../../../utils/uuid";
import { CodePreview } from "./preview";
import { iframeResize } from "iframe-resizer"


export interface SizeConstraints {
    maxWidth?: number
    maxHeight?: number
    padding?: number
}

export class P5JSPreview extends CodePreview {

    private static p5jsScript = new URL("./libs/p5js/p5.min.js", document.baseURI).href
    private static iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", document.baseURI).href

    private readonly uuid: string = uuid(16)
    private iframe: HTMLIFrameElement

    private readonly sizeConstraints?: SizeConstraints
    private readonly errorMessageColor: string

    private onResizeCallbacks: {(iframe: HTMLIFrameElement, width: number, height: number, scaleFactor: number): void}[] = []

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

                <style>
                    body {
                        padding: ${this.padding}px ${this.padding}px;
                        margin: 0 0;
                    }
                </style>

                <script src="${P5JSPreview.p5jsScript}"></script>
            </head>
            <body>

                <script>
                    // setup config object of iFrameResizer
                    window.iFrameResizer = {
                        onMessage: (data) => {

                            const p5Canvas = document.getElementsByClassName("p5Canvas")
                            const iframe = window.parentIFrame

                            if (data?.width && data?.height) {
                                for (let i = 0; i < p5Canvas.length; i++) {
                                    const canvas = p5Canvas[i]
                                    canvas.style.width  = data.width  + "px"
                                    canvas.style.height = data.height + "px"
                                }

                                // this should handle the size error messages, making sure they are shrinked to the actual width (in case aspect ratio was adjusted for height)
                                const errorMessage = document.getElementById("error-message")
                                if (errorMessage) {
                                    errorMessage.style.maxWidth  = (data.width  - 8) + "px"
                                    errorMessage.style.maxHeight = (data.height - 8) + "px"
                                }

                                // update body size to prevent random overflow that comes up when replacing the canvas with an error message (probably due to internal workings of P5JS)
                                document.body.style.maxWidth  = (data.width)  + "px"
                                document.body.style.maxHeight = (data.height) + "px"
                            } else if (iframe) {
                                let width  = 0
                                let height = 0

                                for (let i = 0; i < p5Canvas.length; i++) {
                                    const canvas = p5Canvas[i]
                                    width  = Math.max(width,  parseFloat(canvas.style.width))
                                    height = Math.max(height, parseFloat(canvas.style.height))
                                }

                                iframe.sendMessage({
                                    width:  width,
                                    height: height
                                })
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

    private get maxWidth(): number | undefined {
        return this.sizeConstraints?.maxWidth
    }

    private get maxHeight(): number | undefined {
        return this.sizeConstraints?.maxHeight
    }

    private get desiredWidth(): number {
        const rootWidth = parseFloat(window.getComputedStyle(this.root).width)
        return this.padValue(this.maxWidth ? Math.min(this.maxWidth, rootWidth) : rootWidth)
    }

    private get desiredHeight(): number {
        const rootHeight = parseFloat(window.getComputedStyle(this.root).height)
        return this.padValue(this.maxHeight ? Math.min(this.maxHeight, rootHeight) : rootHeight)
    }

    constructor(root: HTMLElement, code?: string, sizeConstraints?: SizeConstraints, errorMessageColor?: string) {
        super(root, code)
        this.sizeConstraints = sizeConstraints
        this.errorMessageColor = errorMessageColor ? errorMessageColor : "black"

        this.iframe = document.createElement("iframe") as HTMLIFrameElement
        this.iframe.id = this.id

        // make sure preview is displayed with minimal unused space
        this.iframe.frameBorder = "0"
        this.style.border = "none"
        this.style.padding = "0 0" //`${this.padding}px ${this.padding}px`
        this.style.margin = "0 0"
        this.style.textAlign = "center"

        let loadHandler: () => void
        loadHandler = () => {
            this.iframe.removeEventListener("load", loadHandler)
            this.setupResizing()
            if (this.code) { this.render() }
        }

        this.iframe.addEventListener("load", loadHandler)
        this.root.appendChild(this.iframe)
    }

    private padValue(value: number): number {
        return value - 2 * this.padding
    }

    private unpadValue(value: number): number {
        return value + 2 * this.padding
    }

    private setupResizing(): void {
        const onResize  = (data: any) => { this.resize(data.iframe, data.width,         data.height) }
        const onMessage = (data: any) => { this.resize(data.iframe, data.message.width, data.message.height) }
        this.iframe = iframeResize({ /*log: true,*/ 
                                        checkOrigin: ["file://"], 
                                        sizeWidth: true, 
                                        widthCalculationMethod: "taggedElement",
                                        tolerance: 20, // used to avoid recursive resizing loop over small inaccuracies in size
                                        onResized: onResize,
                                        onMessage: onMessage
                                   }, `#${this.id}`)[0]

        window.addEventListener("resize", (event) => {
            if (this.iFrameResizer) {
                console.log("RESIZE ROOT")
                this.iFrameResizer!.sendMessage(null)
            }
        })
    }

    private resize(iframe: any, renderWidth: number, renderHeight: number): void {
        //console.log(`RESIZE ID ${this.id}`)

        const scaleFactor = Math.min(this.desiredWidth / renderWidth, this.desiredHeight / renderHeight)

        // these values are padded, meaning they assume a padding will be added around them
        const width  = renderWidth  * scaleFactor
        const height = renderHeight * scaleFactor

        // full size of this preview
        const unpaddedWidth  = this.unpadValue(width)
        const unpaddedHeight = this.unpadValue(height)

        console.log("CURRENT")
        console.log(renderWidth)
        console.log(renderHeight)
        console.log("DESIRED")
        console.log(width)
        console.log(height)
        console.log("---------------------")

        iframe.iFrameResizer.sendMessage({ width: width, height: height })
        iframe.style.width  = unpaddedWidth
        iframe.style.height = unpaddedHeight

        this.onResizeCallbacks.forEach(callback => callback(iframe, unpaddedWidth, unpaddedHeight, scaleFactor))

        /*
        this.cachedWidth  = width
        this.cachedHeight = height
        */
    }

    /*
    private cachedWidth?:  number = undefined
    private cachedHeight?: number = undefined
    private cachedResize(): void {
        if (this.iFrameResizer && this.cachedWidth && this.cachedHeight) {
            this.resize(this.iframe, this.cachedWidth, this.cachedHeight)
        }
    }
    */

    public onResize(callback: (iframe: HTMLIFrameElement, width: number, height: number, scaleFactor: number) => void): Disposable {
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