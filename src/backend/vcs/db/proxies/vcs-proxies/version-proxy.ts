import { Version } from "@prisma/client"
import { DatabaseProxy } from "../database-proxy"
import { ProxyCache } from "../proxy-cache"

export class VersionProxy extends DatabaseProxy {

    public static async get(id: number): Promise<VersionProxy> {
        return await ProxyCache.getVersionProxy(id)
    }

    public static async getFor(version: Version): Promise<VersionProxy> {
        return await ProxyCache.getVersionProxyFor(version)
    }

    public static async load(id: number): Promise<VersionProxy> {
        return new VersionProxy(id)
    }

    public static async loadFrom(version: Version): Promise<VersionProxy> {
        return new VersionProxy(version.id)
    }

    private constructor(id: number) {
        super(id)
    }
}