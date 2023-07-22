import React, { useRef, useState, useEffect } from 'react'
import IframeResizer from 'iframe-resizer-react'

import { Synchronizer, Sync } from "../../../../utils/synchronizer"
import { CodeProvider } from "../preview";
import { uuid } from "../../../../utils/uuid"
import { throttle } from "../../../../utils/helpers"

import "./react-p5js-preview.css"

const p5jsScript          = new URL("./libs/p5js/p5.min.js", document.baseURI).href
const iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", document.baseURI).href

function getHtml(sketchId: string, code: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>p5.js Live Preview</title>

            <script src="${p5jsScript}"></script>

            <style>
                html, body {
                    padding: 0; margin: 0;
                }

                canvas {
                    display: block;
                }
            </style>
        </head>
        <body>

            <script>
                const code = ${JSON.stringify(code)}

                let preparedMessage = undefined

                function sendMessage(type, message) {
                    const iframe = window.parentIFrame
                    if (iframe) {
                        iframe.sendMessage({ sketchId: "${sketchId}", type, message })
                    }
                }

                function sendSuccessMessage() {
                    preparedMessage = { type: "success", message: { code } })
                }

                function sendSyntaxError(error) {
                    preparedMessage = { type: "syntax-error", message: { description: error.message, stack: error.stack } })
                }

                function sendRuntimeError(error) {
                    sendMessage("runtime-error", { description: error.message, stack: error.stack, code })
                }

                // setup config object of iFrameResizer
                window.iFrameResizer = {
                    onReady: () => { if (preparedMessage) { sendMessage(preparedMessage.type, preparedMessage.message) } }
                }

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

            <script src="${iframeResizerScript}"></script>

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

                if (!code.includes("setup") || !code.includes("draw")) {
                    sendSyntaxError({ message: "Your code must include a 'setup' and a 'draw' function to be rendered in this P5JS preview.", stack: "" })
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
                                    sendRuntimeError(error)
                                }
                            }

                            window.draw = () => {
                                try {
                                    userDraw.call(this);
                                } catch (error) {
                                    stopP5()
                                    sendRuntimeError(error)
                                }
                            }

                            window.addEventListener("mousedown", (event) => { playP5() })
                            window.addEventListener("mouseup", (event) => { pauseP5(3000) })
                            pauseP5(3000)
                        } else {
                            window.setup = undefined
                            window.draw  = undefined
                            sendSyntaxError(error)
                        }

                    } catch (error) {
                        sendSyntaxError(error)
                    }


                }
            </script>
        </body>
        </html>
    `
}

function getHtmlUrl(sketchId: string, code: string): string {
    const htmlBlob = new Blob([getHtml(sketchId, code)], { type: 'text/html' });
    return URL.createObjectURL(htmlBlob);
}



interface P5JSPreviewProps {
    synchronizer: Synchronizer,
    codeProvider: CodeProvider,
    errorMessageColor?: string
}

const P5JSPreview: React.FC<P5JSPreviewProps> = ({ synchronizer, codeProvider, errorMessageColor }) => {

    const containerRef                    = useRef<HTMLDivElement | null>(null)
    const iframeRef                       = useRef<HTMLIFrameElement | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

    function renderSketch(sketchId: string, code: string) {
        const iframe = iframeRef.current
        if (iframe) {
            iframe.src = getHtmlUrl(sketchId, code)
        }
    }

    let lastWorkingSketch: { sketchId: string, code: string }
    function renderLastWorkingSketch(): void {
        renderSketch(lastWorkingSketch.sketchId, lastWorkingSketch.code)
    }

    let latestSketchId:  string
    function updateCode(code: string): void {
        latestSketchId = uuid(32)
        setErrorMessage(undefined)
        renderSketch(latestSketchId, code)
    }

    const updateCodeThrottled = throttle(updateCode, 500)

    useEffect(() => {
        const sync = synchronizer.registerSync(async () => {
            const code = await codeProvider.getCode()
            updateCodeThrottled(code)
        })
    
        return () => {
            sync.dispose()
        };
    }, []);

    function onMessage({ message: { type, sketchId, message }}: { iframe: IframeResizer.IFrameComponent, message: { type: string, sketchId: string, message: any } }): void {
        if (sketchId !== latestSketchId) { return }

        if (type !== "success" && type !== "syntax-error" && type !== "runtime-error") {
            throw new Error(`"${type}" is not a valid message type for the P5JSPreview!`)
        }
        
        if (type === "success" || type === "runtime-error") {
            lastWorkingSketch = { sketchId, code: message.code }
        }

        if (type === "syntax-error" || type === "runtime-error") {
            const description = message.description
            const stack       = message.stack
            setErrorMessage(`Message:\n${description}` + (stack && this.getContentHeight() > 300 ? `\n\nStack:\n${stack}` : ""))
        }

        if (type === "syntax-error") {
            renderLastWorkingSketch()
        }
    }

    return (
        <div className="container" ref={containerRef} style={{ padding: 5 }}>
            <IframeResizer
                forwardRef={iframeRef}
                checkOrigin={["file://"]}
                sizeWidth={true}
                heightCalculationMethod='taggedElement'
                tolerance={20}
                log
                onMessage={onMessage}
            />
            <div className='error-message' style={{ color: errorMessageColor ? errorMessageColor : "black", border: `1px solid ${errorMessageColor ? errorMessageColor : "black"}` }}>{errorMessage ? errorMessage : ""}</div>
        </div>
    )
}

export default P5JSPreview