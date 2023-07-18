import { Block, File, Line, Tag, Version } from "@prisma/client";
import { FileProxy, BlockProxy, LineProxy, VersionProxy, TagProxy } from "../types";

export class ProxyCache {

    private static readonly files    = new Map<number, FileProxy>
    private static readonly blocks   = new Map<number, BlockProxy>
    private static readonly lines    = new Map<number, LineProxy>
    private static readonly versions = new Map<number, VersionProxy>
    private static readonly tags     = new Map<number, TagProxy>


    public static registerFileProxy(proxy: FileProxy): void {
        this.files.set(proxy.id, proxy)
    }

    public static async getFileProxy(id: number): Promise<FileProxy> {
        if (this.files.has(id)) {
            return this.files.get(id)!
        } else {
            const proxy = await FileProxy.load(id)
            this.registerFileProxy(proxy)
            return proxy
        }
    }

    public static async getFileProxyFor(file: File): Promise<FileProxy> {
        const id = file.id
        if (this.files.has(id)) {
            return this.files.get(id)!
        } else {
            const proxy = await FileProxy.loadFrom(file)
            this.registerFileProxy(proxy)
            return proxy
        }
    }


    public static registerBlockProxy(proxy: BlockProxy): void {
        this.blocks.set(proxy.id, proxy)
    }

    public static async getBlockProxy(id: number): Promise<BlockProxy> {
        if (this.blocks.has(id)) {
            return this.blocks.get(id)!
        } else {
            const proxy = await BlockProxy.load(id)
            this.registerBlockProxy(proxy)
            return proxy
        }
    }

    public static async getBlockProxyFor(block: Block): Promise<BlockProxy> {
        const id = block.id
        if (this.blocks.has(id)) {
            return this.blocks.get(id)!
        } else {
            const proxy = await BlockProxy.loadFrom(block)
            this.registerBlockProxy(proxy)
            return proxy
        }
    }



    public static registerLineProxy(proxy: LineProxy): void {
        this.lines.set(proxy.id, proxy)
    }

    public static async getLineProxy(id: number): Promise<LineProxy> {
        if (this.lines.has(id)) {
            return this.lines.get(id)!
        } else {
            const proxy = await LineProxy.load(id)
            this.registerLineProxy(proxy)
            return proxy
        }
    }

    public static async getLineProxyFor(line: Line): Promise<LineProxy> {
        const id = line.id
        if (this.lines.has(id)) {
            return this.lines.get(id)!
        } else {
            const proxy = await LineProxy.loadFrom(line)
            this.registerLineProxy(proxy)
            return proxy
        }
    }


    public static registerVersionProxy(proxy: VersionProxy): void {
        this.versions.set(proxy.id, proxy)
    }

    public static async getVersionProxy(id: number): Promise<VersionProxy> {
        if (this.versions.has(id)) {
            return this.versions.get(id)!
        } else {
            const proxy = await VersionProxy.load(id)
            this.registerVersionProxy(proxy)
            return proxy
        }
    }

    public static async getVersionProxyFor(version: Version): Promise<VersionProxy> {
        const id = version.id
        if (this.versions.has(id)) {
            return this.versions.get(id)!
        } else {
            const proxy = await VersionProxy.loadFrom(version)
            this.registerVersionProxy(proxy)
            return proxy
        }
    }


    public static registerTagProxy(proxy: TagProxy): void {
        this.tags.set(proxy.id, proxy)
    }

    public static async getTagProxy(id: number): Promise<TagProxy> {
        if (this.tags.has(id)) {
            return this.tags.get(id)!
        } else {
            const proxy = await TagProxy.load(id)
            this.registerTagProxy(proxy)
            return proxy
        }
    }

    public static async getTagProxyFor(tag: Tag): Promise<TagProxy> {
        const id = tag.id
        if (this.tags.has(id)) {
            return this.tags.get(id)!
        } else {
            const proxy = await TagProxy.loadFrom(tag)
            this.registerTagProxy(proxy)
            return proxy
        }
    }
}