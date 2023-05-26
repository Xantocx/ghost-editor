import { MonacoModel } from "./types";

export function extractEOLSymbol(textModel: MonacoModel) {
    const EOL = textModel.getEndOfLineSequence()
    switch(EOL) {
        case 0:  return "\n"
        case 1:  return "\r\n"
        default: throw new Error(`Unknown end of line sequence! Got ${EOL}`)
    }
}


export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));