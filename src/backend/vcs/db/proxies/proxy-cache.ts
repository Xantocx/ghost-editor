import { Block, File, Line, Tag, Version } from "@prisma/client";
import { FileProxy, BlockProxy, LineProxy, VersionProxy, TagProxy } from "../types";

export class ProxyCache {

    private static readonly files    = new Map<number, FileProxy>
    private static readonly blocks   = new Map<number, BlockProxy>
    private static readonly lines    = new Map<number, LineProxy>
    private static readonly versions = new Map<number, VersionProxy>
    private static readonly tags     = new Map<number, TagProxy>


    public static registerFileProxy(proxy: FileProxy): FileProxy {
        if (this.files.has(proxy.id)) {
            const existingProxy = this.files.get(proxy.id)!
            if (existingProxy.identity !== proxy.identity) { throw new Error("Multiple instances for the same File created!") }
            return existingProxy
        } else {
            this.files.set(proxy.id, proxy)
            return proxy
        }
    }

    public static async getFileProxy(id: number): Promise<FileProxy> {
        if (this.files.has(id)) {
            return this.files.get(id)!
        } else {
            const proxy = await FileProxy.load(id)
            return this.registerFileProxy(proxy)
        }
    }

    public static async getFileProxyFor(file: File): Promise<FileProxy> {
        const id = file.id
        if (this.files.has(id)) {
            return this.files.get(id)!
        } else {
            const proxy = await FileProxy.loadFrom(file)
            return this.registerFileProxy(proxy)
        }
    }


    public static registerBlockProxy(proxy: BlockProxy): BlockProxy {
        if (this.blocks.has(proxy.id)) {
            const existingProxy = this.blocks.get(proxy.id)!
            if (existingProxy.identity !== proxy.identity) { throw new Error("Multiple instances for the same Block created!") }
            return existingProxy
        } else {
            this.blocks.set(proxy.id, proxy)
            return proxy
        }
    }

    public static async getBlockProxy(id: number): Promise<BlockProxy> {
        if (this.blocks.has(id)) {
            return this.blocks.get(id)!
        } else {
            const proxy = await BlockProxy.load(id)
            return this.registerBlockProxy(proxy)
        }
    }

    public static async getBlockProxyFor(block: Block): Promise<BlockProxy> {
        const id = block.id
        if (this.blocks.has(id)) {
            return this.blocks.get(id)!
        } else {
            const proxy = await BlockProxy.loadFrom(block)
            return this.registerBlockProxy(proxy)
        }
    }



    public static registerLineProxy(proxy: LineProxy): LineProxy {
        if (this.lines.has(proxy.id)) {
            const existingProxy = this.lines.get(proxy.id)!
            if (existingProxy.identity !== proxy.identity) { throw new Error("Multiple instances for the same Line created!") }
            return existingProxy
        } else {
            this.lines.set(proxy.id, proxy)
            return proxy
        }
    }

    public static async getLineProxy(id: number): Promise<LineProxy> {
        if (this.lines.has(id)) {
            return this.lines.get(id)!
        } else {
            const proxy = await LineProxy.load(id)
            return this.registerLineProxy(proxy)
        }
    }

    public static async getLineProxyFor(line: Line): Promise<LineProxy> {
        const id = line.id
        if (this.lines.has(id)) {
            return this.lines.get(id)!
        } else {
            const proxy = await LineProxy.loadFrom(line)
            return this.registerLineProxy(proxy)
        }
    }


    public static registerVersionProxy(proxy: VersionProxy): VersionProxy {
        if (this.versions.has(proxy.id)) {
            const existingProxy = this.versions.get(proxy.id)!
            if (existingProxy.identity !== proxy.identity) { throw new Error("Multiple instances for the same Version created!") }
            return existingProxy
        } else {
            this.versions.set(proxy.id, proxy)
            return proxy
        }
    }

    public static async getVersionProxy(id: number): Promise<VersionProxy> {
        if (this.versions.has(id)) {
            return this.versions.get(id)!
        } else {
            const proxy = await VersionProxy.load(id)
            return this.registerVersionProxy(proxy)
        }
    }

    public static async getVersionProxyFor(version: Version): Promise<VersionProxy> {
        const id = version.id
        if (this.versions.has(id)) {
            return this.versions.get(id)!
        } else {
            const proxy = await VersionProxy.loadFrom(version)
            return this.registerVersionProxy(proxy)
        }
    }


    public static registerTagProxy(proxy: TagProxy): TagProxy {
        if (this.tags.has(proxy.id)) {
            const existingProxy = this.tags.get(proxy.id)!
            if (existingProxy.identity !== proxy.identity) { throw new Error("Multiple instances for the same Tag created!") }
            return existingProxy
        } else {
            this.tags.set(proxy.id, proxy)
            return proxy
        }
    }

    public static async getTagProxy(id: number): Promise<TagProxy> {
        if (this.tags.has(id)) {
            return this.tags.get(id)!
        } else {
            const proxy = await TagProxy.load(id)
            return this.registerTagProxy(proxy)
        }
    }

    public static async getTagProxyFor(tag: Tag): Promise<TagProxy> {
        const id = tag.id
        if (this.tags.has(id)) {
            return this.tags.get(id)!
        } else {
            const proxy = await TagProxy.loadFrom(tag)
            return this.registerTagProxy(proxy)
        }
    }
}