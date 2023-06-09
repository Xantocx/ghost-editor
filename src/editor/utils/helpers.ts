import { MonacoModel } from "./types";

export function extractEOLSymbol(textModel: MonacoModel) {
    const EOL = textModel.getEndOfLineSequence()
    switch(EOL) {
        case 0:  return "\n"
        case 1:  return "\r\n"
        default: throw new Error(`Unknown end of line sequence! Got ${EOL}`)
    }
}

export function throttle<Func extends (...args: Parameters<Func>) => ReturnType<Func>>(func: Func, debounceTime: number): (...args: Parameters<Func>) => ReturnType<Func> | undefined {

    let allowExecution = true
    let lastArgs: Parameters<Func> | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null

    function timeoutHandler(): void {
        if (lastArgs) {
            func(...(lastArgs as Parameters<Func>))
            lastArgs = null
            timeout  = setTimeout(timeoutHandler, debounceTime)
        } else {
            allowExecution = true
        }
    }

    return (...args: Parameters<Func>): ReturnType<Func> | undefined => {
        let result: ReturnType<Func> | undefined = undefined

        if (allowExecution) {
            allowExecution = false
            result = func(...args)
            timeout = setTimeout(timeoutHandler, debounceTime)
        } else {
            lastArgs = args
        }

        return result
    }
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));