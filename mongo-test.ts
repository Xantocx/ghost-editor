import mongoose, { Schema, Model, Types, Document, PopulatedDoc, ObjectId } from "mongoose";

interface IVersion {
    _id:       Types.ObjectId
    timestamp: number
    isActive:  boolean
    content:   string
}

type VersionType = IVersion | PopulatedVersion
type VersionModelType = Model<VersionType>

const versionSchema = new Schema({
    timestamp: { type: Number,  required: true },
    isActive:  { type: Boolean, required: true },
    content:   { type: String,  required: true }
}, { _id: true });

export interface PopulatedVersion {
    _id:       Types.ObjectId
    timestamp: number
    isActive:  boolean
    content:   string
}




interface IVersionHistory {
    _id:      Types.ObjectId;
    versions: Types.DocumentArray<PopulatedDoc<Document<ObjectId> & IVersion>>
}

type VersionHistoryType = IVersionHistory | PopulatedVersionHistory
type VersionHistoryModelType = Model<VersionHistoryType>

const versionHistorySchema = new Schema({
    versions: [versionSchema]
}, { _id: true });

export interface PopulatedVersionHistory {
    _id:      Types.ObjectId
    versions: Types.DocumentArray<VersionType>
}





interface ILine {
    _id:            Types.ObjectId;
    versionHistory: Types.ObjectId
}

type LineType = ILine | PopulatedLine
type LineModelType = Model<LineType>

const lineSchema = new Schema({
    versionHistory: {
        type: Schema.Types.ObjectId,
        ref: "VersionHistory",
        required: true
    }
}, { _id: true })

export interface PopulatedLine {
    _id:            Types.ObjectId
    versionHistory: VersionHistoryType
}






interface IFile {
    _id:   Types.ObjectId;
    lines: Types.DocumentArray<LineType>
}

type FileType = IFile | PopulatedFile
type FileModelType = Model<FileType>

const fileSchema = new Schema({
    lines: [lineSchema]
}, { _id: true })

export interface PopulatedFile {
    _id:   Types.ObjectId
    lines: Types.DocumentArray<LineType>
}





interface IHead {
    _id:       Types.ObjectId
    file:      Types.ObjectId
    lineId:    Types.ObjectId
    versionId: Types.ObjectId
}

type HeadType = IHead | PopulatedHead
type HeadModelType = Model<HeadType>

const headSchema = new Schema({
    file: {
        type: Schema.Types.ObjectId,
        ref: "File",
        required: true
    },
    lineId:    { type: Schema.Types.ObjectId, required: true },
    versionId: { type: Schema.Types.ObjectId, required: true },
}, {
    _id: true,
    methods: {
        getLine: async function(): Promise<Types.Subdocument<Types.ObjectId> & LineType> {
            if (!this.populated("file")) {
                const head = await this.populate<Pick<PopulatedHead, "file">>("file")
                return head.file.lines.id(this.lineId)
            } else {
                return (this.file as unknown as PopulatedFile).lines.id(this.lineId)
            }
        },
        getVersion: async function(): Promise<Types.Subdocument<Types.ObjectId> & VersionType> {
            let line = await this.getLine()
            if (!line.populated("versionHistory")) {
                line = await this.populate("versionHistory")
            }
            return line.versionHistory.versions.id(this.versionId)
        }
    }
})

export interface PopulatedHead {
    _id:       Types.ObjectId
    file:      FileType
    lineId:    Types.ObjectId
    versionId: Types.ObjectId
}





interface IBlock {
    _id:          Types.ObjectId
    file:         Types.ObjectId
    firstLineId?: Types.ObjectId
    lastLineId?:  Types.ObjectId
    heads:        Types.DocumentArray<HeadType>
}

type BlockType = IBlock | PopulatedBlock
type BlockModelType = Model<BlockType>

const blockSchema = new Schema({
    file: {
        type: Schema.Types.ObjectId,
        ref: "File",
        required: true
    },
    firstLineId: Schema.Types.ObjectId,
    lastLineId:  Schema.Types.ObjectId,
    heads: [headSchema]
}, { _id: true })

export interface PopulatedBlock {
    _id:          Types.ObjectId
    file:         FileType
    firstLineId?: Types.ObjectId
    lastLineId?:  Types.ObjectId
    heads:        Types.DocumentArray<HeadType>
}







const Version = mongoose.model("Version", versionSchema)
const Line    = mongoose.model("Line", fileSchema)

export const VersionHistory = mongoose.model("VersionHistory", versionHistorySchema)
export const Head           = mongoose.model("Head", headSchema)
export const File           = mongoose.model("File", fileSchema)