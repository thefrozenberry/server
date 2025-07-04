import express from 'express';
import {
  markAttendance,
  getUserAttendance,
  getTodayAttendance,
  getBatchAttendance,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats,
  exportAttendanceReport,
  checkIn,
  checkOut,
  recalculateStats,
  cleanupAttendance,
  checkStats,
} from '../controllers/attendenceController';
import { protect, admin } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { attendanceSchema } from '../utils/validationSchemas';

const router = express.Router();

// User attendance routes
router.post('/mark', protect, validateRequest(attendanceSchema), markAttendance);
router.post('/check-in', protect, checkIn);
router.post('/check-out', protect, checkOut);
router.get('/me', protect, getUserAttendance);
router.get('/me/today', protect, getTodayAttendance);
router.get('/stats', protect, getAttendanceStats);
router.get('/check-stats', protect, checkStats);

// Admin attendance routes
router.post('/recalculate-stats', protect, admin, recalculateStats);
router.post('/cleanup', protect, admin, cleanupAttendance);
router.get('/batch/:batchId', protect, admin, getBatchAttendance);
router.get('/export/:batchId', protect, admin, exportAttendanceReport);
router.get('/:id', protect, admin, getAttendanceById);
router.put('/:id', protect, admin, updateAttendance);
router.delete('/:id', protect, admin, deleteAttendance);

export default router; 