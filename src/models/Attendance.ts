import mongoose, { Document, Schema } from 'mongoose';

// Define interfaces for nested objects
interface Photo {
  url: string;
  cloudinaryId: string;
}

interface Location {
  lat: number;
  long: number;
}

interface CheckPoint {
  time: Date;
  photo: Photo;
  location: Location;
  deviceInfo: string;
}

interface Activity {
  description: string;
  timestamp: Date;
}

// Define interface for the Attendance document
export interface IAttendance extends Document {
  userId: mongoose.Types.ObjectId;
  batchId: string;
  date: Date;
  checkIn: CheckPoint;
  checkOut: CheckPoint;
  status: 'present' | 'absent' | 'late' | 'half-day';
  approved: boolean;
  approvedBy: mongoose.Types.ObjectId;
  activities: Activity[];
  remarks: string;
}

// Create the Attendance schema
const attendanceSchema = new Schema<IAttendance>(
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
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkIn: {
      time: {
        type: Date,
      },
      photo: {
        url: {
          type: String,
          default: '',
        },
        cloudinaryId: {
          type: String,
          default: '',
        },
      },
      location: {
        lat: {
          type: Number,
        },
        long: {
          type: Number,
        },
      },
      deviceInfo: {
        type: String,
      },
    },
    checkOut: {
      time: {
        type: Date,
      },
      photo: {
        url: {
          type: String,
          default: '',
        },
        cloudinaryId: {
          type: String,
          default: '',
        },
      },
      location: {
        lat: {
          type: Number,
        },
        long: {
          type: Number,
        },
      },
      deviceInfo: {
        type: String,
      },
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day'],
      default: 'absent',
    },
    approved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    activities: [
      {
        description: {
          type: String,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    remarks: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ batchId: 1, date: 1 });

// Create and export the Attendance model
export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema); 