import * as file from "../utils/file"
import { Menu, MenuItem, ipcMain } from "electron"

import { p5jsDefaultCode } from "../../../editor/utils/default-code-snippets"

export class GhostMenu {

    private static readonly menuTemplate = [
        new MenuItem({
            label: 'File',
            submenu: [
                {
                    label: 'Create New File...',
                    accelerator: process.platform === 'darwin' ? 'Cmd+N' : 'Ctrl+N',
                    click: (menuItem, browserWindow, event) => {
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
                    click: (menuItem, browserWindow, event) => {
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
                    click: (menuItem, browserWindow, event) => {
                        browserWindow.webContents.send('menu-save')
                    }
                },
                { 
                    role: 'quit' 
                }
            ]
        }),
    ]

    private static menu: Menu

    public static setup() {
        this.setupEventHandlers()
        this.menu = Menu.buildFromTemplate(this.menuTemplate)
        Menu.setApplicationMenu(this.menu)
    }

    private static setupEventHandlers(): void {
        const saveSubscription = ipcMain.handle('save-file', (event, response) => {
            file.saveFile(response.path, response.content)
        })
    }
}