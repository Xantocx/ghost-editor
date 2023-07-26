import { Synchronizable } from "./synchronizer"
import Disposable from "../../utils/data-types/server-safe/disposable"

export default abstract class SubscriptionManager extends Synchronizable {

    protected subscriptions: Disposable[] = []

    public addSubscription(subscription: Disposable): Disposable {
        this.subscriptions.push(subscription)
        return {
            dispose: () => {
                subscription.dispose()
                const index = this.subscriptions.indexOf(subscription, 0)
                if (index > -1)  { this.subscriptions.splice(index, 1) }
            }
        }
    }

    public override remove() {
        this.subscriptions.forEach(subscription => { subscription.dispose() })
        this.subscriptions = []
        super.remove()
    }
}