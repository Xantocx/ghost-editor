import { dialog } from "electron"
import * as fs from "fs"

export function openFileDialog(browserWindow) {
    return dialog.showOpenDialog(browserWindow, {
        title: 'Open File...',
        buttonLabel: 'Open',
        properties: [
            'openFile',
            'createDirectory',
            'promptToCreate'
        ],
        message: 'Select a file to open in the editor.'
    })
}

export function openFile(browserWindow) {
    return openFileDialog(browserWindow)
        .then(response => {
            if (!response.canceled && response.filePaths.length >= 1) {
                let filePath = response.filePaths[0]
                return fs.promises.readFile(filePath, 'utf-8')
                    .then(content => {
                        return { path: filePath, content: content }
                    })
            } else {
                return null
            }
        })  
}

export function saveFile(filePath, content) {
    if (filePath) {
        return fs.promises.writeFile(filePath, content)
    } else {
        console.log('NO FILE PATH! PATH SELECTOR MISSING!')
    }
}