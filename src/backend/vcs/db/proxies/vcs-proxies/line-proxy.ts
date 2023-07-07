import { prismaClient } from "../../client";
import { FileDatabaseProxy } from "../database-proxy";
import { VersionProxy, BlockProxy } from "../../types";
import { HeadList, Line, Prisma, Version, VersionType } from "@prisma/client"
import { FileProxy } from "./file-proxy";
import { VCSBlockId, VCSFileId } from "../../../../../app/components/vcs/vcs-rework";
import { TimestampProvider } from "../../../core/metadata/timestamps";

export class LineProxy extends FileDatabaseProxy {

    public static createFrom(line: Line, file?: FileProxy): LineProxy {
        file = file ? file : new FileProxy(line.fileId)
        return new LineProxy(line.id, file)
    }

    public readonly getBlocks = () => prismaClient.block.findMany({ where: { lines: { some: { id: this.id } } } })

    public readonly getLatestVersion = () => prismaClient.version.findFirstOrThrow({
        where:   { lineId: this.id },
        orderBy: { timestamp: "desc" }
    })

    public async getBlockIds(): Promise<string[]> {
        const blocks = await this.getBlocks()
        return blocks.map(block => block.blockId)
    }

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

        const [headList, head, latestVersion] = await prismaClient.$transaction([
            sourceBlock.getHeadList(),
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
            where: { id: headList.id },
            data:  {
                versions: {
                    connect:    { id: newVersion.id },
                    disconnect: { id: head.id }
                }
            }
        })

        return new VersionProxy(newVersion.id)
    }

    public async updateContent(sourceBlock: BlockProxy, content: string): Promise<VersionProxy> {
        let previousVersion: Version
        if (sourceBlock) { previousVersion = await sourceBlock.getHeadFor(this) }
        else             { previousVersion = await this.getLatestVersion() }

        if (previousVersion.content.trimEnd() === content.trimEnd()) {
            return new VersionProxy(previousVersion.id)
        } else {
            return await this.createNewVersion(sourceBlock, true, content)  
        }      
    }

    public async delete(sourceBlock: BlockProxy): Promise<VersionProxy> {
        return await this.createNewVersion(sourceBlock, false, "")   
    }
}