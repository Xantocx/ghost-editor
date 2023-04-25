import { Prisma, PrismaClient, DBTrackedFile } from '@prisma/client'
import { VCSSnapshotData } from '../../src/app/components/data/snapshot'

// This type will include a user and all their posts
type SnapshotData = Prisma.DBSnapshotGetPayload<typeof Snapshot.args>

export class Snapshot implements SnapshotData {

    static readonly include = Prisma.validator<Prisma.DBSnapshotInclude>()({
        file: true
    })

    // Define a type that includes relations
    static readonly args = Prisma.validator<Prisma.DBSnapshotArgs>()({
        include: this.include
    })

    public static async create(client: PrismaClient, fileConnector: Prisma.DBTrackedFileCreateNestedOneWithoutSnapshotsInput, snapshot: VCSSnapshotData): Promise<Snapshot> {
        /*
        const fileConnector: Prisma.DBTrackedFileCreateNestedOneWithoutSnapshotsInput = {
            connect: { 
                id: file.id 
            }
        }
        */

        const data: Prisma.DBSnapshotCreateInput = {
            uuid: snapshot.uuid,
            startLine: snapshot._startLine,
            endLine: snapshot._endLine,
            file: fileConnector
        }

        const dbSnapshot: SnapshotData = await client.dBSnapshot.create({
            data: data,
            include: this.include
        })

        return new Snapshot(dbSnapshot)
    }



    private readonly client: PrismaClient
    public readonly data: SnapshotData

    constructor(data: SnapshotData) {
        this.data = data
    }

    public update() {
        this.updateSelected(this.data)
    }

    private updateSelected(data: Prisma.DBSnapshotUpdateInput | Prisma.DBSnapshotUncheckedUpdateInput) {

        const parent = this

        this.client.dBSnapshot.update({
            where: {
                id: parent.id
            },
            data: data
        })
    }
    
    public get id(): number {
        return this.data.id
    }

    public get uuid(): string {
        return this.data.uuid
    }

    public get fileId(): number {
        return this.data.fileId
    }

    public get file(): DBTrackedFile {
        return this.data.file
    }

    public get startLine(): number {
        return this.data.startLine
    }

    public get endLine(): number {
        return this.data.startLine
    }

    public set file(file: DBTrackedFile) {
        this.data.fileId = file.id
        this.data.file = file
        this.updateSelected({ fileId: this.file.id })
    }

    public set startLine(line: number) {
        this.data.startLine = line
        this.updateSelected({ startLine: this.startLine })
    }

    public set endLine(line: number) {
        this.data.endLine = line
        this.updateSelected({ endLine: this.endLine })
    }
}

export class SnapshotArray extends Array<Snapshot> {

    constructor(...snapshots: SnapshotData[]) {

        const snapshotData = snapshots.map(data => {
            return new Snapshot(data)
        })

        super(...snapshotData)
    }

    public asRawData(): SnapshotData[] {
        return this.map(snapshot => { 
            return snapshot.data
         })
    }

    public update(): void {
        this.forEach(snapshot => {
            snapshot.update()
        })
    }
}