import React, { useRef, useState, useEffect } from 'react'
import IframeResizer from 'iframe-resizer-react'

import { styled } from 'styled-components';

import { Synchronizer } from "../../../../utils/synchronizer"
import { CodeProvider } from "../preview";
import { uuid } from "../../../../utils/uuid"
import { throttle } from "../../../../utils/helpers"

import "./react-p5js-preview.css"

const p5jsScript          = new URL("./libs/p5js/p5.min.js", document.baseURI).href
const iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", document.baseURI).href

function getHtml(sketchId: number, code: string): string {
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
                        iframe.sendMessage({ sketchId: ${sketchId}, type, message })
                    } else {
                        preparedMessage = { type, message }
                    }
                }

                function sendSuccessMessage() {
                    sendMessage("success", { code })
                }

                function sendSyntaxError(error) {
                    sendMessage("syntax-error", { description: error.message, stack: error.stack })
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
                            sendSyntaxError({ message: "Your code must include a 'setup' and a 'draw' function to be rendered in this P5JS preview.", stack: "" })
                        }

                        sendSuccessMessage()
                    } catch (error) {
                        sendSyntaxError(error)
                    }
                }
            </script>
        </body>
        </html>
    `
}

function getHtmlUrl(sketchId: number, code: string): string {
    const htmlBlob = new Blob([getHtml(sketchId, code)], { type: 'text/html' });
    return URL.createObjectURL(htmlBlob);
}


interface P5JSPreviewProps {
    synchronizer: Synchronizer,
    codeProvider: CodeProvider,
    errorMessageColor?: string
}

const P5JSPreview: React.FC<P5JSPreviewProps> = ({ synchronizer, codeProvider, errorMessageColor }) => {

    const containerRef      = useRef<HTMLDivElement | null>(null)
    const latestSketchId    = useRef<number>(0)
    const lastWorkingSketch = useRef<{ sketchId: number, code: string } | undefined>(undefined)

    const [iframeSource,      setIframeSource]      = useState<string | undefined>(undefined)
    const [sketch,            setSketch]            = useState<string | undefined>(undefined)
    const [errorMessage,      setErrorMessage]      = useState<string>("")
    const [color,             setColor]             = useState<string>("black")

    function renderSketch(sketchId: number, code: string) {
        const oldIframeSource = iframeSource

        const newIframeSource = getHtmlUrl(sketchId, code)
        setIframeSource(newIframeSource)

        if (oldIframeSource) { URL.revokeObjectURL(oldIframeSource) }
    }

    function renderLastWorkingSketch(): void {
        const workingSketch = lastWorkingSketch.current
        if (workingSketch) {
            console.log("RENDERING OLD SKETCH!")
            renderSketch(workingSketch.sketchId, workingSketch.code)
        }
    }

    function updateSketch(sketch: string | undefined): void {
        if (sketch === undefined) { return }

        setErrorMessage("")
        latestSketchId.current++
        renderSketch(latestSketchId.current, sketch)
    }

    const updateSketchThrottled = throttle(setSketch, 500)

    useEffect(() => updateSketch(sketch),                                      [sketch])
    useEffect(() => setColor(errorMessageColor ? errorMessageColor : "black"), [errorMessageColor])

    useEffect(() => {
        const sync = synchronizer.registerSync(async () => {
            const code = await codeProvider.getCode()
            updateSketchThrottled(code)
        })
    
        return () => {
            sync.dispose()
        };
    }, []);

    function onMessage({ iframe, message: { sketchId, type, message }}: { iframe: IframeResizer.IFrameComponent, message: { type: string, sketchId: number, message: any } }): void {
        console.log("RECIEVED MESSAGE!")
        console.log(sketchId)
        console.log(latestSketchId.current)

        if (sketchId !== latestSketchId.current) { return }

        console.log(type)

        if (type !== "success" && type !== "syntax-error" && type !== "runtime-error") {
            throw new Error(`"${type}" is not a valid message type for the P5JSPreview!`)
        }
        
        if (type === "success" || type === "runtime-error") {
            lastWorkingSketch.current = { sketchId, code: message.code }
        }

        if (type === "syntax-error" || type === "runtime-error") {
            console.log(message.description)
            const description = message.description
            const stack       = message.stack
            setErrorMessage(`Message:\n${description}` + (stack && parseInt(iframe.style.height) > 300 ? `\n\nStack:\n${stack}` : ""))
        }

        if (type === "syntax-error") {
            renderLastWorkingSketch()
        }
    }

    return (
        <div className="container" ref={containerRef} style={{ padding: 5 }}>

            <div style={{ position: 'relative', flex: 4 }}>

                {iframeSource && <IframeResizer
                    src={iframeSource}
                    checkOrigin={["file://"]}
                    sizeWidth={true}
                    widthCalculationMethod='taggedElement'
                    tolerance={20}
                    onMessage={onMessage}
                />}

                {errorMessage && <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(255, 255, 255, 0.5)', // semi-transparent black
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {/* <img src='graphic.png' alt='graphic' /> */}
                    <h1>TEST</h1>
                </div>}

            </div>

            <div className='error-message' style={{ color, border: `1px solid ${color}` }}>
                <h3 style={{ color, borderBottom: `1px solid ${color}`, padding: "5px", margin: "0" }}>Error Log:</h3>
                <p style={{ color, padding: "5px", margin: "0" }}>{errorMessage ? errorMessage : "No errors"}</p>
            </div>

        </div>
    )
}

export default P5JSPreview