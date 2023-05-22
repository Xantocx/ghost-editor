import { BrowserWindow } from "electron"
import { ElectronVCSServer } from "./electron-server"
import { GhostVCSServerV2 } from "../../../../../vcs-v2"

export class LocalGhostVCSServer extends ElectronVCSServer<GhostVCSServerV2> {
    constructor(browserWindow?: BrowserWindow) {
        const adapter = new GhostVCSServerV2(browserWindow)
        super(adapter)
    }
}