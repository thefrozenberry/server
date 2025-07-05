import { Request, Response, NextFunction } from 'express';
import { User, IUser, Batch } from '../models';
import { AppError } from '../utils/appError';
import { uploadProfileImage, deleteFromCloudinary } from '../utils/cloudinary';
import { processProfileImage, base64ToBuffer } from '../utils/image';

/**
 * Get current user profile
 */
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser;
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
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
          paymentStatus: user.paymentStatus,
          activeStatus: user.activeStatus,
          courseCreditScore: user.courseCreditScore,
          grade: user.grade,
          role: user.role,
          profileComplete: user.profileComplete,
          attendanceStats: user.attendanceStats,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 */
export const updateCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser;
    const {
      firstName,
      lastName,
      phoneNumber,
      email,
      department,
      rollNumber,
      semester,
      institution,
      fatherName,
      address,
    } = req.body;
    
    // Check if email is already in use by another user
    if (email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new AppError('Email already in use', 400);
      }
    }
    
    // Check if phone number is already in use by another user
    if (phoneNumber !== user.phoneNumber) {
      const existingUser = await User.findOne({ phoneNumber });
      if (existingUser) {
        throw new AppError('Phone number already in use', 400);
      }
    }
    
    // Update user profile
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.email = email || user.email;
    user.department = department || user.department;
    user.rollNumber = rollNumber || user.rollNumber;
    user.semester = semester || user.semester;
    user.institution = institution || user.institution;
    user.fatherName = fatherName || user.fatherName;
    
    // Update address if provided
    if (address) {
      user.address = {
        ...user.address,
        ...address,
      };
    }
    
    // Save user
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
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
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload profile image
 */
export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser;
    const { imageUrl, cloudinaryId } = req.body;
    
    if (!imageUrl || !cloudinaryId) {
      throw new AppError('Image URL and Cloudinary ID are required', 400);
    }
    
    // Delete old image from Cloudinary if exists
    if (user.profileImage?.cloudinaryId) {
      await deleteFromCloudinary(user.profileImage.cloudinaryId);
    }
    
    // Update user profile with the provided Cloudinary URL
    user.profileImage = {
      url: imageUrl,
      cloudinaryId: cloudinaryId,
    };
    
    // Save user
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    // Filtering
    const filter: any = {};
    
    if (req.query.role) {
      filter.role = req.query.role;
    }
    
    if (req.query.activeStatus) {
      filter.activeStatus = req.query.activeStatus === 'true';
    }
    
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus === 'true';
    }
    
    if (req.query.batchId) {
      filter.batchId = req.query.batchId;
    }
    
    // Search
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { userId: searchRegex },
      ];
    }
    
    // Get users
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (Admin only)
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user by ID (Admin only)
 */
export const updateUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      phoneNumber,
      email,
      batchId,
      department,
      rollNumber,
      semester,
      institution,
      fatherName,
      address,
      paymentStatus,
      activeStatus,
      courseCreditScore,
      grade,
      role,
    } = req.body;
    
    const user = await User.findById(id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Check if email is already in use by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id && existingUser._id.toString() !== id) {
        throw new AppError('Email already in use', 400);
      }
    }
    
    // Check if phone number is already in use by another user
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const existingUser = await User.findOne({ phoneNumber });
      if (existingUser && existingUser._id && existingUser._id.toString() !== id) {
        throw new AppError('Phone number already in use', 400);
      }
    }
    
    // Update user fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (email) user.email = email;
    if (batchId) user.batchId = batchId;
    if (department) user.department = department;
    if (rollNumber) user.rollNumber = rollNumber;
    if (semester) user.semester = semester;
    if (institution) user.institution = institution;
    if (fatherName) user.fatherName = fatherName;
    if (paymentStatus !== undefined) user.paymentStatus = paymentStatus;
    if (activeStatus !== undefined) user.activeStatus = activeStatus;
    if (courseCreditScore !== undefined) user.courseCreditScore = courseCreditScore;
    if (grade) user.grade = grade;
    
    // Only super admin can change role
    const admin = req.user as IUser;
    if (role && admin.role === 'superadmin') {
      user.role = role;
    }
    
    // Update address if provided
    if (address) {
      user.address = {
        ...user.address,
        ...address,
      };
    }
    
    // Save user
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
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
          paymentStatus: user.paymentStatus,
          activeStatus: user.activeStatus,
          courseCreditScore: user.courseCreditScore,
          grade: user.grade,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get users by batch ID
 */
export const getUsersByBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    
    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    // Get users
    const users = await User.find({ batchId })
      .select('-password')
      .sort({ firstName: 1, lastName: 1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments({ batchId });
    
    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's batch details
 */
export const getCurrentUserBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser;
    
    // Check if user has a batch assigned
    if (!user.batchId) {
      return res.status(200).json({
        success: true,
        message: 'No batch assigned',
        data: {
          batch: null
        }
      });
    }
    
    // Get batch details
    const batch = await Batch.findById(user.batchId)
      .populate('services', 'serviceName description price');
    
    if (!batch) {
      return res.status(200).json({
        success: true,
        message: 'Batch not found',
        data: {
          batch: null
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        batch: {
          _id: batch._id,
          batchId: batch.batchId,
          programName: batch.programName,
          courseCredit: batch.courseCredit,
          services: batch.services,
          duration: batch.duration,
          startDate: batch.startDate,
          endDate: batch.endDate,
          status: batch.status,
          year: batch.year,
          totalFee: batch.totalFee,
          attendancePolicy: batch.attendancePolicy
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user by ID (Admin only)
 */
export const deleteUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Delete profile image from Cloudinary if exists
    if (user.profileImage?.cloudinaryId) {
      await deleteFromCloudinary(user.profileImage.cloudinaryId);
    }

    // Delete user from database
    await user.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}; 