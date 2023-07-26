import { RangeProvider } from "../utils/line-locator"
import { VCSBlockInfo, VCSBlockRange, VCSBlockSession, VCSTagInfo } from "../../vcs/provider"

export default class VCSSnapshot implements RangeProvider {

    public          blockInfo: VCSBlockInfo
    public readonly session:   VCSBlockSession

    public get blockId(): string { return this.blockInfo.blockId }

    public get versionCount(): number { return this.blockInfo.versionCount }
    public get versionIndex(): number { return this.blockInfo.versionIndex }

    public get lineCount(): number { return this.endLine - this.startLine + 1 }

    public get tags(): VCSTagInfo[] { return this.blockInfo.tags }

    public get range():     VCSBlockRange  { return this.blockInfo.range }
    public set range(range: VCSBlockRange) { this.update(range) } // used to update server, not anymore for overlapping reasons when inserting lines too late -> see manualUpdate if this is desired

    public get startLine():    number  { return this.range.startLine }
    public set startLine(line: number) {
        if (this.range.startLine !== line) {
            this.range.startLine = line
            this.updateServer()
        }
    }

    public get endLine():    number  { return this.range.endLine }
    public set endLine(line: number) {
        if (this.range.endLine !== line) {
            this.range.endLine = line
            this.updateServer()
        }
    }

    public constructor(snapshot: VCSBlockInfo, session: VCSBlockSession) {
        this.blockInfo = snapshot
        this.session   = session
    }

    private update(range: VCSBlockRange): boolean {
        const start = Math.min(range.startLine, range.endLine)
        const end   = Math.max(range.startLine, range.endLine)

        const updated = this.startLine !== start || this.endLine !== end

        if (updated) {
            // this by-passes the automatic update loop if it's not needed
            // manual update will invoke updateServer if needed afterwards
            this.range.startLine = start
            this.range.endLine   = end
        }

        return updated
    }

    private updateServer(): void {
        this.session.updateChildBlock(this.blockInfo, this.range)
    }

    public manualUpdate(range: VCSBlockRange) {
        if (this.update(range)) {
            this.updateServer()
        }
    }

    public async reload(data?: VCSBlockInfo): Promise<void> {
        if (data === undefined)                      { data = await this.session.getChildInfo(this.blockInfo) }
        if (this.blockInfo.blockId !== data.blockId) { throw new Error("You cannot update this Snapshot with an incompatiple snapshot!") }
        this.blockInfo = data
    } 
}