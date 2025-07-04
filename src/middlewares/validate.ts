import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Validate request data against a Zod schema
 * @param schema Zod schema to validate against
 * @param source Request property to validate ('body', 'query', 'params')
 * @returns Express middleware
 */
export const validate =
  (schema: AnyZodObject, source: 'body' | 'query' | 'params' = 'body') =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request data against schema
      const data = await schema.parseAsync(req[source]);
      
      // Replace request data with validated data
      req[source] = data;
      
      return next();
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        logger.warn(`Validation error: ${JSON.stringify(error.errors)}`);
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      
      // Pass other errors to error handler
      return next(error);
    }
  }; 