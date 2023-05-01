import * as file from "../utils/file"
import { Menu, MenuItem, ipcMain } from "electron"

export class GhostMenu {

    private static readonly menuTemplate = [
        new MenuItem({
            label: 'File',
            submenu: [
                { 
                    label: 'Open File...',
                    accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O',
                    click: (menuItem, browserWindow, event) => {
                        file.openFile(browserWindow)
                        .then(response => {
                            if (response) {
                                browserWindow.webContents.send('load-file', response)
                            }
                        })
                    }
                },
                {
                    label: 'Save',
                    accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
                    click: (menuItem, browserWindow, event) => {
                        browserWindow.webContents.send('save')
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