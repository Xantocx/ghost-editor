import { View, CodeView, CodeProvider, CodeProviderView } from "../view"

export abstract class Preview extends View {}
export abstract class CodePreview extends CodeView {}
export abstract class CodeProviderPreview extends CodeProviderView {}

export { CodeProvider }