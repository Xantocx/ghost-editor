export abstract class Synchronizable {

    public synchronizer?: Synchronizer = undefined

    public async triggerSync(): Promise<void> { await this.synchronizer?.sync(this) }
    public async sync(trigger: Synchronizable): Promise<void> { throw new Error("Method not implemented.") }

    public constructor(synchronizer?: Synchronizer) {
        synchronizer?.register(this)
    }

    public remove(): void {
        this.synchronizer?.deregister(this)
    }
}

export class Synchronizer {

    private readonly objects: Synchronizable[] = []

    public register(object: Synchronizable): void {
        object.synchronizer?.deregister(object)
        this.objects.push(object)
        object.synchronizer = this
    }

    public deregister(object: Synchronizable): void {
        const index = this.objects.indexOf(object)
        if (index > -1) { this.objects.splice(index, 1) }
        if (object.synchronizer === this) { object.synchronizer = undefined }
    }

    public async sync(trigger: Synchronizable): Promise<void> {
        if (!this.objects.includes(trigger)) { throw new Error("Only Synchronizables registered with a Synchronizer can trigger a sync!") }
        for (const target of this.objects) {
            if (target !== trigger) { await target.sync(trigger) }
        }
    }
}