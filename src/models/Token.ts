import mongoose, { Document, Schema } from 'mongoose';

// Define interface for the Token document
export interface IToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  type: 'refresh';
  expiresAt: Date;
  blacklisted: boolean;
  deviceInfo: string;
  ipAddress: string;
}

// Create the Token schema
const tokenSchema = new Schema<IToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['refresh'],
      default: 'refresh',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
    deviceInfo: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries and automatic expiration
tokenSchema.index({ userId: 1 });
tokenSchema.index({ token: 1 }, { unique: true });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic document expiration

// Create and export the Token model
export const Token = mongoose.model<IToken>('Token', tokenSchema); 