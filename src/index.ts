import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';
import { morganMiddleware } from './middlewares/morgan';
import path from 'path';

// Import routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import paymentRoutes from './routes/paymentRoutes';
import serviceRoutes from './routes/serviceRoutes';
import batchRoutes from './routes/batchRoutes';
import adminRoutes from './routes/adminRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Trust proxy (important for rate limiting behind nginx)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morganMiddleware);

// Static file serving for uploads (receipts, etc.)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, // 24 hours in seconds
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'strict'
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handler middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled Rejection:', error);
  // Close server & exit process
  process.exit(1);
}); 