import mongoose, { Document, Schema } from 'mongoose';

// Define interface for the OTP document
export interface IOTP extends Document {
  phoneNumber: string;
  otp: string;
  purpose: 'registration' | 'login' | 'reset-password';
  expiresAt: Date;
  verified: boolean;
}

// Create the OTP schema
const otpSchema = new Schema<IOTP>(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['registration', 'login', 'reset-password'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + Number(process.env.OTP_EXPIRY || 5) * 60 * 1000), // Default 5 minutes
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries and automatic expiration
otpSchema.index({ phoneNumber: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic document expiration

// Create and export the OTP model
export const OTP = mongoose.model<IOTP>('OTP', otpSchema); 