import ResourceManager from "../../resource-manager"
import DBSession from "../sessions/database-session"
import { FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy } from "../../proxy-types"

export default class DBResourceManager extends ResourceManager<FileProxy, LineProxy, VersionProxy, BlockProxy, TagProxy, DBSession> {
    public constructor() { super(DBSession) }
}