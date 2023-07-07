import { prismaClient } from "../../client";
import { DatabaseProxy } from "../database-proxy";
import { VersionProxy, BlockProxy } from "../../types";
import { HeadList, Line, Prisma, Version, VersionType } from "@prisma/client"
import { FileProxy } from "./file-proxy";
import { VCSBlockId, VCSFileId } from "../../../../../app/components/vcs/vcs-rework";
import { TimestampProvider } from "../../../core/metadata/timestamps";
import { ProxyCache } from "../proxy-cache";

export class LineProxy extends DatabaseProxy {

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
            return prismaClient.block.update({
                where: { id: block.id },
                data:  {
                    lines:       { connect: { id: this.id } },
                    headList: { 
                        update: {
                            versions: { connect: { id: blockVersions.get(block)!.id } }
                        }
                    }
                }
            })
        })

        await prismaClient.$transaction(updates)
    }

    private async createNewVersion(sourceBlock: BlockProxy, isActive: boolean, content: string): Promise<VersionProxy> {

        const [head, latestVersion] = await prismaClient.$transaction([
            sourceBlock.getHeadFor(this),
            this.getLatestVersion()
        ])

        if (!head) { throw new Error("Cannot find head in block for line updated by the same block! This should not be possible!") }

        const versionCreation: Prisma.PrismaPromise<Version>[] = []

        if (latestVersion.id !== head.id) {
            throw new Error("Should never happen!")
            // clone of old head -> replaces head tracking concept
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

        await prismaClient.headList.update({
            where: { id: sourceBlock.headListId },
            data:  {
                versions: {
                    connect:    { id: newVersion.id },
                    disconnect: { id: head.id }
                }
            }
        })

        return await VersionProxy.getFor(newVersion)
    }

    public async updateContent(sourceBlock: BlockProxy, content: string): Promise<VersionProxy> {
        let previousVersion: Version
        if (sourceBlock) { previousVersion = await sourceBlock.getHeadFor(this) }
        else             { previousVersion = await this.getLatestVersion() }

        if (previousVersion.content.trimEnd() === content.trimEnd()) {
            return await VersionProxy.getFor(previousVersion)
        } else {
            return await this.createNewVersion(sourceBlock, true, content)  
        }      
    }

    public async delete(sourceBlock: BlockProxy): Promise<VersionProxy> {
        return await this.createNewVersion(sourceBlock, false, "")   
    }
}