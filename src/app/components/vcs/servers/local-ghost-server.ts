import { ElectronVCSServer } from "./electron-server"
import { GhostVCSServer } from "../../../../../../ghost-vcs/src/vcs"

export class LocalGhostVCSServer extends ElectronVCSServer<GhostVCSServer> {
    constructor() {
        const adapter = new GhostVCSServer()
        super(adapter)
    }
}