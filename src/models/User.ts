import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

// Define interfaces for nested objects
interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
}

interface LoginRecord {
  timestamp: Date;
  ip: string;
  device: string;
}

interface PaymentLog {
  date: Date;
  amount: number;
  method: string;
  transactionId: string;
  receiptUrl: string;
  status: string;
}

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  percentage: number;
}

// Define interface for the User document
export interface IUser extends Document {
  userId: string;
  phoneNumber: string;
  email: string;
  password: string;
  batchId: string;
  profileImage: {
    url: string;
    cloudinaryId: string;
  };
  firstName: string;
  lastName: string;
  fullName: string;
  name: string;
  phone: string;
  department: string;
  rollNumber: string;
  semester: number;
  institution: string;
  fatherName: string;
  address: Address;
  paymentStatus: boolean;
  activeStatus: boolean;
  courseCreditScore: number;
  grade: string;
  role: 'user' | 'admin' | 'superadmin';
  openingStamp: Date;
  lastLogin: LoginRecord[];
  paymentLogs: PaymentLog[];
  attendanceStats: AttendanceStats;
  profileComplete: boolean;
  consentStatus: boolean;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

// Create the User schema
const userSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    batchId: {
      type: String,
      default: '',
    },
    profileImage: {
      url: {
        type: String,
        default: '',
      },
      cloudinaryId: {
        type: String,
        default: '',
      },
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      default: '',
    },
    rollNumber: {
      type: String,
      default: '',
    },
    semester: {
      type: Number,
      default: 0,
    },
    institution: {
      type: String,
      default: '',
    },
    fatherName: {
      type: String,
      default: '',
    },
    address: {
      street: {
        type: String,
        default: '',
      },
      city: {
        type: String,
        default: '',
      },
      state: {
        type: String,
        default: '',
      },
      pincode: {
        type: String,
        default: '',
      },
    },
    paymentStatus: {
      type: Boolean,
      default: false,
    },
    activeStatus: {
      type: Boolean,
      default: true,
    },
    courseCreditScore: {
      type: Number,
      default: 0,
    },
    grade: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
    },
    openingStamp: {
      type: Date,
      default: Date.now,
    },
    lastLogin: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        ip: {
          type: String,
        },
        device: {
          type: String,
        },
      },
    ],
    paymentLogs: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        amount: {
          type: Number,
        },
        method: {
          type: String,
        },
        transactionId: {
          type: String,
        },
        receiptUrl: {
          type: String,
        },
        status: {
          type: String,
          enum: ['success', 'failed', 'pending'],
          default: 'pending',
        },
      },
    ],
    attendanceStats: {
      present: {
        type: Number,
        default: 0,
      },
      absent: {
        type: Number,
        default: 0,
      },
      late: {
        type: Number,
        default: 0,
      },
      halfDay: {
        type: Number,
        default: 0,
      },
      percentage: {
        type: Number,
        default: 0,
      },
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
    consentStatus: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create virtual field for fullName
userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Create virtual field for name (compatibility)
userSchema.virtual('name').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Create virtual field for phone (compatibility)
userSchema.virtual('phone').get(function (this: IUser) {
  return this.phoneNumber;
});

// Add matchPassword method to the schema
userSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Create index for faster queries
userSchema.index({ userId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phoneNumber: 1 }, { unique: true });
userSchema.index({ role: 1 });

// Create and export the User model
export const User = mongoose.model<IUser>('User', userSchema); 