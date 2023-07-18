import { prismaClient } from "../../client";
import { DatabaseProxy } from "../database-proxy";
import { VersionProxy, BlockProxy } from "../../types";
import { Line, LineType, Prisma, PrismaPromise, Version, VersionType } from "@prisma/client"
import { FileProxy } from "./file-proxy";
import { TimestampProvider } from "../../../core/metadata/timestamps";
import { ProxyCache } from "../proxy-cache";
import { ISessionLine } from "../../utilities";

export class LineProxy extends DatabaseProxy implements ISessionLine {

    public readonly file:     FileProxy
    public readonly type:     LineType
    public          order:    number

    public versions: VersionProxy[]
    public blocks:   BlockProxy[]

    public static async get(id: number): Promise<LineProxy> {
        return await ProxyCache.getLineProxy(id)
    }

    public static async getFor(line: Line): Promise<LineProxy> {
        return await ProxyCache.getLineProxyFor(line)
    }

    public static async load(id: number): Promise<LineProxy> {
        const line = await prismaClient.line.findUniqueOrThrow({ where: { id } })
        return await this.loadFrom(line)
    }

    public static async loadFrom(line: Line): Promise<LineProxy> {
        const file  = await ProxyCache.getFileProxy(line.fileId)
        const proxy = new LineProxy(line.id, file, line.type, line.order)

        ProxyCache.registerLineProxy(proxy)
        
        const versionData = await prismaClient.version.findMany({ where: { lineId: line.id }, orderBy: { timestamp: "asc" } })
        proxy.versions    = await Promise.all(versionData.map(version => VersionProxy.getFor(version)))

        if (proxy.versions.length === 0) { throw new Error("LINE SHOULD NEVER HAVE 0 VERSIONS WHEN CREATING A PROXY FOR THE FIRST TIME!") }

        const blockData = await prismaClient.block.findMany({ where: { fileId: file.id, lines: { some: { id: line.id } } } })
        proxy.blocks    = await Promise.all(blockData.map(block => BlockProxy.getFor(block)))

        return proxy
    }

    private constructor(id: number, file: FileProxy, type: LineType, order: number) {
        super(id)
        this.file     = file
        this.type     = type
        this.order    = order
    }

    public getLatestVersion(): VersionProxy {
        return this.versions[this.versions.length - 1]
    }

    public getHeadFor(block: BlockProxy): VersionProxy {
        for (let i = this.versions.length - 1; i >= 0; i--) {
            const version = this.versions[i]
            if (version.timestamp <= block.timestamp) { return version }
        }

        return this.versions[0]
    }

    public async getBlockIds(): Promise<string[]> {
        return this.blocks.map(block => block.blockId)
    }

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

        const newBlocks = blocks.filter(block => this.blocks.every(currentBlock => block.id !== currentBlock.id))
        this.blocks = this.blocks.concat(newBlocks)
    }

    public createNewVersion(sourceBlock: BlockProxy, timestamp: number, versionType: VersionType, isActive: boolean, content: string, origin?: VersionProxy): { prismaPromise: PrismaPromise<Version>, proxyPromise: Promise<VersionProxy> } {
        const prismaPromise = prismaClient.version.create({
            data: {
                lineId:        this.id,
                timestamp:     timestamp,
                type:          versionType,
                isActive:      isActive,
                sourceBlockId: sourceBlock.id,
                originId:      origin ? origin.id : undefined,
                content
            }
        })

        const proxyPromise = prismaPromise.then(async versionData => {
            const version = await VersionProxy.getFor(versionData)
            this.versions.push(version)
            return version
        })

        return { prismaPromise, proxyPromise }
    }

    private async createSingleNewVersion(sourceBlock: BlockProxy, isActive: boolean, content: string): Promise<VersionProxy> {
        
        /*
        // might be used for cloning (see validateHead), rn out of use
        const versionCreation: Prisma.PrismaPromise<Version>[] = []
        
        versionCreation.push()

        const versions = await prismaClient.$transaction(versionCreation)
        const newVersion = versions[versions.length - 1]
        */


        const { prismaPromise: _, proxyPromise } = this.createNewVersion(sourceBlock, TimestampProvider.getTimestamp(), isActive ? VersionType.CHANGE : VersionType.DELETION, isActive, content)
        const version = await proxyPromise

        await sourceBlock.setTimestamp(version.timestamp)
        console.log("Timestamp: " + version.timestamp)

        return version
    }

    private async validateHead(sourceBlock: BlockProxy): Promise<void> {
        const head          = this.getHeadFor(sourceBlock)
        const latestVersion = this.getLatestVersion()

        if (!head) { throw new Error("Cannot find head in block for line updated by the same block! This should not be possible!") }

        const versionCreation: Prisma.PrismaPromise<Version>[] = []

        // so this does not work if the final text is generated from root and children blocks, because children modify heads seen in the final text, while the root block (the one this edit is applied on), still sees another version
        if (latestVersion.id !== head.id) {
            console.log(head)
            console.log(latestVersion)
            throw new Error("Latest version and current head do not match before creating a new version!")

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
        const currentHead = this.getHeadFor(sourceBlock)
        if (TimestampProvider.getLastTimestamp() === currentHead.timestamp && currentHead.content.trimEnd() === content.trimEnd()) {
            currentHead
        } else {
            //await this.validateHead(sourceBlock)
            return await this.createSingleNewVersion(sourceBlock, true, content)  
        }      
    }

    public async delete(sourceBlock: BlockProxy): Promise<VersionProxy> {
        //await this.validateHead(sourceBlock)
        return await this.createSingleNewVersion(sourceBlock, false, "")   
    }
}