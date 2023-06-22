// Setup
import { Schema, Types, model, Model } from 'mongoose';

// Subdocument definition
interface Names {
    _id: Types.ObjectId;
    firstName: string;
}
// Document definition
interface User {
    names: Names[];
}

// TMethodsAndOverrides
type UserDocumentProps = {
    names: Types.DocumentArray<Names>;
};
type UserModelType = Model<User, {}, UserDocumentProps>;

// Create model
const UserModel = model<User, UserModelType>('User', new Schema<User, UserModelType>({
    names: [new Schema<Names>({ firstName: String })]
}));

const doc = new UserModel({});
doc.names[0].ownerDocument(); // Works!
