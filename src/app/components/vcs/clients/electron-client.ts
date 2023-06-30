import { ipcRenderer } from "electron"
import { BasicVCSClient, BlockId, BlockInfo, BlockRange, BlockUpdate, ChildBlockInfo, CopyBlockInfo, FileId, FileLoadingOptions, RootBlockInfo, SessionId, TagInfo, VCSClient } from "../vcs-rework"
import { ElectronVCSServer } from "../servers/electron-server"

import { IRange } from "monaco-editor"
import { AnyChange, Change, ChangeSet, LineChange, MultiLineChange } from "../../data/change"
import { VCSSnapshotData, VCSTag } from "../../data/snapshot"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

export const ElectronVCSClient: VCSClient = {

    createSession: async function (): Promise<SessionId> {
        return await invoke(ElectronVCSServer.createSessionChannel)
    },

    closeSession: async function (sessionId: SessionId): Promise<void> {
        await invoke(ElectronVCSServer.closeSessionChannel, sessionId)
    },

    loadFile: async function (sessionId: SessionId, options: FileLoadingOptions): Promise<RootBlockInfo> {
        return await invoke(ElectronVCSServer.loadFileChannel, sessionId, options)
    },

    unloadFile: async function (fileId: FileId): Promise<void> {
        await invoke(ElectronVCSServer.unloadFileChannel, fileId)
    },

    lineChanged: async function (blockId: BlockId, change: LineChange): Promise<BlockId[]> {
        return await invoke(ElectronVCSServer.lineChangedChannel, blockId, change)
    },

    linesChanged: async function (blockId: BlockId, change: MultiLineChange): Promise<BlockId[]> {
        return await invoke(ElectronVCSServer.linesChangedChannel, blockId, change)
    },

    applyChange: async function (blockId: BlockId, change: AnyChange): Promise<BlockId[]> {
        return await invoke(ElectronVCSServer.applyChangeChannel, blockId, change)
    },

    applyChanges: async function (blockId: BlockId, changes: ChangeSet): Promise<BlockId[]> {
        return await invoke(ElectronVCSServer.applyChangesChannel, blockId, changes)
    },
    
    copyBlock: async function (blockId: BlockId): Promise<CopyBlockInfo> {
        return await invoke(ElectronVCSServer.copyBlockChannel, blockId)
    },

    createChild: async function (parentBlockId: BlockId, range: BlockRange): Promise<ChildBlockInfo> {
        return await invoke(ElectronVCSServer.createChildChannel, parentBlockId, range)
    },

    deleteBlock: async function (blockId: BlockId): Promise<void> {
        await invoke(ElectronVCSServer.deleteBlockChannel, blockId)
    },

    getBlockInfo: async function (blockId: BlockId): Promise<BlockInfo> {
        return await invoke(ElectronVCSServer.getBlockInfoChannel, blockId)
    },

    getChildrenInfo: async function (blockId: BlockId): Promise<BlockInfo[]> {
        return await invoke(ElectronVCSServer.getChildrenInfoChannel, blockId)
    },

    updateBlock: async function (blockId: BlockId, update: BlockUpdate): Promise<void> {
        await invoke(ElectronVCSServer.updateBlockChannel, blockId, update)
    },

    setBlockVersionIndex: async function (blockId: BlockId, versionIndex: number): Promise<string> {
        return await invoke(ElectronVCSServer.setBlockVersionIndexChannel, blockId, versionIndex)
    },

    saveCurrentBlockVersion: async function (blockId: BlockId): Promise<TagInfo> {
        return await invoke(ElectronVCSServer.saveCurrentBlockVersionChannel, blockId)
    }
}