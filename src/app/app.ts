import { App, BrowserWindow } from "electron"
import { GhostMenu } from "./components/menu"
import { GhostVCSProvider, VCSAdapter, VCSAdapterClass } from "./components/vcs-provider"
import { SomeAdapter } from "./components/adapters/some-adapter"
import * as path from "path"

export class GhostApp {

    public static readonly adapterClass = SomeAdapter

    private static app: App
    private static BrowserWindow: typeof BrowserWindow

    private static window: BrowserWindow
    public static readonly vcs = new GhostVCSProvider(this.adapterClass)

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
                preload: path.join(__dirname, 'preload.js')
            }
        })
    
        this.window.loadFile("dist/renderer/index.html")
        this.window.webContents.openDevTools()

        this.vcs.createAdapter(null, null)
    }
}