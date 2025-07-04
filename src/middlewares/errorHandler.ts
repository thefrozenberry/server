import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

// Error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error
  let statusCode = 500;
  let message = 'Server Error';
  let stack = process.env.NODE_ENV === 'production' ? '🥞' : err.stack;
  let errors: any[] = [];

  // Log error
  logger.error(`${req.method} ${req.url} - ${err.message}`, {
    error: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Handle specific error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors || [];
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values((err as any).errors).map((val: any) => ({
      field: val.path,
      message: val.message,
    }));
  } else if (err.name === 'CastError') {
    // Mongoose cast error
    statusCode = 400;
    message = `Invalid ${(err as any).path}: ${(err as any).value}`;
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired
    statusCode = 401;
    message = 'Token expired';
  } else if ((err as any).code === 11000) {
    // Duplicate key error
    statusCode = 400;
    message = 'Duplicate field value entered';
    const field = Object.keys((err as any).keyValue)[0];
    errors = [{ field, message: `${field} already exists` }];
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined,
    stack: process.env.NODE_ENV === 'production' ? undefined : stack,
  });
}; 