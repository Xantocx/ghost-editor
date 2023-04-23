import { ElectronVCSServer } from "./electron-server"
import { GhostVCSServer } from "../../../../../vcs-test"

export class LocalGhostVCSServer extends ElectronVCSServer<GhostVCSServer> {
    constructor() {
        const adapter = new GhostVCSServer()
        super(adapter)
    }
}