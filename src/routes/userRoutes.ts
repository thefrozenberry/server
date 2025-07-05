import express from 'express';
import {
  getCurrentUser,
  updateCurrentUser,
  uploadAvatar,
  getAllUsers,
  getUserById,
  updateUserById,
  getCurrentUserBatch,
  deleteUserById,
} from '../controllers/userController';
import { protect, admin } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { updateProfileSchema } from '../utils/validationSchemas';

const router = express.Router();

// User routes (protected)
router.get('/profile', protect, getCurrentUser);
router.get('/batch', protect, getCurrentUserBatch);
router.put('/profile', protect, validateRequest(updateProfileSchema), updateCurrentUser);
router.put('/profile/image', protect, uploadAvatar);

// Admin routes (protected + admin)
router.get('/', protect, admin, getAllUsers);
router.get('/:id', protect, admin, getUserById);
router.put('/:id', protect, admin, updateUserById);
router.delete('/:id', protect, admin, deleteUserById);
// TODO: Implement status update functionality
// router.put('/:id/status', protect, admin, updateUserStatus);

export default router; 