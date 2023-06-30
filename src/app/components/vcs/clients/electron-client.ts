import { ipcRenderer } from "electron"
import { BasicVCSClient, VCSBlockId, VCSBlockInfo, VCSBlockRange, VCSBlockUpdate, VCSChildBlockInfo, VCSCopyBlockInfo, VCSFileId, VCSFileLoadingOptions, VCSRootBlockInfo, VCSSessionId, VCSTagInfo, VCSClient, VCSTagId, VCSUnwrappedText } from "../vcs-rework"
import { ElectronVCSServer } from "../servers/electron-server"
import { AnyChange, Change, ChangeSet, LineChange, MultiLineChange } from "../../data/change"

function invoke<Type>(channel: string, ...args: any): Promise<Type> {
    return ipcRenderer.invoke(channel, ...args)
}

export const ElectronVCSClient: VCSClient = {

    createSession: async function (): Promise<VCSSessionId> {
        return await invoke(ElectronVCSServer.createSessionChannel)
    },

    closeSession: async function (sessionId: VCSSessionId): Promise<void> {
        await invoke(ElectronVCSServer.closeSessionChannel, sessionId)
    },

    loadFile: async function (sessionId: VCSSessionId, options: VCSFileLoadingOptions): Promise<VCSRootBlockInfo> {
        return await invoke(ElectronVCSServer.loadFileChannel, sessionId, options)
    },

    unloadFile: async function (fileId: VCSFileId): Promise<void> {
        await invoke(ElectronVCSServer.unloadFileChannel, fileId)
    },

    getText: async function (blockId: VCSBlockId): Promise<string> {
        return await invoke(ElectronVCSServer.getTextChannel, blockId)
    },

    getUnwrappedText: async function (blockId: VCSBlockId): Promise<VCSUnwrappedText> {
        return await invoke(ElectronVCSServer.getUnwrappedTextChannel, blockId)
    },

    lineChanged: async function (blockId: VCSBlockId, change: LineChange): Promise<VCSBlockId[]> {
        return await invoke(ElectronVCSServer.lineChangedChannel, blockId, change)
    },

    linesChanged: async function (blockId: VCSBlockId, change: MultiLineChange): Promise<VCSBlockId[]> {
        return await invoke(ElectronVCSServer.linesChangedChannel, blockId, change)
    },

    applyChange: async function (blockId: VCSBlockId, change: AnyChange): Promise<VCSBlockId[]> {
        return await invoke(ElectronVCSServer.applyChangeChannel, blockId, change)
    },

    applyChanges: async function (blockId: VCSBlockId, changes: ChangeSet): Promise<VCSBlockId[]> {
        return await invoke(ElectronVCSServer.applyChangesChannel, blockId, changes)
    },
    
    copyBlock: async function (blockId: VCSBlockId): Promise<VCSCopyBlockInfo> {
        return await invoke(ElectronVCSServer.copyBlockChannel, blockId)
    },

    createChild: async function (parentBlockId: VCSBlockId, range: VCSBlockRange): Promise<VCSChildBlockInfo> {
        return await invoke(ElectronVCSServer.createChildChannel, parentBlockId, range)
    },

    deleteBlock: async function (blockId: VCSBlockId): Promise<void> {
        await invoke(ElectronVCSServer.deleteBlockChannel, blockId)
    },

    getBlockInfo: async function (blockId: VCSBlockId): Promise<VCSBlockInfo> {
        return await invoke(ElectronVCSServer.getBlockInfoChannel, blockId)
    },

    getChildrenInfo: async function (blockId: VCSBlockId): Promise<VCSBlockInfo[]> {
        return await invoke(ElectronVCSServer.getChildrenInfoChannel, blockId)
    },

    updateBlock: async function (blockId: VCSBlockId, update: VCSBlockUpdate): Promise<void> {
        await invoke(ElectronVCSServer.updateBlockChannel, blockId, update)
    },

    setBlockVersionIndex: async function (blockId: VCSBlockId, versionIndex: number): Promise<string> {
        return await invoke(ElectronVCSServer.setBlockVersionIndexChannel, blockId, versionIndex)
    },

    saveCurrentBlockVersion: async function (blockId: VCSBlockId): Promise<VCSTagInfo> {
        return await invoke(ElectronVCSServer.saveCurrentBlockVersionChannel, blockId)
    },

    applyTag: async function (tagId: VCSTagId, blockId: VCSBlockId): Promise<VCSBlockInfo> {
        return await invoke(ElectronVCSServer.applyTagChannel, tagId, blockId)
    }
}