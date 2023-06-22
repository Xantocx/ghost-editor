import { Model, Schema, model } from 'mongoose';

interface IUser {
  firstName: string;
  lastName: string;
}

// Put all user instance methods in this interface:
interface IUserMethods {
  fullName(): string;
}

// Create a new Model type that knows about IUserMethods...
type UserModel = Model<IUser, {}, IUserMethods>;

// And a schema that knows about IUserMethods
const schema = new Schema<IUser, UserModel, IUserMethods>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true }
});
schema.method('fullName', function fullName() {
  return this.firstName + ' ' + this.lastName;
});

const User = model<IUser, UserModel>('User', schema);

const user = new User({ firstName: 'Jean-Luc', lastName: 'Picard' });
const fullName: string = user.fullName(); // 'Jean-Luc Picard'
