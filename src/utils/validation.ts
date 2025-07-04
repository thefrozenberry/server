import { z } from 'zod';

// User validation schemas
export const registerUserSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  consentStatus: z.boolean(),
});

export const verifyOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const loginSchema = z.object({
  phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
});

export const completeProfileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  profileImage: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  batchId: z.string(),
  department: z.string(),
  rollNumber: z.string(),
  semester: z.number().int().min(1).max(12),
  institution: z.string(),
  fatherName: z.string(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  }),
});

// Attendance validation schemas
export const checkInSchema = z.object({
  photo: z.string(), // Base64 encoded image
  location: z.object({
    lat: z.number(),
    long: z.number(),
  }),
  deviceInfo: z.string(),
});

export const checkOutSchema = z.object({
  photo: z.string(), // Base64 encoded image
  location: z.object({
    lat: z.number(),
    long: z.number(),
  }),
});

export const activitySchema = z.object({
  description: z.string().min(5, 'Description must be at least 5 characters'),
});

// Payment validation schemas
export const initiatePaymentSchema = z.object({
  batchId: z.string(),
  amount: z.number().int().positive('Amount must be positive'),
});

// Service validation schemas
export const createServiceSchema = z.object({
  serviceName: z.string().min(3, 'Service name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  dropdownOptions: z.object({
    title: z.string(),
    options: z.array(z.string()).min(1, 'At least one option is required'),
  }),
  unit: z.enum(['piece', 'pair', 'packet']),
  price: z.number().int().positive('Price must be positive'),
  imageURL: z.string().optional(),
});

// Batch validation schemas
export const createBatchSchema = z.object({
  batchId: z.string().min(2, 'Batch ID must be at least 2 characters'),
  programName: z.string().min(3, 'Program name must be at least 3 characters'),
  courseCredit: z.number().int().positive('Course credit must be positive'),
  services: z.array(z.string()),
  duration: z.string(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }),
  year: z.number().int().positive('Year must be positive'),
  totalFee: z.number().int().positive('Total fee must be positive'),
  attendancePolicy: z.object({
    minPercentage: z.number().min(0).max(100),
    graceDays: z.number().int().min(0),
  }),
});

// Admin validation schemas
export const createAdminSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
}); 