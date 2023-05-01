import * as path from "path"
import { App, BrowserWindow } from "electron"
import { GhostMenu } from "./components/interface/menu"
import { VCSServer } from "./components/vcs/vcs-provider"
import { LocalGhostVCSServer } from "./components/vcs/implementations"

export class GhostApp {

    // public static readonly adapterClass = MockAdapter

    private static app: App
    private static BrowserWindow: typeof BrowserWindow

    private static window: BrowserWindow
    public  static vcs: VCSServer

    public static start(app: App, browserWindow: typeof BrowserWindow): void {
        this.app = app
        this.BrowserWindow = browserWindow
        this.setup()
    }

    private static setup() {
        GhostMenu.setup()

        this.app.whenReady().then(() => {
            this.createWindow()

            this.app.on('activate', () => {
                if (this.BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow()
                }
            })
        })
        
        this.app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') this.app.quit()
        })
    }

    private static createWindow(): void {
        this.window = new this.BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                preload: path.join(__dirname, 'preload.bundle.js')
            }
        })
    
        this.window.loadFile("dist/renderer/index.html")
        this.window.webContents.openDevTools()

        this.vcs = new LocalGhostVCSServer(this.window)
    }
}