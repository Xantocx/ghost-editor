import React, { useRef, useState, useEffect } from 'react'
import IframeResizer from 'iframe-resizer-react'

import "./react-p5js-preview.css"

interface P5JSPreviewProps {
    // Define your props here
}

const P5JSPreview: React.FC<P5JSPreviewProps> = (props) => {

    const containerRef                    = useRef<HTMLDivElement | null>(null)
    const iframeRef                       = useRef<HTMLIFrameElement | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

    function resizeIFrame(iframeWidth: number, iframeHeight: number): void {

        const iframe = iframeRef.current

        if (iframe) {
            // includes padding
            const scaleFactor = Math.min(this.getContentWidth() / iframeWidth, this.getContentHeight() / iframeHeight)

            iframe.style.transformOrigin = "top left"
            iframe.style.transform       = `scale(${scaleFactor}) translate(-50%, -50%)` // translate is used to center element vertically

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

    function onResize(data: any): void {
        this.resizeIFrame(data.width, data.height)
    }

    function onMessage(data: any): void {
        const error = data.message

        if (error.renderId !== this.lastRenderId) { return }

        this.hasErrorMessage = error.hasErrorMessage
        if (this.hasErrorMessage) {
            this.hideIFrame()

            this.errorMessage.innerText = `Message:\n${error.message}` + (error.stack && this.getContentHeight() > 300 ? `\n\nStack:\n${error.stack}` : "")
            this.container.appendChild(this.errorMessage)
        }
    }

    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            const iframe = iframeRef.current
            if (iframe) {
                const width  = parseFloat(iframe.style.width)
                const height = parseFloat(iframe.style.height)
                resizeIFrame(width, height)
            }
        });
    
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
    
        return () => {
            if (containerRef.current) {
                resizeObserver.unobserve(containerRef.current);
            }
        };
    }, [containerRef]);

    return (
        <div className="container" ref={containerRef} style={{ padding: 5 }}>
            <IframeResizer
                forwardRef={iframeRef}
                checkOrigin={["file://"]}
                sizeWidth={true}
                heightCalculationMethod='taggedElement'
                tolerance={20}
                log
                onResized={onResize}
                onMessage={onMessage}
            />
            <div>{errorMessage ? errorMessage : ""}</div>
        </div>
    )
}

export default P5JSPreview