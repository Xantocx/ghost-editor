import { BrowserWindow } from "electron"
import ElectronVCSServer from "./electron-server"
import DBVCSServer from "./database-server"

export default class LocalDatabaseVCSServer extends ElectronVCSServer<DBVCSServer> {
    constructor(browserWindow?: BrowserWindow) {
        const adapter = new DBVCSServer(browserWindow)
        super(adapter)
    }
}