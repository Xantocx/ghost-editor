import mongoose, { Schema, Model, Types, Document } from "mongoose";

interface IVersion {
    _id:       Types.ObjectId
    timestamp: number
    isActive:  boolean
    content:   string
}

interface IVersionProps {}

type VersionModelType = Model<IVersion, {}, IVersionProps>

const versionSchema = new Schema<IVersion, VersionModelType, IVersionProps>({
    timestamp: { type: Number,  required: true },
    isActive:  { type: Boolean, required: true },
    content:   { type: String,  required: true }
}, { _id: true });

export type  Version      = IVersion & IVersionProps
       const VersionModel = mongoose.model<IVersion, VersionModelType>("Version", versionSchema)






interface IVersionHistory {
    _id:      Types.ObjectId
    versions: Version[]
}

interface IVersionHistoryProps {
    versions: Types.DocumentArray<Version>
}

type VersionHistoryModelType = Model<IVersionHistory, {}, IVersionHistoryProps>

const versionHistorySchema = new Schema<IVersionHistory, VersionHistoryModelType, IVersionHistoryProps>({
    versions: [versionSchema]
}, { _id: true });

export type  VerisonHistory      = IVersionHistory & IVersionHistoryProps
export const VersionHistoryModel = mongoose.model<IVersionHistory, VersionHistoryModelType>("VersionHistory", versionHistorySchema)









interface ILine {
    _id:            Types.ObjectId
    versionHistory: Types.ObjectId
}

interface ILineProps {}

type LineModelType = Model<ILine, {}, ILineProps>

const lineSchema = new Schema<ILine, LineModelType, ILineProps>({
    versionHistory: {
        type: Schema.Types.ObjectId,
        ref: "VersionHistory",
        required: true
    }
}, { _id: true })

export type  Line      = ILine & ILineProps
export const LineModel = mongoose.model<ILine, LineModelType>("Line", lineSchema)







interface IFile {
    _id:   Types.ObjectId
    lines: Types.ObjectId[]
}

interface IFileProps {}

type FileModelType = Model<IFile, {}, IFileProps>

const fileSchema = new Schema<IFile, FileModelType, IFileProps>({
    lines: [{
        type: Schema.Types.ObjectId,
        ref: "Line"
    }]
}, { _id: true })

export type  File      = IFile & IFileProps
export const FileModel = mongoose.model<IFile, FileModelType>("File", fileSchema)







interface IVersionReference {
    _id:            Types.ObjectId
    versionHistory: Types.ObjectId
    versionId:      Types.ObjectId
}

export interface IVersionReferenceProps {
    getVersion(): Promise<Types.Subdocument<Types.ObjectId> & IVersion>
}

type VersionReferenceModelType = Model<IVersionReference, {}, IVersionReferenceProps>

const versionReferenceSchema = new Schema<IVersionReference, VersionReferenceModelType/*, IVersionReferenceProps*/>({
    versionHistory: {
        type: Schema.Types.ObjectId,
        ref: "VersionHistory",
        required: true
    },
    versionId: {
        type: Schema.Types.ObjectId,
        required: true
    }
}, {
    _id: true,
    methods: {
        getVersion: async function(): Promise<Types.Subdocument<Types.ObjectId> & IVersion> {
            const reference = await this.populate<{ versionHistory: IVersionHistory & IVersionHistoryProps }>("versionHistory")
            return reference.versionHistory.versions.id(this.versionId)
        }
    }
})

export type  VersionReference      = IVersionReference & IVersionReferenceProps
       const VersionReferenceModel = mongoose.model<IVersionReference, VersionHistoryModelType>("VersionReference", versionReferenceSchema)







interface IHead {
    _id:        Types.ObjectId
    line:       Types.ObjectId
    versionRef: VersionReference
}

interface IHeadProps {
    getVersion(): Promise<Types.Subdocument<Types.ObjectId> & IVersion>
}

type HeadModelType = Model<IHead, {}, IHeadProps>
const headSchema = new Schema<IHead, HeadModelType/*, IHeadProps*/>({
    line: {
        type: Schema.Types.ObjectId,
        ref: "Line",
        required: true
    },
    versionRef: {
        type: versionReferenceSchema,
        required: true
    }
}, {
    _id: true,
    methods: {
        getVersion: async function(): Promise<Types.Subdocument<Types.ObjectId> & IVersion> {
            return await this.versionRef.getVersion()
        }
    }
})

export type  Head      = IHead & IHeadProps
export const HeadModel = mongoose.model<IHead, HeadModelType>("Head", headSchema)





interface IBlock {
    _id:        Types.ObjectId
    file:       Types.ObjectId
    firstLine?: Types.ObjectId
    lastLine?:  Types.ObjectId
    heads:      Head[]
}

interface IBlockProps {
    heads: Types.DocumentArray<Head>
}

type BlockModelType = Model<IBlock, {}, IBlockProps>

const blockSchema = new Schema<IBlock, BlockModelType, IBlockProps>({
    file: {
        type: Schema.Types.ObjectId,
        ref: "File",
        required: true
    },
    firstLine: {
        type: Schema.Types.ObjectId,
        ref: "Line",
        required: false
    },
    lastLine: {
        type: Schema.Types.ObjectId,
        ref: "Line",
        required: false
    },
    heads: [headSchema]
}, { _id: true })

export type  Block      = IBlock & IBlockProps
export const BlockModel = mongoose.model<IBlock, BlockModelType>("Block", blockSchema)