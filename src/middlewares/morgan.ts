import morgan, { StreamOptions } from 'morgan';
import { logger } from '../utils/logger';

// Create a stream for morgan that writes to our logger
const stream: StreamOptions = {
  write: (message: string) => {
    // Remove the newline character from the end of the message
    const logMessage = message.trim();
    logger.http(logMessage);
  },
};

// Skip function for morgan - only log in development
const skip = () => {
  const env = process.env.NODE_ENV || 'development';
  return env !== 'development';
};

// Create morgan middleware with custom format
export const morganMiddleware = morgan(
  // Define format
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip }
); 