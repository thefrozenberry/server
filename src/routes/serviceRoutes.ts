import express from 'express';
import {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  getActiveServices,
} from '../controllers/serviceController';
import { protect, admin } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { serviceSchema } from '../utils/validationSchemas';

const router = express.Router();

// Public service routes
router.get('/active', getActiveServices);

// Admin service routes
router.post('/', protect, admin, validateRequest(serviceSchema), createService);
router.get('/', protect, admin, getAllServices);
router.get('/:id', protect, admin, getServiceById);
router.put('/:id', protect, admin, validateRequest(serviceSchema), updateService);
router.delete('/:id', protect, admin, deleteService);

export default router; 