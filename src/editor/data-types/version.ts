import GhostSnapshot from "../views/monaco/snapshot/snapshot"
import { CodeProvider } from "../views/view"
import { VCSBlockId, VCSBlockSession, VCSTagInfo } from "../../vcs/provider"

export default class VCSVersion implements CodeProvider {

    public readonly snapshot: GhostSnapshot
    public readonly tag:      VCSTagInfo
    
    private session?: VCSBlockSession

    public get sourceBlockId(): string        { return this.tag.blockId }
    public get tagBlockId(): VCSBlockId       { return this.tag.tagBlockId }
    public get tagId(): string                { return this.tag.tagId }
    public get name(): string                 { return this.tag.name }
    public get text(): string                 { return this.tag.text }
    public get description(): string          { return this.tag.description }
    public get automaticSuggestion(): boolean { return this.tag.automaticSuggestion }

    constructor(snapshot: GhostSnapshot, tag: VCSTagInfo) {
        this.snapshot = snapshot
        this.tag      = tag
    }

    public async getSession(): Promise<VCSBlockSession> {
        if (!this.session) {
            const rootSession = this.snapshot.session
            this.session      = await rootSession.getChild(this.tagBlockId)
            await this.session.applyTag(this.tag)
        }
        return this.session!
    }

    public async getCode(): Promise<string> {
        const session = await this.getSession()
        return await session.getRootText()
    }

    public async getErrorHint(code: string, errorMessage: string): Promise<string | null> {
        const session = await this.getSession()
        return await session.getErrorHint(code, errorMessage)
    }
}