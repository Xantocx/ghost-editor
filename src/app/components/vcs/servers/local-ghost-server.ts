import { BrowserWindow } from "electron"
import { ElectronVCSServer } from "./electron-server"
import { GhostVCSServer } from "../../../../backend/vcs-server"

export class LocalGhostVCSServer extends ElectronVCSServer<GhostVCSServer> {
    constructor(browserWindow?: BrowserWindow) {
        const adapter = new GhostVCSServer(browserWindow)
        super(adapter)
    }
}