import { Version } from "@prisma/client"
import { VersionType } from "../data-types/enums"
import { DatabaseProxy } from "../proxy"
import { ProxyCache } from "../utils/cache"
import LineProxy from "./line-proxy"
import { prismaClient } from "../client"
import { ISessionVersion } from "../session"

export default class VersionProxy extends DatabaseProxy implements ISessionVersion<LineProxy> {

    public readonly line:      LineProxy
    public readonly type:      VersionType
    public readonly timestamp: number
    public readonly isActive:  boolean
    public readonly content:   string

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
        return new VersionProxy(version.id, line, version.type as VersionType, version.timestamp, version.isActive, version.content)
    }

    private constructor(id: number, line: LineProxy, type: VersionType, timestamp: number, isActive: boolean, content: string) {
        super(id)
        this.line      = line
        this.type      = type
        this.timestamp = timestamp
        this.isActive  = isActive
        this.content   = content
    }
}