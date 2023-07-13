import { GhostSnapshot } from "../../../editor/ui/snapshot/snapshot"
import { CodeProvider } from "../../../editor/ui/views/view"
import { VCSBlockSession, VCSTagInfo } from "../vcs/vcs-rework"

export class VCSVersion implements CodeProvider {

    public readonly snapshot: GhostSnapshot
    public readonly tag:      VCSTagInfo
    
    private session?: VCSBlockSession

    public get blockId(): string              { return this.tag.blockId }
    public get tagId(): string                { return this.tag.tagId }
    public get name(): string                 { return this.tag.name }
    public get text(): string                 { return this.tag.text }
    public get automaticSuggestion(): boolean { return this.tag.automaticSuggestion }

    constructor(snapshot: GhostSnapshot, tag: VCSTagInfo) {
        this.snapshot = snapshot
        this.tag      = tag
    }

    public async getSession(): Promise<VCSBlockSession> {
        if (!this.session) {
            this.session = await this.snapshot.session.copyBlock()
            await this.session.applyTag(this.tag)
        }
        return this.session!
    }

    public async getCode(): Promise<string> {
        const session = await this.getSession()
        return await session.getRootText()
    }
}