import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// Interface for JWT payload
interface JwtPayload {
  userId: string;
  role: string;
  type: string;
}

// Middleware to protect routes
export const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return next(new AppError('Not authorized, no token', 401));
    }

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JwtPayload;

      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return next(new AppError('Not authorized, user not found', 401));
      }

      // Check if user is active
      if (!user.activeStatus) {
        return next(new AppError('Your account has been deactivated', 401));
      }

      // Set user in request
      req.user = user;
      next();
    } catch (error) {
      return next(new AppError('Not authorized, token failed', 401));
    }
  }
);

// Middleware to check if user is admin
export const admin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as admin');
  }
};

// Middleware to check if user is superadmin
export const superadmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as superadmin');
  }
}; 