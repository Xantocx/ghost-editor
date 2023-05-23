import { VCSVersion } from "../../../../app/components/data/snapshot";
import { View } from "../view";

export class VersionCodeView extends View {

    public readonly version: VCSVersion

    //private readonly codeView

    public constructor(root: HTMLElement, version: VCSVersion) {
        super(root)
        this.version = version
    }
}

export class VersionCodeViewList extends View {

    private readonly list: HTMLUListElement

    public get style(): CSSStyleDeclaration {
        return this.list.style
    }

    public constructor(root: HTMLElement) {
        super(root)

        this.list = document.createElement("ul")
        this.style.width = "100%"
        this.style.listStyleType = "none"
        this.style.overflowY = "auto"
        this.root.appendChild(this.list)
    }
}