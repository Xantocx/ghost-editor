import { dialog, BrowserWindow, OpenDialogReturnValue, SaveDialogReturnValue } from "electron"
import * as fs from "fs"

export async function createFileDialog(browserWindow: BrowserWindow): Promise<SaveDialogReturnValue> {
    return dialog.showSaveDialog(browserWindow, {
        title:       "Create New File...",
        buttonLabel: "Save",
        message:     "Create the new file you want to work with.",
        properties: [
            "createDirectory"
        ]
    })
}

export async function openFileDialog(browserWindow: BrowserWindow): Promise<OpenDialogReturnValue> {
    return dialog.showOpenDialog(browserWindow, {
        title:       'Open File...',
        buttonLabel: 'Open',
        message:     'Select a file to open in the editor.',
        properties: [
            'openFile',
            'createDirectory',
            'promptToCreate'
        ],
    })
}

export async function createFile(browserWindow: BrowserWindow, content?: string): Promise<{ path: string, content: string } | null> {

    const response = await createFileDialog(browserWindow)

    if (!response.canceled && response.filePath) {
        let filePath = response.filePath

        // fix for inconsistend drive identifiers
        filePath = filePath[0].toLowerCase() + filePath.substring(1)

        if (content) { await saveFile(browserWindow, filePath, content) }
        return { path: filePath, content: content ? content : "" }
    } else {
        return null
    }
}

export async function openFile(browserWindow: BrowserWindow): Promise<{ path: string, content: string } | null> {

    const response = await openFileDialog(browserWindow)

    if (!response.canceled && response.filePaths.length > 0) {
        let filePath = response.filePaths[0]

        // fix for inconsistend drive identifiers
        filePath = filePath[0].toLowerCase() + filePath.substring(1)

        const content = await fs.promises.readFile(filePath, 'utf-8')
        return { path: filePath, content: content }
    } else {
        return null
    }
}

export async function saveFile(browserWindow: BrowserWindow, filePath: string | undefined, content: string): Promise<string> {
    if (filePath) {
        await fs.promises.writeFile(filePath, content)
        return filePath
    } else {
        const response = await createFile(browserWindow, content)
        return response.path
    }
}