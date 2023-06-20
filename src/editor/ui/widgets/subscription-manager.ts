import { Synchronizable } from "../../utils/synchronizer"
import { Disposable } from "../../utils/types"

export abstract class SubscriptionManager extends Synchronizable {

    protected subscriptions: Disposable[] = []

    public addSubscription(subscription: Disposable): Disposable {

        const parent = this
        this.subscriptions.push(subscription)

        return {
            dispose() {
                subscription.dispose()
                const index = parent.subscriptions.indexOf(subscription, 0)
                if (index > -1)  { parent.subscriptions.splice(index, 1) }
            }
        }
    }

    public override remove() {
        this.subscriptions.forEach(subscription => { subscription.dispose() })
        this.subscriptions = []
        super.remove()
    }
}