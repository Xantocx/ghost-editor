import { VCSFileId, VCSFileData, VCSSessionRequest, VCSSessionId, VCSResponse, VCSSuccess, VCSError } from "../../../app/components/vcs/vcs-rework";
import { DBResourceManager, DBSession, ISessionFile, NewFileInfo, QueryType, ResourceManager, Session } from "../db/utilities";
import { Block } from "./block";
import { LineNode } from "./line";
import { Tag } from "./tag";
import { LineNodeVersion } from "./version";

export class InMemoryResourceManager extends ResourceManager<Block, LineNode, LineNodeVersion, Block, Tag, InMemorySession> {
    public constructor() { super(InMemorySession) }
}

export class InMemorySession extends Session<Block, LineNode, LineNodeVersion, Block, Tag> {

    private readonly databaseResources: DBResourceManager
    private readonly sessionId:         VCSSessionId

    private currentRequestId?: number = undefined

    public constructor(manager: InMemoryResourceManager) {
        super(manager)

        this.databaseResources = new DBResourceManager()
        this.sessionId         = this.databaseResources.createSession()
    }

    private getNextIds(): { requestId: string, previousRequestId?: string } {
        const lastRequestId   = this.currentRequestId
        this.currentRequestId = this.currentRequestId !== undefined ? this.currentRequestId + 1 : 0
        return { requestId: `${this.currentRequestId!}`, previousRequestId: lastRequestId !== undefined ? `${lastRequestId}` : undefined }
    }

    private createSessionRequest<RequestType>(args: RequestType): VCSSessionRequest<RequestType> {
        const { requestId, previousRequestId } = this.getNextIds()
        return { sessionId: this.sessionId, requestId, previousRequestId, data: args }
    }

    private async createDatabaseQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: QueryType, query: (session: DBSession, data: RequestData) => Promise<QueryResult>): Promise<QueryResult> {
        const response = await this.databaseResources.createQuery(request, queryType, query)
        const result   = response as VCSSuccess<QueryResult>
        const error    = response as VCSError

        // NOTE: seemingly I can always cast to an interface, so this seems to be safer than just checking if the cast worked
        if (error.error) { throw new Error(error.error) }
        else             { return result.response }
    }

    public async createSessionFile(filePath: string | undefined, eol: string, content?: string): Promise<NewFileInfo<Block, LineNode, LineNodeVersion, Block>> {
        const request = this.createSessionRequest({ filePath, eol, content })
        const fileData = await this.createDatabaseQuery(request, QueryType.ReadWrite, async (session, options) => {
            const blockInfo = await session.loadFile(options)
            return await session.getFileData(blockInfo)
        })

        const rootBlockData = fileData.rootBlock

        // dark magic

        return { file: { filePath: fileData.filePath, file:  }, rootBlock: { blockId: rootBlockData.blockId, block:  } }
    }

    public async getRootSessionBlockFor(filePath: string): Promise<Block | undefined> {
        throw new Error("Method not implemented.");
    }

    public async getSessionBlockFor(blockId: string): Promise<Block | undefined> {
        throw new Error("Method not implemented.");
    }

    public async getSessionTagFor(tagId: string): Promise<Tag | undefined> {
        throw new Error("Method not implemented.");
    }

    public async deleteSessionBlock(block: Block): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async getFileData(fileId: VCSFileId): Promise<VCSFileData> {
        throw new Error("In-memory file data extraction currently not usable.");
    }

}