// import for side effect
import "./setup/menu"

import { app, BrowserWindow } from "electron"
import * as path from "path"

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'setup/preload.js')
        }
    })

    win.loadFile("dist/renderer/index.html")
    win.webContents.openDevTools()
}

app.whenReady().then(() => {
    createWindow()
  
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

export { app }