import { DatabaseProxy } from "../database-proxy"
import { VersionProxy } from "../../types";

export class HeadProxy extends DatabaseProxy {

    public async updateVersion(version: VersionProxy): Promise<void> {
        await this.client.head.update({
            where: { id: this.id },
            data:  { version: { connect: { id: version.id } } }
        })
    }
}