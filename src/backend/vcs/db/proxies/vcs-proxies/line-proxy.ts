import { prismaClient } from "../../client";
import { DatabaseProxy } from "../database-proxy";
import { VersionProxy, BlockProxy } from "../../types";
import { Line, Prisma, Version, VersionType } from "@prisma/client"
import { FileProxy } from "./file-proxy";
import { TimestampProvider } from "../../../core/metadata/timestamps";
import { ProxyCache } from "../proxy-cache";
import { ISessionLine } from "../../utilities";

export class LineProxy extends DatabaseProxy implements ISessionLine {

    public readonly file: FileProxy

    public static async get(id: number, fileId?: number): Promise<LineProxy> {
        return await ProxyCache.getLineProxy(id, fileId)
    }

    public static async getFor(line: Line): Promise<LineProxy> {
        return await ProxyCache.getLineProxyFor(line)
    }

    public static async load(id: number, fileId?: number): Promise<LineProxy> {
        if (fileId) {
            const file = await ProxyCache.getFileProxy(fileId)
            return new LineProxy(id, file)
        } else {
            const line = await prismaClient.line.findUniqueOrThrow({ where: { id } })
            return await this.loadFrom(line)
        }
    }

    public static async loadFrom(line: Line): Promise<LineProxy> {
        const file = await ProxyCache.getFileProxy(line.fileId)
        return new LineProxy(line.id, file)
    }

    private constructor(id: number, file: FileProxy) {
        super(id)
        this.file = file
    }

    public readonly getBlocks = () => prismaClient.block.findMany({ where: { lines: { some: { id: this.id } } } })

    public async getBlockIds(): Promise<string[]> {
        const blocks = await this.getBlocks()
        return blocks.map(block => block.blockId)
    }

    public readonly getLatestVersion = () => prismaClient.version.findFirstOrThrow({
        where:   { lineId: this.id },
        orderBy: { timestamp: "desc" }
    })

    public async addBlocks(blockVersions: Map<BlockProxy, VersionProxy>): Promise<void> {
        const blocks = Array.from(blockVersions.keys())

        const updates = blocks.map(block => {
            const update = prismaClient.block.update({
                where: { id: block.id },
                data:  {
                    lines:     { connect: { id: this.id } },
                    timestamp: blockVersions.get(block)!.timestamp
                }
            })

            update.then(blockData => block.setTimestampManually(blockData.timestamp))

            return update
        })

        await prismaClient.$transaction(updates)
    }

    private async createNewVersion(sourceBlock: BlockProxy, isActive: boolean, content: string): Promise<VersionProxy> {
        
        // might be used for cloning (see validateHead), rn out of use
        const versionCreation: Prisma.PrismaPromise<Version>[] = []
        
        versionCreation.push(prismaClient.version.create({
            data: {
                lineId:        this.id,
                timestamp:     TimestampProvider.getTimestamp(),
                type:          isActive ? VersionType.CHANGE : VersionType.DELETION,
                isActive:      isActive,
                sourceBlockId: sourceBlock.id,
                content
            }
        }))

        const versions = await prismaClient.$transaction(versionCreation)
        const newVersion = versions[versions.length - 1]

        await sourceBlock.setTimestamp(newVersion.timestamp)

        return await VersionProxy.getFor(newVersion)
    }

    private async validateHead(sourceBlock: BlockProxy, currentHead?: Version): Promise<void> {
        const head = currentHead ? currentHead : await sourceBlock.getHeadFor(this)
        const latestVersion = await this.getLatestVersion()

        if (!head) { throw new Error("Cannot find head in block for line updated by the same block! This should not be possible!") }

        const versionCreation: Prisma.PrismaPromise<Version>[] = []

        // so this does not work if the final text is generated from root and children blocks, because children modify heads seen in the final text, while the root block (the one this edit is applied on), still sees another version
        if (latestVersion.id !== head.id) {
            console.log(head)
            console.log(latestVersion)
            throw new Error("Should never happen!")

            // clone config, in case cloning will be moved here
            versionCreation.push(prismaClient.version.create({
                data:  {
                    lineId:        this.id,
                    timestamp:     TimestampProvider.getTimestamp(),
                    type:          VersionType.CLONE,
                    isActive:      head.isActive,
                    originId:      head.id,
                    sourceBlockId: sourceBlock.id,
                    content:       head.content
                }
            }))
        }
    } 

    public async updateContent(sourceBlock: BlockProxy, content: string): Promise<VersionProxy> {
        const currentHead = await sourceBlock.getHeadFor(this)
        if (currentHead.content.trimEnd() === content.trimEnd()) {
            return await VersionProxy.getFor(currentHead)
        } else {
            //await this.validateHead(sourceBlock, currentHead)
            return await this.createNewVersion(sourceBlock, true, content)  
        }      
    }

    public async delete(sourceBlock: BlockProxy): Promise<VersionProxy> {
        //await this.validateHead(sourceBlock)
        return await this.createNewVersion(sourceBlock, false, "")   
    }
}