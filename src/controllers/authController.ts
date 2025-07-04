import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models';
import { AppError } from '../utils/appError';
import { createOTP, verifyOTP, sendOTP } from '../utils/otp';
import { generateToken, saveRefreshToken, verifyRefreshToken, blacklistToken } from '../utils/jwt';
import { sendWelcomeEmail, sendOtpEmail } from '../utils/email';

// Extend the Express Request type to include session data
declare module 'express-session' {
  interface SessionData {
    registrationData?: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
      email: string;
      password: string;
      consentStatus: boolean;
    };
  }
}

/**
 * Register a new user (Step 1: Initiate registration with OTP)
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phoneNumber, email, password, consentStatus } = req.body;
    
    // Check if phone number already exists
    const existingUserByPhone = await User.findOne({ phoneNumber });
    if (existingUserByPhone) {
      throw new AppError('Phone number already registered', 400);
    }
    
    // Check if email already exists
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      throw new AppError('Email already registered', 400);
    }
    
    // Store user data in session for later use
    if (req.session) {
      req.session.registrationData = {
        firstName,
        lastName,
        phoneNumber,
        email,
        password,
        consentStatus,
      };
    }
    
    // Generate and send OTP
    const otp = await createOTP(phoneNumber, 'registration');
    
    // Send OTP via SMS (mock implementation)
    await sendOTP(phoneNumber, otp, 'registration');
    
    // Send OTP via email as well
    await sendOtpEmail(email, otp, 'registration');
    
    res.status(200).json({
      success: true,
      message: 'OTP sent to your phone number and email',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a new user (Step 2: Verify OTP and create user)
 */
export const verifyRegistrationOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, otp, firstName, lastName, email, password, consentStatus } = req.body;
    
    // Verify OTP
    const isValid = await verifyOTP(phoneNumber, otp, 'registration');
    
    if (!isValid) {
      throw new AppError('Invalid or expired OTP', 400);
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ phoneNumber }, { email }] 
    });
    
    if (existingUser) {
      throw new AppError('User with this phone number or email already exists', 400);
    }
    
    // Create user with data from request
    const user = await User.create({
      firstName,
      lastName,
      phoneNumber,
      email,
      password,
      consentStatus: consentStatus || false,
      userId: `USER${Date.now()}`,
      profileComplete: false,
    });
    
    // Generate tokens
    const accessToken = generateToken(user, 'access');
    const refreshToken = generateToken(user, 'refresh');
    
    // Save refresh token to database
    const userId = user._id?.toString() || '';
    if (!userId) {
      throw new AppError('Invalid user ID', 400);
    }
    await saveRefreshToken(
      userId,
      refreshToken,
      process.env.JWT_REFRESH_EXPIRY || '7d',
      req.headers['user-agent'] || '',
      req.ip || ''
    );
    
    // Send welcome email
    await sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
          profileComplete: user.profileComplete,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete user profile
 */
