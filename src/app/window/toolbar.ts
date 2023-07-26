import { BrowserWindow, Menu, MenuItem, ipcMain } from "electron"
import * as file from "../utils/fileUtils"
import { p5jsDefaultCode } from "../../editor/languages/p5js/snippets"

const toolbarTemplate = [
    new MenuItem({
        label: 'File',
        submenu: [
            {
                label: 'Create New File...',
                accelerator: process.platform === 'darwin' ? 'Cmd+N' : 'Ctrl+N',
                click: (menuItem, browserWindow) => {
                    // TODO: Not sure if this is the desired default, but it works for this prototype
                    file.createFile(browserWindow, p5jsDefaultCode)
                        .then(response => {
                            if (response) {
                                browserWindow.webContents.send('menu-load-file', response)
                            }
                        })
                }
            },
            { 
                label: 'Open File...',
                accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O',
                click: (menuItem, browserWindow) => {
                    file.openFile(browserWindow)
                        .then(response => {
                            if (response) {
                                browserWindow.webContents.send('menu-load-file', response)
                            }
                        })
                }
            },
            {
                label: 'Save',
                accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
                click: (menuItem, browserWindow) => {
                    browserWindow.webContents.send('menu-save')
                }
            },
            { 
                role: 'quit' 
            }
        ]
    }),
]

function setupToolbarEvents(browserWindow: BrowserWindow): void {
    ipcMain.handle('save-file', async (event, response) => {
        const filePath = await file.saveFile(browserWindow, response.path, response.content)
        if (response.path !== filePath) {
            browserWindow.webContents.send("menu-update-file-path", filePath)
        }
    })
}

export default function setupToolbar(browserWindow: BrowserWindow): Menu {
    const menu = Menu.buildFromTemplate(toolbarTemplate)
    Menu.setApplicationMenu(menu)
    setupToolbarEvents(browserWindow)
    return menu
}