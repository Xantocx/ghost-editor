import { Prisma, PrismaClient, DBTrackedFile } from '@prisma/client'
import { VCSSnapshotData } from '../../src/app/components/data/snapshot'

// Define a type that includes relations
const fullSnapshot = Prisma.validator<Prisma.DBSnapshotArgs>()({
    include: { file: true },
})

// This type will include a user and all their posts
type SnapshotData = Prisma.DBSnapshotGetPayload<typeof fullSnapshot>

export class Snapshot implements SnapshotData {

    private readonly client: PrismaClient
    private readonly data: SnapshotData

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
            data: data
        })

        return dbSnapshot
    }

    constructor(data: SnapshotData) {
        this.data = data
    }

    public update() {
        this.updateSelected(this.data)
    }

    private updateSelected(data: Prisma.DBSnapshotUncheckedUpdateInput | Prisma.DBSnapshotUncheckedUpdateInput) {

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

    public set startLine(line: number) {
        this.data.startLine = line
        this.updateSelected({ startLine: this.startLine })
    }

    public set endLine(line: number) {
        this.data.endLine = line
        this.updateSelected({ endLine: this.endLine })
    }
}