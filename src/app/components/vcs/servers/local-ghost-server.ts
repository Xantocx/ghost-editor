import { BrowserWindow } from "electron"
import { ElectronVCSServer } from "./electron-server"
import { GhostVCSServer } from "../../../../../vcs-test"

export class LocalGhostVCSServer extends ElectronVCSServer<GhostVCSServer> {
    constructor(browserWindow?: BrowserWindow) {
        const adapter = new GhostVCSServer(browserWindow)
        super(adapter)
    }
}