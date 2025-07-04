import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/appError';
import { User, IUser } from '../models/User';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Authenticate user using JWT
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new AppError('Authentication required', 401);
    }
    
    // Verify token
    const decoded = verifyToken(token, 'access');
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    if (!user.activeStatus) {
      throw new AppError('User account is inactive', 403);
    }
    
    // Attach user to request
    req.user = user;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has required role
 * @param roles Allowed roles
 */
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    
    next();
  };
};

/**
 * Check if user has completed profile
 */
export const requireCompleteProfile = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  
  if (!req.user.profileComplete) {
    return next(new AppError('Please complete your profile first', 403));
  }
  
  next();
};

/**
 * Check if user has active payment
 */
export const requireActivePayment = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  
  if (!req.user.paymentStatus) {
    return next(new AppError('Payment required to access this resource', 403));
  }
  
  next();
}; 