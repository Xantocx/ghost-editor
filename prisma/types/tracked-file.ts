import { Prisma, PrismaClient, DBTrackedLine, DBSnapshot } from '@prisma/client'
import { Snapshot, SnapshotArray } from './snapshot'
import { VCSSnapshotData } from '../../src/app/components/data/snapshot'

// This type will include a user and all their posts
type TrackedFileData = Prisma.DBTrackedFileGetPayload<typeof TrackedFile.args>

export class TrackedFile implements TrackedFileData {

    static readonly include = Prisma.validator<Prisma.DBTrackedFileInclude>()({
        lines: true,
        snapshots: {
            include: Snapshot.include
        }
    })

    // Define a type that includes relations
    static readonly args = Prisma.validator<Prisma.DBTrackedFileArgs>()({
        include: this.include
    })

    public static async create(client: PrismaClient, filePath: string | null): Promise<TrackedFile> {
        /*
        const fileConnector: Prisma.DBTrackedFileCreateNestedOneWithoutSnapshotsInput = {
            connect: { 
                id: file.id 
            }
        }
        */

        const data: Prisma.DBTrackedFileCreateInput = {
            filePath: filePath
        }

        const dbTrackedFile: TrackedFileData = await client.dBTrackedFile.create({
            data: data,
            include: this.include
        })

        return new TrackedFile(dbTrackedFile)
    }

    private readonly client: PrismaClient
    private readonly data: TrackedFileData

    private readonly _snapshots: SnapshotArray

    public get connector(): Prisma.DBTrackedFileCreateNestedOneWithoutSnapshotsInput {
        return {
            connect: { 
                id: this.id 
            }
        }
    }

    constructor(data: TrackedFileData) {
        this.data = data
        this._snapshots = new SnapshotArray(...data.snapshots)
    }

    public update() {
        this.updateSelected({ filePath: this.filePath }) // cannot add with lines and snapshots
        this._snapshots.update()
    }

    private updateSelected(data: Prisma.DBTrackedFileUpdateInput | Prisma.DBTrackedFileUncheckedUpdateInput) {

        const parent = this

        this.client.dBTrackedFile.update({
            where: {
                id: parent.id
            },
            data: data
        })
    }
    
    public get id(): number {
        return this.data.id
    }

    public get filePath(): string | null {
        return this.data.filePath
    }

    public get lines(): DBTrackedLine[] {
        return this.data.lines
    }

    public get snapshots(): SnapshotArray {
        return this._snapshots
    }

    public set filePath(path: string | null) {
        this.data.filePath = path
        this.updateSelected({ filePath: this.filePath })
    }

    public async createSnapsot(snapshot: VCSSnapshotData): Promise<Snapshot> {
        const newSnapshot = await Snapshot.create(this.client, this.connector, snapshot)
        this.snapshots.push(newSnapshot)
        return newSnapshot
    }

    public addSnapshot(snapshot: Snapshot): void {
        snapshot.file = this.data
        this._snapshots.push(snapshot)
    }
}