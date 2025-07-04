import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

// Middleware for validating request data using Zod schemas
export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request against schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      next();
    } catch (error: any) {
      // Format Zod error messages
      const formattedErrors = error.errors?.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors || error.message,
      });
    }
  };
}; 