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
        this.button  = Button.basicButton(this.element, text, onClick)

        this.htmlList.appendChild(this.element)
    }

    public remove(): void {
        this.button.remove()
        this.element.remove()
    }
}

export class SideScrollButtonList {

    public readonly root: HTMLElement
    public readonly listContainer: HTMLDivElement
    public readonly list: HTMLUListElement

    public readonly scrollLeftButton: Button
    public readonly scrollRightButton: Button

    private readonly emptyPlaceholder: HTMLLIElement
    private elements: SideScrollButtonListElement[] = []

    private readonly scrollSpeed: number = 100
    private readonly elementSpacing = 10

    public get rootStyle(): CSSStyleDeclaration {
        return this.root.style
    }

    public get listContainerStyle(): CSSStyleDeclaration {
        return this.listContainer.style
    }

    public get listStyle(): CSSStyleDeclaration {
        return this.list.style
    }

    public get rootHeight(): number {
        const computedRootStyle = window.getComputedStyle(this.root)
        return parseInt(computedRootStyle.height, 10)
    }

    constructor(root: HTMLElement, elements?: string[], placeholderText?: string) {
        // set root style
        this.root = root
        this.rootStyle.display = "flex"
        this.rootStyle.alignItems = "center"

        console.log("Width: " + window.getComputedStyle(this.root.parentElement!).width)

        // scroll button left   
        this.scrollLeftButton = Button.fullFieldButton(this.root, "<", () => { this.listContainer.scrollLeft -= this.scrollSpeed })
        this.scrollLeftButton.style.borderRight = "1px solid black"
        this.scrollLeftButton.style.borderBottom = "1px solid black"

        // set list container style
        this.listContainer = document.createElement("div")
        this.listContainerStyle.width = "300px"
        this.listContainerStyle.overflow = "hidden"
        this.listContainerStyle.whiteSpace = "nowrap"
        this.root.appendChild(this.listContainer)

        // scroll button right
        this.scrollRightButton = Button.fullFieldButton(this.root, ">", () => { this.listContainer.scrollLeft += this.scrollSpeed })
        this.scrollRightButton.style.borderLeft = "1px solid black"
        this.scrollRightButton.style.borderBottom = "1px solid black"

        // set list style
        this.list = document.createElement("ul")
        this.listStyle.listStyle = "none"
        this.listStyle.padding = "0 0"
        this.listStyle.margin = "0 0"
        this.listStyle.display = "inline-flex"
        this.listContainer.appendChild(this.list)

        // setup placeholder in case list is empty
        this.emptyPlaceholder = document.createElement("li")
        this.emptyPlaceholder.textContent = placeholderText ? placeholderText : "Empty..."
        this.emptyPlaceholder.style.color = "gray"
        this.emptyPlaceholder.style.fontStyle = "italic"

        // load elements
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
            elements.forEach((element: string, index: number) => {
                const listElem = new SideScrollButtonListElement(this, element, () => { console.log("Clicked " + element) })

                if(index === 0) { listElem.elementStyle.marginLeft = `${this.elementSpacing}px` }
                listElem.elementStyle.marginRight = `${this.elementSpacing}px`

                this.elements.push(listElem)
            })
        }
    }

    public updateWidth(width: number): void {
        this.listContainerStyle.width = `${width}px`
    }

    public remove(): void {
        this.clearList()
        this.emptyPlaceholder.remove()
        this.list.remove()
    }
}