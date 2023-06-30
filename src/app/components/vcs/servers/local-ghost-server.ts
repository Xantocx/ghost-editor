import { BrowserWindow } from "electron"
import { ElectronVCSServer } from "./electron-server"
//import { GhostVCSServer } from "../../../../backend/vcs-server"
import { DBVCSServer } from "../../../../backend/db-server"

export class LocalGhostVCSServer extends ElectronVCSServer<DBVCSServer> {
    constructor(browserWindow?: BrowserWindow) {
        const adapter = new DBVCSServer(browserWindow)
        super(adapter)
    }
}