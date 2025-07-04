import express from 'express';
import {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  getActiveBatches,
  getBatchStudents,
  addStudentToBatch,
  removeStudentFromBatch,
} from '../controllers/batchController';
import { protect, admin } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { batchSchema } from '../utils/validationSchemas';

const router = express.Router();

// Public batch routes
router.get('/active', getActiveBatches);

// Admin batch routes
router.post('/', protect, admin, validateRequest(batchSchema), createBatch);
router.get('/', protect, admin, getAllBatches);
router.get('/:id', protect, admin, getBatchById);
router.put('/:id', protect, admin, validateRequest(batchSchema), updateBatch);
router.delete('/:id', protect, admin, deleteBatch);
router.get('/:id/students', protect, admin, getBatchStudents);
router.post('/:id/students/:userId', protect, admin, addStudentToBatch);
router.delete('/:id/students/:userId', protect, admin, removeStudentFromBatch);

export default router; 