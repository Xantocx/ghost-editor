import { Version } from "@prisma/client"
import { DatabaseProxy } from "../database-proxy"
import { ProxyCache } from "../proxy-cache"
import { LineProxy } from "./line-proxy"
import { prismaClient } from "../../client"

export class VersionProxy extends DatabaseProxy {

    public readonly line:     LineProxy
    public readonly isActive: boolean
    public readonly content:  string

    public static async get(id: number): Promise<VersionProxy> {
        return await ProxyCache.getVersionProxy(id)
    }

    public static async getFor(version: Version): Promise<VersionProxy> {
        return await ProxyCache.getVersionProxyFor(version)
    }

    public static async load(id: number): Promise<VersionProxy> {
        const version = await prismaClient.version.findUniqueOrThrow({ where: { id } })
        return await this.loadFrom(version)
    }

    public static async loadFrom(version: Version): Promise<VersionProxy> {
        const line = await ProxyCache.getLineProxy(version.lineId)
        return new VersionProxy(version.id, line, version.isActive, version.content)
    }

    private constructor(id: number, line: LineProxy, isActive: boolean, content: string) {
        super(id)
        this.line     = line
        this.isActive = isActive
        this.content  = content
    }
}