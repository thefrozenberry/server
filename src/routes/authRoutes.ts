import express from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  verifyRegistrationOTP,
  verifyLoginOTP,
  completeProfile,
  registerSuperAdmin,
  loginWithPassword,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { 
  loginSchema, 
  registerSchema, 
  completeProfileSchema, 
  resetPasswordSchema,
  superAdminSchema,
  loginWithPasswordSchema
} from '../utils/validationSchemas';

const router = express.Router();

// Authentication routes
router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
// These routes need to be implemented
// router.post('/forgot-password', forgotPassword);
// router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);
router.post('/verify-registration-otp', verifyRegistrationOTP);
router.post('/verify-login-otp', verifyLoginOTP);
router.post('/complete-profile', protect, validateRequest(completeProfileSchema), completeProfile);

// Super admin and admin routes
router.post('/register-super-admin', validateRequest(superAdminSchema), registerSuperAdmin);
router.post('/login-with-password', validateRequest(loginWithPasswordSchema), loginWithPassword);

export default router; 