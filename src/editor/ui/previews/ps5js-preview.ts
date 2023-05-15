import { uuid } from "../../utils/uuid";
import { CodePreview } from "./preview";
import { iframeResize } from "iframe-resizer"

export class P5JSPreview extends CodePreview {

    private static p5jsScript = new URL("./libs/p5js/p5.min.js", document.baseURI).href
    private static iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", document.baseURI).href

    private readonly uuid: string = uuid(16)

    private readonly iframe: HTMLIFrameElement

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
                    function createErrorMessage(text) {
                        const errorMessage = document.createElement("div")

                        errorMessage.setAttribute("data-iframe-width", "")
                        errorMessage.innerText = text

                        document.body.appendChild(errorMessage);
                    }

                    const code = ${JSON.stringify(this.code)}

                    if (!code.includes("setup") || !code.includes("draw")) {
                        createErrorMessage("Your code must include a setup and a draw function to be rendered in this P5JS preview.")
                    } else {
                        try {
                            eval(code)
                        } catch (error) {
                            createErrorMessage(error.message)
                        }
                    }
                </script>

                <script>
                    // workaround to allow the use of taggedElement for width calculation when sizing the iframe
                    window.addEventListener("load", event => {
                        p5Canvas = document.getElementsByClassName("p5Canvas")
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

    public get iframeStyle(): CSSStyleDeclaration {
        return this.iframe.style
    }

    constructor(root: HTMLElement, code?: string) {
        super(root, code)

        this.iframe = document.createElement("iframe") as HTMLIFrameElement
        this.iframe.id = this.id

        if (code) { this.render() }
    }

    private startSetup = true
    private setup(): void {
        this.root.appendChild(this.iframe)

        const onResize = (messageData) => {

            const computedStyle = window.getComputedStyle(this.root);
            const width = parseFloat(computedStyle.width) - 20;
            const height = parseFloat(computedStyle.height) - 20;

            const scaleFactor = Math.min(width / messageData.width, height / messageData.height)

            this.iframe.style.transformOrigin = "0 0"
            this.iframe.style.transform = `scale(${scaleFactor}, ${scaleFactor})`
        }

        iframeResize({ /*log: true,*/ checkOrigin: ["file://"], sizeWidth: true, widthCalculationMethod: 'taggedElement', onResized: onResize }, `#${this.id}`)

        this.startSetup = false
    }

    public override async render(): Promise<void> {
        if (this.startSetup) { this.setup() }
        this.iframe.src = this.htmlUrl
    }
}