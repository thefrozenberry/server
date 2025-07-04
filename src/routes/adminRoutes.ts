import express from 'express';
import {
  getDashboardStats,
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  exportData,
  systemLogs,
} from '../controllers/adminController';
import { protect, admin, superadmin } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { adminSchema } from '../utils/validationSchemas';

const router = express.Router();

// Admin dashboard routes
router.get('/dashboard', protect, admin, getDashboardStats);
router.get('/logs', protect, admin, systemLogs);
router.get('/export/:type', protect, admin, exportData);

// Superadmin routes for managing admins
router.post('/', protect, superadmin, validateRequest(adminSchema), createAdmin);
router.get('/', protect, superadmin, getAllAdmins);
router.get('/:id', protect, superadmin, getAdminById);
router.put('/:id', protect, superadmin, validateRequest(adminSchema), updateAdmin);
router.delete('/:id', protect, superadmin, deleteAdmin);

export default router; 