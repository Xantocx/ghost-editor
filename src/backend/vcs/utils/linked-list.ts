import { SubscriptionManager } from "../../../editor/ui/widgets/mouse-tracker"

export abstract class LinkedListNode<Node extends LinkedListNode<Node>> {

    private _previous?: Node = undefined
    private _next?:     Node = undefined

    public get previous(): Node { return this._previous }
    public get next():     Node { return this._next }

    public set previous(node: Node) { this._previous = node }
    public set next    (node: Node) { this._next     = node }

    // hack to allow for comparison with this
    private isEqualTo(node: LinkedListNode<Node> | undefined): boolean { return this === node }

    // This could be public, but interfers with parameterized implementation further down for the LineNodeVersion
    private isFirstIn(list: LinkedList<Node>): boolean { return this.isEqualTo(list.first) }
    private isLastIn(list: LinkedList<Node>):  boolean { return this.isEqualTo(list.last) }

    public getIndexIn(list: LinkedList<Node>):             number { return this.previous && !this.isFirstIn(list) ? this.previous.getIndexIn(list) + 1     : 0 }
    public getPreviousNodeCountIn(list: LinkedList<Node>): number { return this.getIndexIn(list) }
    public getNextNodeCountIn(list: LinkedList<Node>):     number { return this.next     && !this.isLastIn(list)  ? this.next.getNextNodeCountIn(list) + 1 : 0 }

    public getAbsoluteIndex(): number { return this.previous ? this.previous.getAbsoluteIndex() + 1 : 0 }

    public findPreviousIn(list: LinkedList<Node>, check: (previous: Node) => boolean): Node | undefined {
        const first = list.first

        let previous = this.previous
        while (previous && previous !== first) {
            if (check(previous)) { return previous }
            previous = previous.previous
        }

        return previous && previous === first && check(previous) ? previous : undefined
    }

    public findNextIn(list: LinkedList<Node>, check: (next: Node) => boolean): Node | undefined {
        const last = list.last

        let next = this.next
        while (next && next !== last) {
            if (check(next)) { return next }
            next = next.next
        }
        
        return next && next === last && check(next) ? next : undefined
    }

    public remove(): void {
        if (this.previous) { this.previous.next = this.next }
        if (this.next)     { this.next.previous = this.previous }
    }
}

export abstract class LinkedList<Node extends LinkedListNode<Node>> extends SubscriptionManager {

    public first?: Node
    public last?:  Node

    public get hasFirst():      boolean { return this.first ? true : false }
    public get hasLast():       boolean { return this.last  ? true : false }
    public get isInitialized(): boolean { return this.hasFirst && this.hasLast }

    public getLength(): number  { 
        let counter = 0
        this.forEach(() => counter++)
        return counter
     }

    public contains(node: Node): boolean { 
        return this.find(testedNode => testedNode === node) ? true : false 
    }

    public forEach(callback: (node: Node, index: number) => void): void {
        let node = this.first
        let index = 0

        while (node && node !== this.last) {
            callback(node, index)
            node = node.next
            index++
        }

        if (node && node === this.last) { callback(this.last, index) }
    }

    public find(check: (node: Node, index: number) => boolean): Node | undefined {
        let node = this.first
        let index = 0

        while (node && node !== this.last) {
            if (check(node, index)) { return node }
            node = node.next
            index++
        }

        return node && node === this.last && check(this.last, index) ? this.last : undefined
    }

    public findReversed(check: (node: Node, index: number) => boolean): Node | undefined {
        let node  = this.last
        let index = node.getIndexIn(this)

        while (node && node !== this.first) {
            if (check(node, index)) { return node }
            node = node.previous
            index--
        }

        return node && node === this.first && check(node, index) ? node : undefined
    }

    public map<Mapped>(map: (node: Node, index: number, nodes: Node[]) => Mapped): Mapped[] {
        return this.toArray().map(map)
    }

    public flatMap<Mapped>(map: (node: Node, index: number, nodes: Node[]) => Mapped | Mapped[]): Mapped[] {
        return this.toArray().flatMap(map)
    }

    public filter(check: (node: Node, index: number, nodes: Node[]) => boolean): Node[] {
        return this.toArray().filter(check)
    }

    public toArray(): Node[] {
        const array: Node[] = []
        this.forEach(node => array.push(node))
        return array
    }
}