import mongoose, { Document, Schema } from 'mongoose';

// Define the subdocument schema
const subSchema = new Schema({
  name: String,
});

// Define instance methods on the subdocument schema
subSchema.methods.printName = function () {
  console.log(this.name);
};

// Define the parent document schema
const parentSchema = new Schema({
  sub: subSchema,
});

// Define the parent document model
interface IParentDocument extends Document {
  sub: any; // Use appropriate type for the subdocument
}

const Parent = mongoose.model<IParentDocument>('Parent', parentSchema);

// Access the subdocument instance method
const parent = new Parent();
parent.sub.name = 'Subdocument Name';
parent.sub.printName(); // Output: "Subdocument Name"
