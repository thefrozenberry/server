import mongoose, { Document, Schema } from 'mongoose';

// Define interface for the Payment document
export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  batchId: string;
  merchantOrderId: string;
  phonepeOrderId: string;
  amount: number;
  transactionId: string;
  paymentMethod: string;
  status: 'pending' | 'success' | 'failed' | 'rejected';
  receiptUrl: string;
  receiptCloudinaryId: string;
  webhookResponse: any;
  paymentDate: Date;
  failureReason: string;
  paymentGatewayData: any;
  remarks: string;
  description: string;
  approvedBy: mongoose.Types.ObjectId;
  metadata: {
    [key: string]: any;
  };
}

// Create the Payment schema
const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    batchId: {
      type: String,
      required: true,
    },
    merchantOrderId: {
      type: String,
      required: true,
    },
    phonepeOrderId: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    transactionId: {
      type: String,
      sparse: true,
    },
    paymentMethod: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'rejected'],
      default: 'pending',
    },
    receiptUrl: {
      type: String,
      default: '',
    },
    receiptCloudinaryId: {
      type: String,
      default: '',
    },
    webhookResponse: {
      type: Schema.Types.Mixed,
    },
    paymentDate: {
      type: Date,
    },
    failureReason: {
      type: String,
      default: '',
    },
    paymentGatewayData: {
      type: Schema.Types.Mixed,
    },
    remarks: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries
paymentSchema.index({ userId: 1 });
paymentSchema.index({ batchId: 1 });
paymentSchema.index({ merchantOrderId: 1 }, { unique: true });
paymentSchema.index({ phonepeOrderId: 1 }, { sparse: true });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: 1 });

// Create and export the Payment model
export const Payment = mongoose.model<IPayment>('Payment', paymentSchema); 