export abstract class LinkedListNode<Node extends LinkedListNode<Node>> {

    public readonly list?: LinkedList<Node>

    private _previous?: Node = undefined
    private _next?:     Node = undefined

    public get previous(): Node { return this._previous }
    public get next():     Node { return this._next }

    public set previous(node: Node) { this._previous = node }
    public set next    (node: Node) { this._next     = node }

    private get first(): Node | undefined { return this.list?.first }
    private get last():  Node | undefined { return this.list?.last }

    // This could be public, but interfers with parameterized implementation further down for the LineNodeVersion
    private get isFirst(): boolean { return this.isEqualTo(this.first) }
    private get isLast():  boolean { return this.isEqualTo(this.last) }

    public constructor(list?: LinkedList<Node>) {
        this.list = list
    }

    // hack to allow for comparison with this
    private isEqualTo(node: LinkedListNode<Node> | undefined): boolean { return this === node }

    public getIndex():             number { return this.previous && !this.isFirst ? this.previous.getIndex() + 1     : 0 }
    public getPreviousNodeCount(): number { return this.getIndex() }
    public getNextNodeCount():     number { return this.next     && !this.isLast  ? this.next.getNextNodeCount() + 1 : 0 }

    public getAbsoluteIndex(): number { return this.previous ? this.previous.getAbsoluteIndex() + 1 : 0 }

    public findPrevious(check: (previous: Node) => boolean): Node | undefined {
        let previous = this.previous

        while (previous && previous !== this.first) {
            if (check(previous)) { return previous }
            previous = previous.previous
        }

        return previous && previous === this.first && check(previous) ? previous : undefined
    }

    public findNext(check: (next: Node) => boolean): Node | undefined {
        let next = this.next

        while (next && next !== this.last) {
            if (check(next)) { return next }
            next = next.next
        }
        
        return next && next === this.last && check(next) ? next : undefined
    }

    public remove(): void {
        if (this.previous) { this.previous.next = this.next }
        if (this.next)     { this.next.previous = this.previous }
    }
}

export abstract class LinkedList<Node extends LinkedListNode<Node>> {

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
        let index = node.getIndex()

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