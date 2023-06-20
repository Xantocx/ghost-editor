import { Entity, JoinColumn, OneToOne } from "typeorm"
import { LinkedListNode, LinkedList } from "../utils/linked-list"
import { Timestamp, TimestampProvider } from "./metadata/timestamps"
import { LineNodeVersion, LineContent, LineVersion } from "./version"
import { Block } from "./block"
import { LineNode, Line } from "./line"

class VersionHistory<Version extends LinkedListNode<Version>> extends LinkedList<Version> {

    public get firstVersion(): Version | undefined { return this.first }
    public get lastVersion():  Version | undefined { return this.last }

    public set firstVersion(line: Version) { this.first = line }
    public set lastVersion (line: Version) { this.last  = line }  
    
    public getVersions(): Version[] { return this.toArray() }
}

@Entity()
export class LineNodeHistory extends VersionHistory<LineNodeVersion> {}

@Entity()
export class LineHistory {

    @OneToOne(() => LineHistory, (history: LineHistory) => history.line)
    public readonly line: Line

    @OneToOne(() => LineNodeHistory, { cascade: true })
    @JoinColumn()
    public readonly versions: LineNodeHistory

    @OneToOne(() => LineNodeVersion)
    @JoinColumn()
    private _head: LineNodeVersion

    public  get head(): LineNodeVersion        { return this._head }
    private set head(version: LineNodeVersion) { 
        this._head = version
        this.block.headChanged()
    } 

    private get headTracking(): Map<Timestamp, LineNodeVersion> { return this.node.headTracking }

    public get node():  LineNode { return this.line.node }
    public get block(): Block    { return this.line.block }

    public get firstVersion(): LineNodeVersion | undefined { return this.versions.firstVersion }
    public get lastVersion():  LineNodeVersion | undefined { return this.versions.lastVersion }

    public set firstVersion(line: LineNodeVersion) { this.versions.firstVersion = line }
    public set lastVersion (line: LineNodeVersion) { this.versions.lastVersion  = line }

    public get isActive(): boolean  { return this.head.isActive }

    public constructor(line: Line, versions: LineNodeHistory, setup?: { content?: LineContent, head?: LineNodeVersion }) {
        this.line     = line
        this.versions = versions

        const content = setup?.content
        const head    = setup?.head

        // empty strings count as "false"
        if      (content !== undefined && head)        { console.warn("You attempt to initialize this version history and set its head which is incompatiple in a single operation. Head will be ignored.") }
        else if (head && !this.versions.isInitialized) { throw new Error("Cannot set head for an uninitialized version history! Please initialize history first.") }

        if      (content !== undefined) { this.setupContent(content) }
        else if (head)                  { this.updateHead(head) }
        else if (this.lastVersion)      { this.updateHead(this.lastVersion) }
        else                            { throw new Error("Cannot set head as no acceptable version is available!") }

        // TODO: if nothing breaks, remove this line
        // this.head = this.lastVersion
    }

    private setupContent(content: LineContent): void {
        if (this.versions.isInitialized) { throw new Error("This line is already setup with initial content! This process cannot be preformed multiple times.") }

        if (this.line.isOriginal) {
            this.firstVersion = new LineNodeVersion(this.node, this.getNewTimestamp(), true, content)
            this.lastVersion  = this.firstVersion
        } else if (this.line.isInserted) {
            this.firstVersion = new LineNodeVersion(this.node, this.getNewTimestamp(), false, "")
            this.lastVersion  = new LineNodeVersion(this.node, this.getNewTimestamp(), true, content, { previous: this.firstVersion })
        } else {
            throw new Error(`Cannot create LineHistory for line with type "${this.line.lineType}"!`)
        }

        this.head = this.lastVersion
    }

    private getNewTimestamp(): Timestamp { return this.node.getNewTimestamp() }

    public getVersions():     LineNodeVersion[] { return this.versions.getVersions() }
    public getVersionCount(): number            { return this.versions.getLength() }

    public  getTrackedTimestamps():       Timestamp[] { return this.node.getTrackedTimestamps() }
    private updateHeadTrackingForBlock(): void        { this.block.updateHeadTracking() }           // will perform head tracking for the whole block, which is necessary to perform an edit

    // TODO: can probably be removed after introducing new, much more efficient head tracking!
    public updateHead(version: LineNodeVersion): void {
        // checking for LineNode (first part of check), as this may be called during initialization, and the line does not exist in LineNode yet
        if (this.node.has(this.block) && version.isHeadOf(this.block)) { return }
        this.head = version
        //this.headTracking.set(this.getNewTimestamp(), version)
    }

    public getVersion(timestamp: Timestamp): LineNodeVersion {
        if (this.line.isInserted && this.firstVersion.timestamp > timestamp) {
            return this.firstVersion
        } else {
            const version = this.versions.findReversed(version => { return version.timestamp <= timestamp })

            // search backwards through the keys (aka timestamps) of the tracked timestamps and find the biggest timestamp bigger than the previously found one, but smaller or equal to the searched one
            const trackedTimestamps = this.getTrackedTimestamps()
            for (let i = trackedTimestamps.length - 1; i >= 0; i--) {
                const trackedTimestamp = trackedTimestamps[i]
                if (trackedTimestamp > version.timestamp && trackedTimestamp <= timestamp) {
                    return this.headTracking.get(trackedTimestamp)
                }
            }
    
            return version
        }
    }

    public loadTimestamp(timestamp: Timestamp): LineNodeVersion {
        if (this.head.timestamp < timestamp && this.head.isLatestVersion(this.block)) {
            return this.head
        } else {
            const version = this.getVersion(timestamp)
            version.apply(this.block)
            return version
        }
    }

    private cloneHeadToEnd(): LineNodeVersion {
        this.updateHeadTrackingForBlock()
        this.lastVersion = this.head.clone(this.getNewTimestamp(), { previous: this.lastVersion })
        this.head        = this.lastVersion
        return this.head
    }

    public createNewVersion(isActive: boolean, content: LineContent): LineNodeVersion {
        if (this.head !== this.lastVersion) { this.cloneHeadToEnd() }
        else                                { this.updateHeadTrackingForBlock() }

        this.lastVersion = new LineNodeVersion(this.node, this.getNewTimestamp(), isActive, content, { previous: this.lastVersion })
        this.head        = this.lastVersion

        return this.head
    }

    public updateCurrentVersion(content: LineContent): LineNodeVersion {
        this.updateHeadTrackingForBlock()
        this.head.update(content)
        return this.head
    }

    public deleteLine(): LineNodeVersion {
        return this.createNewVersion(false, "")
    }
}