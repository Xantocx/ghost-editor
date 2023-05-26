export function createGhostElement(tagName: string, options?: ElementCreationOptions): HTMLElement | HTMLDivElement | HTMLButtonElement | HTMLUListElement | HTMLLIElement {
    const element = document.createElement(tagName, options)
    element.style.boxSizing = "border-box"
    return element
}