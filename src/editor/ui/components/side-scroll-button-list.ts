import { Button } from "./button"

class SideScrollButtonListElement {

    public readonly list: SideScrollButtonList
    public readonly element: HTMLLIElement
    public readonly button: Button

    public get htmlList(): HTMLUListElement {
        return this.list.list
    }

    public get elementStyle(): CSSStyleDeclaration {
        return this.element.style
    }
    
    public get buttonStyle(): CSSStyleDeclaration {
        return this.button.style
    }

    constructor(list: SideScrollButtonList, text: string, onClick?: () => void) {
        this.list = list

        this.element = document.createElement("li")
        this.button  = new Button(this.element, text, onClick)

        // element style
        this.elementStyle.marginRight = "10px"

        this.htmlList.appendChild(this.element)
    }

    public remove(): void {
        this.button.remove()
        this.element.remove()
    }
}

export class SideScrollButtonList {

    public readonly root: HTMLElement
    public readonly list: HTMLUListElement

    private emptyPlaceholder: HTMLLIElement
    private elements: SideScrollButtonListElement[] = []

    public get rootStyle(): CSSStyleDeclaration {
        return this.root.style
    }

    public get listStyle(): CSSStyleDeclaration {
        return this.list.style
    }

    public get rootHeight(): number {
        const computedRootStyle = window.getComputedStyle(this.root)
        return parseInt(computedRootStyle.height, 10)
    }

    constructor(root: HTMLElement, elements?: string[], placeholderText?: string) {
        this.root = root
        this.list = document.createElement("ul")

        // set root style
        this.rootStyle.overflowX = "auto"
        this.rootStyle.whiteSpace = "nowrap"

        // set list style
        this.listStyle.listStyle = "none"
        this.listStyle.padding = "0"
        this.listStyle.margin = "5px 5px"
        this.listStyle.display = "flex"

        // setup placeholder in case list is empty
        this.emptyPlaceholder = document.createElement("li")
        this.emptyPlaceholder.textContent = placeholderText ? placeholderText : "Empty..."
        this.emptyPlaceholder.style.color = "gray"
        this.emptyPlaceholder.style.fontStyle = "italic"

        this.root.appendChild(this.list)
        if (elements) { this.fillList(elements) }
    }

    public clearList(): void {
        this.elements.forEach(element => { element.remove() })
        this.elements = []

        this.list.appendChild(this.emptyPlaceholder)
    }

    public fillList(elements: string[]): void {
        this.emptyPlaceholder.remove()

        if (elements.length === 0) {
            this.clearList()
        } else {
            elements.forEach(element => {
                const listElem = new SideScrollButtonListElement(this, element, () => { console.log("Clicked " + element) })
                this.elements.push(listElem)
            })
        }
    }

    public remove(): void {
        this.clearList()
        this.emptyPlaceholder.remove()
        this.list.remove()
    }
}