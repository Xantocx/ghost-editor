import { MonacoModel } from "../data-types/convenience/monaco";

export function extractEOLSymbol(textModel: MonacoModel) {
    const EOL = textModel.getEndOfLineSequence()
    switch(EOL) {
        case 0:  return "\n"
        case 1:  return "\r\n"
        default: throw new Error(`Unknown end of line sequence! Got ${EOL}`)
    }
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function throttle<Params extends Array<any>, ReturnValue, Func extends (...args: Params) => ReturnValue>(func: Func, debounceTime: number): (...args: Parameters<Func>) => ReturnValue | undefined {

    let allowExecution = true
    let lastArgs: Parameters<Func> | null = null

    function timeoutHandler(): void {
        if (lastArgs) {
            func(...(lastArgs as Parameters<Func>))
            lastArgs = null
            setTimeout(timeoutHandler, debounceTime)
        } else {
            allowExecution = true
        }
    }

    return (...args: Parameters<Func>): ReturnValue | undefined => {
        let result: ReturnValue | undefined = undefined

        if (allowExecution) {
            allowExecution = false
            result = func(...args)
            setTimeout(timeoutHandler, debounceTime)
        } else {
            lastArgs = args
        }

        return result
    }
}