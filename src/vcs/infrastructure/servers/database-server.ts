import { BrowserWindow } from "electron"
import { VCSBlockId } from "../../provider"
import DBSession from "../../database/infrastructure/sessions/database-session"
import { FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy } from "../../database/proxy-types"
import VCSServer from "./proxy-server"

export default class DBVCSServer extends VCSServer<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy, DBSession> {

    public constructor(browserWindow?: BrowserWindow) {
        super(DBSession, browserWindow)
    }

    protected async updatePreview(session: DBSession, blockId: VCSBlockId): Promise<void> {
        if (this.browserWindow) {

            const { root, block } = await session.getRootBlockFor(blockId)

            const lines = root.getActiveLines([block])

            const versionCounts = lines.map(line => line.versions.length)
            const text          = await root.getText([block])
            
            this.browserWindow.webContents.send("update-vcs-preview", root.id, text, versionCounts)
        }
    }
}