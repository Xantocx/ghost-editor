export abstract class Synchronizable {

    public synchronizer?: Synchronizer = undefined

    public triggerSync(): void { this.synchronizer?.sync(this) }
    public sync(trigger: Synchronizable): void { throw new Error("Method not implemented.") }

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

    public sync(trigger: Synchronizable): void {
        if (!this.objects.includes(trigger)) { throw new Error("Only Synchronizables registered with a Synchronizer can trigger a sync!") }
        this.objects.forEach(target => {
            if (target !== trigger) { target.sync(trigger) }
        })
    }
}