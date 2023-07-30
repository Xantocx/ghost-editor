import React, { useRef, useState, useEffect } from 'react'
import IframeResizer, { IFrameComponent } from 'iframe-resizer-react'
import ReactMarkdown from 'react-markdown';

import Synchronizer from "../../../utils/synchronizer"
import { CodeProvider } from "../preview";
import { throttle } from "../../../utils/helpers"

import "./react-p5js-preview.css"
import LoadingView from '../../react/loadingView';
import { IFramePage } from 'iframe-resizer';

const uri                 = document.baseURI
const url                 = new URL("", uri)
const p5jsScript          = new URL("./libs/p5js/p5.min.js", uri).href
const iframeResizerScript = new URL("./libs/iframe-resizer/iframeResizer.contentWindow.min.js", uri).href

const previewPadding = 5

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

                function scaleCanvases() {

                    const p5Canvas = document.getElementsByClassName("p5Canvas")

                    let maxWidth  = 0
                    let maxHeight = 0

                    if (p5Canvas.length > 0) {
                        for (let i = 0; i < p5Canvas.length; i++) {
                            const canvas = p5Canvas[i]
                            maxWidth  = Math.max(maxWidth,  parseFloat(canvas.style.width))
                            maxHeight = Math.max(maxHeight, parseFloat(canvas.style.height))
                        }
                    }

                    sendMessage("resize", { maxWidth, maxHeight })
                }

                //window.addEventListener("load",   () => scaleCanvases()) 
                //window.addEventListener("resize", () => scaleCanvases())

                // setup config object of iFrameResizer
                window.iFrameResizer = {
                    onReady: () => { 
                        if (preparedMessage) { sendMessage(preparedMessage.type, preparedMessage.message) }
                        scaleCanvases()
                    },
                    onMessage: message => {
                        if (message === "resize") { scaleCanvases() }
                        else                      { throw new Error('"' + message + '" is not an accepted message event!') }
                    }
                }
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

                function pauseP5() {
                    noLoop()
                }

                function pauseP5In(ms) {
                    pauseTimeoutId = setTimeout(() => {
                        pauseP5()
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

                            /*
                            // The React Preview (aka main preview) always runs through
                            window.addEventListener("mousedown", (event) => { playP5() })
                            window.addEventListener("mouseup", (event) => { pauseP5In(3000) })
                            pauseP5In(3000)
                            */
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

const ErrorHint: React.FC<{ errorHint: string | undefined | null }> = ({ errorHint }) => {
    return (
        <div style={{ paddingLeft: "3px", overflow: "auto" }}>
            <ReactMarkdown>{errorHint ? errorHint : (errorHint === undefined ? "Loading..." : "No error hint available.")}</ReactMarkdown>
        </div>
    )
}

interface P5JSPreviewProps {
    synchronizer:       Synchronizer,
    codeProvider:       CodeProvider,
    hideErrorMessage?:  boolean,
    errorMessageColor?: string
}

const P5JSPreview: React.FC<P5JSPreviewProps> = ({ synchronizer, codeProvider, hideErrorMessage, errorMessageColor }) => {

    const isMounted = useRef(true);

    const previewContainerRef   = useRef<HTMLDivElement | null>(null)
    const iframeRef             = useRef<IFramePage | null>(null)
    const latestSketchId        = useRef<number>(0)
    const lastWorkingSketch     = useRef<{ sketchId: number, code: string } | undefined>(undefined)
    const runtimeRecoverySketch = useRef<{ sketchId: number, code: string } | undefined>(undefined)

    const [iframeSource, setIframeSource] = useState<string | undefined>(undefined)
    const [sketch,       setSketch]       = useState<string | undefined>(undefined)
    const [errorMessage, setErrorMessage] = useState<string>("")
    const [errorHint,    setErrorHint]    = useState<boolean>(false)
    const [color,        setColor]        = useState<string>("black")

    function renderSketch(sketchId: number, code: string) {
        const oldIframeSource = iframeSource

        const newIframeSource = getHtmlUrl(sketchId, code)
        setIframeSource(newIframeSource)

        if (oldIframeSource) { URL.revokeObjectURL(oldIframeSource) }
    }

    function renderLastWorkingSketch(): void {
        const workingSketch = lastWorkingSketch.current
        if (workingSketch) {
            renderSketch(workingSketch.sketchId, workingSketch.code)
        }
    }

    function updateSketch(sketch: string | undefined): void {
        if (sketch === undefined) { return }

        setErrorMessage("")
        setErrorHint(false)
        latestSketchId.current++
        renderSketch(latestSketchId.current, sketch)
    }

    const updateSketchThrottled = throttle(setSketch, 500)

    useEffect(() => updateSketch(sketch),                                      [sketch])
    useEffect(() => setColor(errorMessageColor ? errorMessageColor : "black"), [errorMessageColor])

    useEffect(() => {
        const sync = synchronizer.registerSync(async () => {
            if (isMounted.current) {
                const code = await codeProvider.getCode()
                updateSketchThrottled(code)
            }
        })

        const observer = new ResizeObserver(() => {
            if (isMounted.current && iframeRef.current) {
                try {
                    iframeRef.current.sendMessage("resize")
                } catch {
                    // due to timing issues, this sometimes triggers after or before an iframe is ready to recieve sendMessage
                    console.warn("iFrame not (yet) setup.")
                }
            }
        })
      
        if (previewContainerRef.current) {
            observer.observe(previewContainerRef.current);
        }

        codeProvider.getCode().then(code => { if (code) { updateSketchThrottled(code) } })
    
        return () => {
            isMounted.current = false
            observer.disconnect()
            iframeRef.current?.close()
            sync.dispose()
        };
    }, []);

    function onMessage({ iframe, message: { sketchId, type, message }}: { iframe: IFrameComponent, message: { type: string, sketchId: number, message: any } }): void {

        if (type === "resize") {
            iframe.style.width  = `${message.maxWidth}px`
            iframe.style.height = `${message.maxHeight}px`

            const previewContainer = previewContainerRef.current
            if (previewContainer) {
                const computedStyle = getComputedStyle(previewContainer)
                const scaleFactor   = Math.min(parseFloat(computedStyle.width)  / message.maxWidth,
                                               parseFloat(computedStyle.height) / message.maxHeight)

                iframe.style.transform = `scale(${scaleFactor}) translate(-50%, -50%)`
            } else {
                console.warn("Cannot access container size for iframe!")
            }

            return
        } else {
            iframe.style.transform = "translate(-50%, -50%)"
        }

        if (sketchId !== latestSketchId.current) { return }

        if (type !== "success" && type !== "syntax-error" && type !== "runtime-error") {
            throw new Error(`"${type}" is not a valid message type for the P5JSPreview!`)
        }
        
        if (type === "success") {
            runtimeRecoverySketch.current = lastWorkingSketch.current
            lastWorkingSketch.current     = { sketchId, code: message.code }
        }

        if (type === "runtime-error" && lastWorkingSketch.current.sketchId === sketchId && runtimeRecoverySketch.current) {
            lastWorkingSketch.current = runtimeRecoverySketch.current
        }

        if (type === "syntax-error" || type === "runtime-error") {
            const description = message.description
            const stack       = message.stack
            setErrorMessage(`${type === "syntax-error" ? "Syntax" : "Runtime"} Error:\n${description}` + (stack && parseInt(iframe.style.height) > 300 ? `\n\nStack:\n${stack}` : ""))
            renderLastWorkingSketch()
        }
    }

    return (
        <div className="container" style={{ padding: previewPadding }}>

            <div ref={previewContainerRef} style={{ position: 'relative', flex: 1, padding: 5, border: "1px solid black" }}>

                {isMounted && iframeSource && <IframeResizer
                    forwardRef={iframeRef}
                    src={iframeSource}
                    checkOrigin={[url.origin]}
                    sizeWidth={true}
                    onMessage={onMessage}
                />}

                {errorMessage && <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(255, 255, 255, 0.6)', // semi-transparent black
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ fontSize: hideErrorMessage ? "90px" : "120px" }}></i>
                </div>}

            </div>

            {!hideErrorMessage && <div className='error-message' style={{ flex: "0 0 auto", maxHeight: "50%", border: `1px solid ${color}` }}>
                <div style={{ display: "flex", borderBottom: `1px solid ${color}`, padding: "5px", margin: "0" }}>
                    <h3 style={{ flex: 9, marginTop: "4px", marginBottom: "4px", color }}>Error Log:</h3>
                    {errorMessage && <button onClick={() => setErrorHint(true)} disabled={errorHint} style={{ flex: 1, color: "white", backgroundColor: errorHint ? "gray" : "green", borderRadius: "8px", border: "none" }}>Get Hint!</button>}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <pre style={{ flex: 1, padding: "5px", minHeight: "100%", margin: 0, color, overflow: "auto" }}>{errorMessage ? errorMessage : "No errors"}</pre>
                    {errorHint && <div style={{ flex: 2, minHeight: "100%", padding: "5px", margin: 0, borderTop: `1px solid ${color}` }}>
                        <LoadingView  ContentView={ErrorHint} loadData={async () => {
                            const errorHint = await codeProvider.getErrorHint(sketch, errorMessage)
                            return { errorHint: errorHint ? errorHint : "Failed to generate error hint!" }
                        }}/>
                    </div>}
                </div>
            </div>}

        </div>
    )
}

export default P5JSPreview