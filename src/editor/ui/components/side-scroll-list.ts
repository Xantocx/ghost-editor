class SideScrollButtonListElement {

    public readonly list: SideScrollButtonList
    public readonly element: HTMLLIElement
    public readonly button: HTMLButtonElement

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
        this.button  = document.createElement("button")

        // element style
        this.elementStyle.marginRight = "10px"

        // button content
        this.button.textContent = text
        this.button.onclick = onClick ? onClick : null

        // button style
        this.buttonStyle.backgroundColor = "blue"
        this.buttonStyle.color = "white"
        this.buttonStyle.border = "none"
        this.buttonStyle.padding = `7px 20px`
        this.buttonStyle.textAlign = "center"
        this.buttonStyle.textDecoration = "none"
        this.buttonStyle.display = "inline-block"
        this.buttonStyle.fontSize = `16px`
        this.buttonStyle.cursor = "pointer"
        this.buttonStyle.borderRadius = "8px"

        this.element.appendChild(this.button)
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

    constructor(root: HTMLElement, elements?: string[]) {
        this.root = root
        this.list = document.createElement("ul")

        // set root style
        this.rootStyle.overflowX = "auto"
        this.rootStyle.whiteSpace = "nowrap"
        this.rootStyle

        // set list style
        this.listStyle.listStyle = "none"
        this.listStyle.padding = "0"
        this.listStyle.margin = "0"
        this.listStyle.display = "flex"

        this.root.appendChild(this.list)
        if (elements) { this.fillList(elements) }
    }

    public clearList(): void {
        this.elements.forEach(element => { element.remove() })
        this.elements = []
    }

    public fillList(elements: string[]): void {
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
        this.list.remove()
    }
}