import mongoose, { Document, Schema } from 'mongoose';

// Define interfaces for nested objects
interface AttendancePolicy {
  minPercentage: number;
  graceDays: number;
}

interface ClassTiming {
  startTime: string; // Format: "HH:mm" (e.g., "09:00")
  endTime: string;   // Format: "HH:mm" (e.g., "17:00")
  lateThreshold: number; // Minutes after start time to be considered late
}

// Define interface for the Batch document
export interface IBatch extends Document {
  batchId: string;
  programName: string;
  name: string;
  courseCredit: number;
  services: mongoose.Types.ObjectId[];
  duration: string;
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'running' | 'completed';
  year: number;
  totalFee: number;
  students: mongoose.Types.ObjectId[];
  attendancePolicy: AttendancePolicy;
  classTiming: ClassTiming;
}

// Create the Batch schema
const batchSchema = new Schema<IBatch>(
  {
    batchId: {
      type: String,
      required: true,
      trim: true,
    },
    programName: {
      type: String,
      required: true,
      trim: true,
    },
    courseCredit: {
      type: Number,
      required: true,
      min: 0,
    },
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    duration: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['upcoming', 'running', 'completed'],
      default: 'upcoming',
    },
    year: {
      type: Number,
      required: true,
    },
    totalFee: {
      type: Number,
      required: true,
      min: 0,
    },
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    attendancePolicy: {
      minPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 75,
      },
      graceDays: {
        type: Number,
        required: true,
        min: 0,
        default: 3,
      },
    },
    classTiming: {
      startTime: {
        type: String,
        required: true,
        default: "09:00",
      },
      endTime: {
        type: String,
        required: true,
        default: "17:00",
      },
      lateThreshold: {
        type: Number,
        required: true,
        default: 15,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Create virtual field for name (compatibility)
batchSchema.virtual('name').get(function (this: IBatch) {
  return this.programName;
});

// Create index for faster queries
batchSchema.index({ batchId: 1 }, { unique: true });
batchSchema.index({ status: 1 });
batchSchema.index({ year: 1 });

// Automatically update batch status based on dates
batchSchema.pre('save', function (next) {
  const now = new Date();
  
  if (now < this.startDate) {
    this.status = 'upcoming';
  } else if (now >= this.startDate && now <= this.endDate) {
    this.status = 'running';
  } else if (now > this.endDate) {
    this.status = 'completed';
  }
  
  next();
});

// Create and export the Batch model
export const Batch = mongoose.model<IBatch>('Batch', batchSchema); 