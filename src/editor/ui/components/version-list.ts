import { VCSVersion } from "../../../app/components/data/snapshot"
import { Button } from "./button"

class SideScrollVersionListElement {

    public readonly list: SideScrollVersionList
    public readonly content: VCSVersion

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

    constructor(list: SideScrollVersionList, content: VCSVersion, onClick?: () => void) {
        this.list = list
        this.content = content

        this.element = document.createElement("li")
        this.button  = Button.p5jsPreviewButton(this.element, this.content, onClick)

        this.htmlList.appendChild(this.element)
    }

    public remove(): void {
        this.button.remove()
        this.element.remove()
    }
}

export class SideScrollVersionList {

    public readonly root: HTMLElement
    public readonly listContainer: HTMLDivElement
    public readonly list: HTMLUListElement

    public readonly scrollLeftButton: Button
    public readonly scrollRightButton: Button

    private readonly emptyPlaceholder: HTMLLIElement
    private elements: SideScrollVersionListElement[] = []

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

    public get versions(): VCSVersion[] {
        return this.elements.map(elem => elem.content)
    }

    /*
    public get rootHeight(): number {
        const computedRootStyle = window.getComputedStyle(this.root)
        return parseInt(computedRootStyle.height, 10)
    }
    */

    constructor(root: HTMLElement, versions?: VCSVersion[], placeholderText?: string) {
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
        this.listContainerStyle.flexGrow = "1"
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
        this.emptyPlaceholder.style.marginLeft = "15px"
        this.emptyPlaceholder.style.color = "gray"
        this.emptyPlaceholder.style.fontStyle = "italic"
        this.emptyPlaceholder.style.fontWeight = "bold"
        this.emptyPlaceholder.style.textAlign = "center"

        // load elements
        if (versions) { this.fillList(versions) }
    }

    public clearList(): void {
        this.elements.forEach(element => { element.remove() })
        this.elements = []

        this.list.appendChild(this.emptyPlaceholder)
    }

    public fillList(versions: VCSVersion[]): void {
        this.emptyPlaceholder.remove()

        if (versions.length === 0) {
            this.clearList()
        } else {
            versions.forEach((version: VCSVersion, index: number) => {
                this.addVersion(version, index === 0)
            })
        }
    }

    public addVersion(version: VCSVersion, isFirst?: boolean): void {
        if (!isFirst && this.elements.length === 0) {
            this.emptyPlaceholder.remove()
        }

        const listElement = new SideScrollVersionListElement(this, version, () => { console.log("Clicked " + version.name) })
        if(isFirst) { listElement.elementStyle.marginLeft = `${this.elementSpacing}px` }
        listElement.elementStyle.marginRight = `${this.elementSpacing}px`
        this.elements.push(listElement)
    }

    public remove(): void {
        this.clearList()
        this.emptyPlaceholder.remove()
        this.list.remove()
    }
}