export const completeProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      firstName,
      lastName,
      profileImage,
      email,
      phoneNumber,
      batchId,
      department,
      rollNumber,
      semester,
      institution,
      fatherName,
      address,
    } = req.body;
    
    // Get user from request (set by authenticate middleware)
    const user = req.user as IUser;
    
    // Update user profile
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.phoneNumber = phoneNumber;
    user.batchId = batchId;
    user.department = department;
    user.rollNumber = rollNumber;
    user.semester = semester;
    user.institution = institution;
    user.fatherName = fatherName;
    user.address = address;
    
    // Update profile image if provided
    if (profileImage) {
      user.profileImage = {
        url: profileImage,
        cloudinaryId: '', // This would be set when using Cloudinary
      };
    }
    
    // Mark profile as complete
    user.profileComplete = true;
    
    // Save user
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          email: user.email,
          batchId: user.batchId,
          profileImage: user.profileImage,
          department: user.department,
          rollNumber: user.rollNumber,
          semester: user.semester,
          institution: user.institution,
          fatherName: user.fatherName,
          address: user.address,
          role: user.role,
          profileComplete: user.profileComplete,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login (Step 1: Initiate login with OTP)
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ phoneNumber });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    if (!user.activeStatus) {
      throw new AppError('User account is inactive', 403);
    }
    
    // Generate and send OTP
    const otp = await createOTP(phoneNumber, 'login');
    
    // Send OTP via SMS (mock implementation)
    await sendOTP(phoneNumber, otp, 'login');
    
    // Send OTP via email as well
    await sendOtpEmail(user.email, otp, 'login');
    
    res.status(200).json({
      success: true,
      message: 'OTP sent to your phone number and email',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login (Step 2: Verify OTP and generate tokens)
 */
export const verifyLoginOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, otp } = req.body;
    
    // Verify OTP
    const isValid = await verifyOTP(phoneNumber, otp, 'login');
    
    if (!isValid) {
      throw new AppError('Invalid or expired OTP', 400);
    }
    
    // Find user
    const user = await User.findOne({ phoneNumber });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    if (!user.activeStatus) {
      throw new AppError('User account is inactive', 403);
    }
    
    // Update last login
    user.lastLogin.push({
      timestamp: new Date(),
      ip: req.ip || '',
      device: req.headers['user-agent'] || '',
    });
    
    await user.save();
    
    // Generate tokens
    const accessToken = generateToken(user, 'access');
    const refreshToken = generateToken(user, 'refresh');
    
    // Save refresh token to database
    const userId = user._id?.toString() || '';
    if (!userId) {
      throw new AppError('Invalid user ID', 400);
    }
    await saveRefreshToken(
      userId,
      refreshToken,
      process.env.JWT_REFRESH_EXPIRY || '7d',
      req.headers['user-agent'] || '',
      req.ip || ''
    );
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
          profileComplete: user.profileComplete,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }
    
    // Verify refresh token
    const tokenDoc = await verifyRefreshToken(refreshToken);
    
    // Find user
    const user = await User.findById(tokenDoc.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    if (!user.activeStatus) {
      throw new AppError('User account is inactive', 403);
    }
    
    // Generate new tokens
    const newAccessToken = generateToken(user, 'access');
    const newRefreshToken = generateToken(user, 'refresh');
    
    // Blacklist old refresh token
    await blacklistToken(refreshToken);
    
    // Save new refresh token to database
    const userId = user._id?.toString() || '';
    if (!userId) {
      throw new AppError('Invalid user ID', 400);
    }
    await saveRefreshToken(
      userId,
      newRefreshToken,
      process.env.JWT_REFRESH_EXPIRY || '7d',
      req.headers['user-agent'] || '',
      req.ip || ''
    );
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }
    
    // Blacklist refresh token
    await blacklistToken(refreshToken);
    
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a super admin
 * This can only be done once when setting up the system
 */
export const registerSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;
    
    // Check if a superadmin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      throw new AppError('Super admin already exists', 400);
    }
    
    // Check if user with the same email or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    
    if (existingUser) {
      throw new AppError('User with this email or phone number already exists', 400);
    }
    
    // Create super admin user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      role: 'superadmin',
      userId: `SADMIN${Date.now()}`,
      profileComplete: true,
      consentStatus: true,
      activeStatus: true,
    });
    
    // Generate tokens
    const accessToken = generateToken(user, 'access');
    const refreshToken = generateToken(user, 'refresh');
    
    // Save refresh token to database
    const userId = user._id?.toString() || '';
    if (!userId) {
      throw new AppError('Invalid user ID', 400);
    }
    await saveRefreshToken(
      userId,
      refreshToken,
      process.env.JWT_REFRESH_EXPIRY || '7d',
      req.headers['user-agent'] || '',
      req.ip || ''
    );
    
    res.status(201).json({
      success: true,
      message: 'Super admin created successfully',
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login with email/password (for admin and superadmin)
 */
export const loginWithPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists with this email
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }
    
    if (!user.activeStatus) {
      throw new AppError('User account is inactive', 403);
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }
    
    // Update last login
    user.lastLogin.push({
      timestamp: new Date(),
      ip: req.ip || '',
      device: req.headers['user-agent'] || '',
    });
    
    await user.save();
    
    // Generate tokens
    const accessToken = generateToken(user, 'access');
    const refreshToken = generateToken(user, 'refresh');
    
    // Save refresh token to database
    const userId = user._id?.toString() || '';
    if (!userId) {
      throw new AppError('Invalid user ID', 400);
    }
    await saveRefreshToken(
      userId,
      refreshToken,
      process.env.JWT_REFRESH_EXPIRY || '7d',
      req.headers['user-agent'] || '',
      req.ip || ''
    );
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
          profileComplete: user.profileComplete,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}; 