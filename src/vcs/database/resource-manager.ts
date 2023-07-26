import { VCSSessionId, VCSOperation, VCSSessionRequest, VCSResponse } from "../provider"
import Session, { ISessionFile, ISessionLine, ISessionVersion, ISessionBlock, ISessionTag } from "./session"

export default class ResourceManager<SessionFile extends ISessionFile, SessionLine extends ISessionLine, SessionVersion extends ISessionVersion<SessionLine>, SessionBlock extends ISessionBlock<SessionFile, SessionBlock, SessionLine, SessionTag>, SessionTag extends ISessionTag, QuerySession extends Session<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag>> {

    private readonly sessionConstructor: new (manager: this) => QuerySession
    private readonly sessions = new Map<string, QuerySession>()

    public constructor(sessionConstructor: new (manager: ResourceManager<SessionFile, SessionLine, SessionVersion, SessionBlock, SessionTag, QuerySession>) => QuerySession) {
        this.sessionConstructor = sessionConstructor
    }

    public createSession(): VCSSessionId {
        const session = new this.sessionConstructor(this)
        this.sessions.set(session.id, session)
        return session.asId()
    }

    public closeSession(sessionId: VCSSessionId): void {
        const id = sessionId.sessionId
        this.sessions.get(id)?.close()
        this.sessions.delete(id)
    }


    public getSessions(): QuerySession[] {
        return Array.from(this.sessions.values())
    }

    public async createQuery<RequestData, QueryResult>(request: VCSSessionRequest<RequestData>, queryType: VCSOperation, query: (session: QuerySession, data: RequestData) => QueryResult | Promise<QueryResult>): Promise<VCSResponse<QueryResult>> {
        let session: QuerySession

        try {
            session = this.getSession(request.sessionId)
        } catch (error) {
            let message: string
            if (error instanceof Error) { message = error.message }
            else                        { message = String(error) }
            return { requestId: request.requestId, error: message }
        }

        return session.createQuery(request, queryType, query)
    }

    public async createQueryChain<RequestData, QueryResult>(chainId: string, request: VCSSessionRequest<RequestData>, queryType: VCSOperation, query: (session: QuerySession, data: RequestData) => QueryResult | Promise<QueryResult>, onChainInterrupt: (session: QuerySession) => void | Promise<void>): Promise<VCSResponse<QueryResult>> {
        let session: QuerySession

        try {
            session = this.getSession(request.sessionId)
        } catch (error) {
            let message: string
            if (error instanceof Error) { message = error.message }
            else                        { message = String(error) }
            return { requestId: request.requestId, error: message }
        }

        return session.createQueryChain(chainId, request, queryType, query, onChainInterrupt)
    }

    private getSession(sessionId: VCSSessionId): QuerySession {
        const id = sessionId.sessionId
        if (this.sessions.has(id)) {
            return this.sessions.get(id)
        } else {
            throw new Error(`Requested session with ID "${id}" does not exist!`)
        }
    }

    /*
    private async loadFile(sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        return await this.getSession(sessionId).loadFile(options)
    }

    private unloadFile(fileId: VCSFileId): void {
        this.getSession(fileId).unloadFile(fileId)
    }

    private getFile(fileId: VCSFileId): FileProxy {
        return this.getSession(fileId).getFile(fileId)
    }

    private async getBlock(blockId: VCSBlockId): Promise<BlockProxy> {
        return await this.getSession(blockId).getBlock(blockId)
    }

    private async getTag(tagId: VCSTagId): Promise<TagProxy> {
        return await this.getSession(tagId).getTag(tagId)
    }

    private getRootBlockFor(fileId: VCSFileId): BlockProxy {
        return this.getSession(fileId).getRootBlockFor(fileId)
    }
    */
}