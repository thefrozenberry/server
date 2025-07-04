import express from 'express';
import {
  initiatePayment,
  verifyPayment,
  phonepeWebhook,
  approvePayment,
  rejectPayment,
  getAllPayments,
  getPaymentById,
  getPaymentsByUser,
  getPaymentsByBatch,
  getPaymentReceipt,
  getPaymentReceiptFile,
  checkPaymentStatus,
  checkPaymentStatusByOrderId,
  paymentRedirect
} from '../controllers/paymentController';
import { protect, admin } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { paymentSchema } from '../utils/validationSchemas';

const router = express.Router();

// Public routes
router.post('/webhook', phonepeWebhook);
router.get('/status/:paymentId', checkPaymentStatus);
router.get('/status/order/:merchantOrderId', checkPaymentStatusByOrderId);
router.get('/redirect/:paymentId', paymentRedirect);

// User payment routes
router.post('/initiate', protect, validateRequest(paymentSchema), initiatePayment);
router.post('/verify', protect, verifyPayment);
router.get('/user/:userId', protect, getPaymentsByUser);
router.get('/:id/receipt', protect, getPaymentReceipt);
router.get('/:id/receipt/file', protect, getPaymentReceiptFile);
router.get('/:id', protect, getPaymentById);

// Admin payment routes
router.get('/', protect, admin, getAllPayments);
router.get('/batch/:batchId', protect, admin, getPaymentsByBatch);
router.put('/:id/approve', protect, admin, approvePayment);
router.put('/:id/reject', protect, admin, rejectPayment);

export default router; 