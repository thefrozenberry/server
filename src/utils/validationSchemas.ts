import { z } from 'zod';

// Register schema
export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    consentStatus: z.boolean(),
  }),
});

// Login schema
export const loginSchema = z.object({
  body: z.object({
    phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  }),
});

// Complete profile schema
export const completeProfileSchema = z.object({
  body: z.object({
    department: z.string().min(2, 'Department is required'),
    rollNumber: z.string().min(1, 'Roll number is required'),
    semester: z.number().int().min(1, 'Semester must be at least 1'),
    institution: z.string().min(2, 'Institution name is required'),
    fatherName: z.string().min(2, 'Father name is required'),
    address: z.object({
      street: z.string().min(2, 'Street is required'),
      city: z.string().min(2, 'City is required'),
      state: z.string().min(2, 'State is required'),
      pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    }),
    consentStatus: z.boolean(),
  }),
});

// Update profile schema
export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters').optional(),
    lastName: z.string().min(2, 'Last name must be at least 2 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits').optional(),
    department: z.string().min(2, 'Department is required').optional(),
    rollNumber: z.string().min(1, 'Roll number is required').optional(),
    semester: z.number().int().min(1, 'Semester must be at least 1').optional(),
    institution: z.string().min(2, 'Institution name is required').optional(),
    fatherName: z.string().min(2, 'Father name is required').optional(),
    address: z
      .object({
        street: z.string().min(2, 'Street is required'),
        city: z.string().min(2, 'City is required'),
        state: z.string().min(2, 'State is required'),
        pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
      })
      .optional(),
  }),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

// Attendance schema
export const attendanceSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    batchId: z.string().min(1, 'Batch ID is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    status: z.enum(['present', 'absent', 'late']),
    remarks: z.string().optional(),
  }),
});

// Payment schema
export const paymentSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    batchId: z.string().min(1, 'Batch ID is required'),
    amount: z.number().min(1, 'Amount must be at least 1'),
    paymentMethod: z.enum(['phonepe', 'cash', 'bank_transfer']),
    description: z.string().optional(),
  }),
});

// Service schema
export const serviceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Service name is required'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    price: z.number().min(0, 'Price must be at least 0'),
    duration: z.number().min(1, 'Duration must be at least 1'),
    isActive: z.boolean().default(true),
    category: z.string().min(2, 'Category is required'),
    features: z.array(z.string()).optional(),
  }),
});

// Batch schema
export const batchSchema = z.object({
  body: z.object({
    batchId: z.string().min(1, 'Batch ID is required'),
    programName: z.string().min(2, 'Program name is required'),
    courseCredit: z.number().min(0, 'Course credit must be at least 0'),
    services: z.array(z.string()).min(1, 'At least one service is required'),
    duration: z.string().min(1, 'Duration is required'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
    year: z.number().int().min(2000, 'Year must be valid'),
    totalFee: z.number().min(0, 'Total fee must be at least 0'),
    status: z.enum(['upcoming', 'running', 'completed']).optional(),
    attendancePolicy: z.object({
      minPercentage: z.number().min(0).max(100).default(75),
      graceDays: z.number().min(0).default(3)
    }).optional()
  }),
});

// Admin schema
export const adminSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    role: z.enum(['admin', 'superadmin']).default('admin'),
  }),
});

// Super Admin schema
export const superAdminSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phoneNumber: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),
});

// Login with Password schema
export const loginWithPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
}); 