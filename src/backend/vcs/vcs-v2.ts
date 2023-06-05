import { BrowserWindow } from "electron"
import { VCSSnapshotData, VCSVersion } from "../../app/components/data/snapshot"
import { IRange } from "../../app/components/utils/range"
import { BasicVCSServer, SessionId, SessionOptions, SnapshotUUID } from "../../app/components/vcs/vcs-provider"
import { LineChange, MultiLineChange } from "../../app/components/data/change"
import * as crypto from "crypto"


