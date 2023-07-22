import { Disposable } from "./types"

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

export class Sync extends Synchronizable {

    private readonly syncCallback: (trigger: Synchronizable) => Promise<void>

    constructor(sync: (trigger: Synchronizable) => Promise<void>) {
        super()
        this.syncCallback = sync
    }

    public override async sync(trigger: Synchronizable): Promise<void> {
        await this.syncCallback(trigger)
    }
}

export class Synchronizer {

    private readonly objects: Synchronizable[] = []

    public register(object: Synchronizable): void {
        object.synchronizer?.deregister(object)
        this.objects.push(object)
        object.synchronizer = this
    }

    public registerSync(syncCallback: (trigger: Synchronizable) => Promise<void>): Disposable {
        const sync = new Sync(syncCallback)
        this.register(sync)

        const parent = this
        return {
            dispose() {
                parent.deregister(sync)
            },
        }
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