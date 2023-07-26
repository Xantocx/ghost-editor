import * as monaco from "monaco-editor"

// convenience types
export type MonacoEditor = monaco.editor.IStandaloneCodeEditor
export type MonacoModel = monaco.editor.ITextModel
export type URI = monaco.Uri
export type LayoutInfo = monaco.editor.EditorLayoutInfo
export type Disposable = monaco.IDisposable
export type OverlayWidget = monaco.editor.IOverlayWidget
export type ContentWidget = monaco.editor.IContentWidget
export type Decoration = monaco.editor.IModelDeltaDecoration
export type Decorations = monaco.editor.IEditorDecorationsCollection
export type ViewZone = monaco.editor.IViewZone
export type Range = monaco.Range
export type IRange = monaco.IRange
export type Selection = monaco.Selection
export type DecorationsChangedEvent = monaco.editor.IModelDecorationsChangedEvent
export type MonacoChangeEvent = monaco.editor.IModelContentChangedEvent

// convenience accessors
export const MonacoEditorOption = monaco.editor.EditorOption