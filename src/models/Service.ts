import mongoose, { Document, Schema } from 'mongoose';

// Define interfaces for nested objects
interface DropdownOptions {
  title: string;
  options: string[];
}

// Define interface for the Service document
export interface IService extends Document {
  serviceName: string;
  description: string;
  dropdownOptions: DropdownOptions;
  unit: 'piece' | 'pair' | 'packet';
  duration: number;
  price: number;
  imageURL: {
    url: string;
    cloudinaryId: string;
  };
  active: boolean;
}

// Create the Service schema
const serviceSchema = new Schema<IService>(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    dropdownOptions: {
      title: {
        type: String,
        required: true,
      },
      options: {
        type: [String],
        required: true,
      },
    },
    unit: {
      type: String,
      enum: ['piece', 'pair', 'packet'],
      default: 'piece',
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    imageURL: {
      url: {
        type: String,
        default: '',
      },
      cloudinaryId: {
        type: String,
        default: '',
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries
serviceSchema.index({ serviceName: 1 });
serviceSchema.index({ active: 1 });

// Create and export the Service model
export const Service = mongoose.model<IService>('Service', serviceSchema); 