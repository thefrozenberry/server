import { Request, Response } from "express";
import { Payment, IPayment } from '../models/Payment';
import { User, IUser } from '../models/User';
import { Batch, IBatch } from '../models/Batch';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { logger } from '../utils/logger';
import phonepeSDK from '../utils/phonepeSDK';
import mongoose from 'mongoose';

// Helper function to safely convert IDs to strings
const safeIdToString = (id: unknown): string => {
  if (id instanceof mongoose.Types.ObjectId) {
    return id.toString();
  }
  return String(id);
};

// @desc    Initiate payment
// @route   POST /api/payments/initiate
// @access  Private
export const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
  const { userId, batchId, amount, paymentMethod, description } = req.body;

  // Check if user exists
  const user = await User.findOne({ userId });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if batch exists
  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Create payment record with temporary merchant order ID
  const tempMerchantOrderId = `TEMP_${Date.now()}`;
  const payment = await Payment.create({
    userId: user._id,
    batchId,
    amount,
    paymentMethod,
    description,
    status: 'pending',
    merchantOrderId: tempMerchantOrderId,
  });

  // Handle different payment methods
  if (paymentMethod === 'phonepe') {
    try {
      // Generate redirect URL to our server first, then redirect to frontend with payment ID
      const redirectUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://swrzee.in'}/api/payments/redirect/${safeIdToString(payment._id)}`;
      
      logger.info(`Payment initiated for user ${user.userId}, redirecting to: ${redirectUrl}`);
      
      // Generate PhonePe checkout URL using SDK
      const phonepeResponse = await phonepeSDK.generateCheckoutUrl(
        amount, 
        redirectUrl,
        {
          udf1: `userId:${safeIdToString(user._id)}`,
          udf2: `batchId:${batchId}`,
          udf3: `paymentId:${safeIdToString(payment._id)}`
        }
      );
      
      // Update payment with transaction details
      payment.merchantOrderId = phonepeResponse.orderId;
      payment.transactionId = phonepeResponse.orderId;
      await payment.save();
      
      // Return payment link to client
      res.status(200).json({
        success: true,
        message: 'Payment initiated successfully',
        data: {
          paymentId: safeIdToString(payment._id),
          paymentLink: phonepeResponse.redirectUrl,
        },
      });
    } catch (error: any) {
      // Handle API error
      payment.status = 'failed';
      payment.failureReason = error.message || 'Payment gateway error';
      await payment.save();
      
      throw new AppError('Failed to initiate payment', 500);
    }
  } else if (paymentMethod === 'cash' || paymentMethod === 'bank_transfer') {
    // For cash or bank transfer, mark as pending for admin approval
    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully. Pending admin approval.',
      data: payment,
    });
  } else {
    throw new AppError('Invalid payment method', 400);
  }
});

// @desc    Payment redirect handler (for PhonePe redirects)
// @route   GET /api/payments/redirect/:paymentId
// @access  Public
export const paymentRedirect = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  
  // Find payment by ID
  const payment = await Payment.findById(paymentId);
  
  if (!payment) {
    // Redirect to frontend with error
    return res.redirect('https://swrzee.in/check-status?error=payment_not_found');
  }
  
  // Redirect to frontend with payment ID
  const frontendUrl = `https://swrzee.in/check-status?paymentId=${paymentId}`;
  res.redirect(frontendUrl);
});

// @desc    PhonePe webhook handler
// @route   POST /api/payments/webhook
// @access  Public
export const phonepeWebhook = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get X-VERIFY header
    const authorization = req.headers['x-verify'] as string;
    
    if (!authorization) {
      logger.error('PhonePe webhook: Missing X-VERIFY header');
      return res.status(400).json({ status: 'ERROR', message: 'Missing X-VERIFY header' });
    }
    
    // Get request body
    const payload = req.body;
    const payloadString = JSON.stringify(payload);
    
    // Verify callback
    // Note: In a real implementation, you would get these from environment variables
    const username = process.env.PHONEPE_WEBHOOK_USERNAME || 'merchant';
    const password = process.env.PHONEPE_WEBHOOK_PASSWORD || 'merchant';
    
    try {
      // Verify webhook using SDK
      const callbackResponse = phonepeSDK.verifyWebhookCallback(
        username,
        password,
        authorization,
        payloadString
      );
      
      // Process webhook data
      const { merchantOrderId, transactionId, amount, state } = callbackResponse.payload;
      
      logger.info(`PhonePe webhook received for transaction ${merchantOrderId}`);
      
      // Find payment by transaction ID
      const payment = await Payment.findOne({ merchantOrderId });
      
      if (!payment) {
        logger.error(`PhonePe webhook: Payment not found for transaction ${merchantOrderId}`);
        return res.status(404).json({ status: 'ERROR', message: 'Payment not found' });
      }
      
      // Update payment status based on PhonePe response
      if (state === 'COMPLETED') {
        payment.status = 'success';
        payment.paymentDate = new Date();
        payment.webhookResponse = callbackResponse;
        
        // Update user payment status
        await User.findByIdAndUpdate(payment.userId, {
          paymentStatus: true,
          $push: {
            paymentLogs: {
              date: new Date(),
              amount: payment.amount,
              method: payment.paymentMethod,
              transactionId: transactionId || merchantOrderId,
              status: 'success',
            },
          },
        });
        
        // Generate receipt
        const receiptUrl = await generatePaymentReceipt(safeIdToString(payment._id));
        payment.receiptUrl = receiptUrl;
        
        logger.info(`PhonePe webhook: Payment successful for transaction ${merchantOrderId}`);
      } else {
        payment.status = 'failed';
        payment.failureReason = callbackResponse.payload.errorCode || 'Payment failed';
        payment.webhookResponse = callbackResponse;
        
        logger.warn(`PhonePe webhook: Payment failed for transaction ${merchantOrderId}`);
      }
      
      // Save updated payment
      await payment.save();
      
      // Acknowledge webhook receipt
      return res.status(200).json({ status: 'OK', message: 'Webhook processed successfully' });
    } catch (error: any) {
      logger.error('PhonePe webhook verification error:', error);
      return res.status(400).json({ status: 'ERROR', message: 'Invalid webhook signature' });
    }
  } catch (error: any) {
    logger.error('PhonePe webhook error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
});

// @desc    Verify payment (legacy endpoint - kept for backward compatibility)
// @route   POST /api/payments/verify
// @access  Private
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { merchantOrderId } = req.body;
  
  // Find payment by merchant order ID
  const payment = await Payment.findOne({ merchantOrderId });
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  
  try {
    // Check payment status using SDK
    const statusResponse = await phonepeSDK.checkPaymentStatus(merchantOrderId);
    
    // Update payment status based on PhonePe response
    if (statusResponse.state === 'COMPLETED') {
      payment.status = 'success';
      payment.paymentDate = new Date();
      
      // Update user payment status
      await User.findByIdAndUpdate(payment.userId, {
        paymentStatus: true,
        $push: {
          paymentLogs: {
            date: new Date(),
            amount: payment.amount,
            method: payment.paymentMethod,
            transactionId: statusResponse.transactionId || merchantOrderId,
            status: 'success',
          },
        },
      });
      
      // Generate receipt
      const receiptUrl = await generatePaymentReceipt(safeIdToString(payment._id));
      payment.receiptUrl = receiptUrl;
    } else {
      payment.status = 'failed';
      payment.failureReason = statusResponse.errorCode || 'Payment verification failed';
    }
    
    // Save updated payment
    await payment.save();
    
    // Redirect to frontend with status
    res.redirect(`${req.protocol}://${req.get('host')}/payment-status?status=${payment.status}&paymentId=${safeIdToString(payment._id)}`);
  } catch (error: any) {
    logger.error(`Payment verification error: ${error.message}`);
    payment.status = 'failed';
    payment.failureReason = 'Payment verification error';
    await payment.save();
    
    // Redirect to frontend with error status
    res.redirect(`${req.protocol}://${req.get('host')}/payment-status?status=error&paymentId=${safeIdToString(payment._id)}`);
  }
});

// @desc    Check payment status (new endpoint for frontend)
// @route   GET /api/payments/status/:paymentId
// @access  Public
export const checkPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  
  // Find payment by ID
  const payment = await Payment.findById(paymentId)
    .populate('userId', 'name email phone')
    .populate('batchId', 'name startDate endDate');
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  
  // If payment is still pending, check with PhonePe
  if (payment.status === 'pending' && payment.paymentMethod === 'phonepe') {
    try {
      const statusResponse = await phonepeSDK.checkPaymentStatus(payment.merchantOrderId);
      
      // Update payment status based on PhonePe response
      if (statusResponse.state === 'COMPLETED') {
        payment.status = 'success';
        payment.paymentDate = new Date();
        
        // Update user payment status
        await User.findByIdAndUpdate(payment.userId, {
          paymentStatus: true,
          $push: {
            paymentLogs: {
              date: new Date(),
              amount: payment.amount,
              method: payment.paymentMethod,
              transactionId: statusResponse.transactionId || payment.merchantOrderId,
              status: 'success',
            },
          },
        });
        
        // Generate receipt if not already generated
        if (!payment.receiptUrl) {
          const receiptUrl = await generatePaymentReceipt(safeIdToString(payment._id));
          payment.receiptUrl = receiptUrl;
        }
      } else if (statusResponse.state === 'FAILED') {
        payment.status = 'failed';
        payment.failureReason = statusResponse.errorCode || 'Payment failed';
      }
      
      // Save updated payment
      await payment.save();
    } catch (error: any) {
      logger.error(`Payment status check error: ${error.message}`);
      // Don't throw error, just return current status
    }
  }
  
  // Return payment status
  res.status(200).json({
    success: true,
    data: {
      paymentId: safeIdToString(payment._id),
      merchantOrderId: payment.merchantOrderId,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      failureReason: payment.failureReason,
      receiptUrl: payment.receiptUrl,
      user: payment.userId,
      batch: payment.batchId
    },
  });
});

// @desc    Check payment status by merchant order ID (alternative endpoint)
// @route   GET /api/payments/status/order/:merchantOrderId
// @access  Public
export const checkPaymentStatusByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const { merchantOrderId } = req.params;
  
  // Find payment by merchant order ID
  const payment = await Payment.findOne({ merchantOrderId })
    .populate('userId', 'name email phone')
    .populate('batchId', 'name startDate endDate');
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  
  // If payment is still pending, check with PhonePe
  if (payment.status === 'pending' && payment.paymentMethod === 'phonepe') {
    try {
      const statusResponse = await phonepeSDK.checkPaymentStatus(merchantOrderId);
      
      // Update payment status based on PhonePe response
      if (statusResponse.state === 'COMPLETED') {
        payment.status = 'success';
        payment.paymentDate = new Date();
        
        // Update user payment status
        await User.findByIdAndUpdate(payment.userId, {
          paymentStatus: true,
          $push: {
            paymentLogs: {
              date: new Date(),
              amount: payment.amount,
              method: payment.paymentMethod,
              transactionId: statusResponse.transactionId || merchantOrderId,
              status: 'success',
            },
          },
        });
        
        // Generate receipt if not already generated
        if (!payment.receiptUrl) {
          const receiptUrl = await generatePaymentReceipt(safeIdToString(payment._id));
          payment.receiptUrl = receiptUrl;
        }
      } else if (statusResponse.state === 'FAILED') {
        payment.status = 'failed';
        payment.failureReason = statusResponse.errorCode || 'Payment failed';
      }
      
      // Save updated payment
      await payment.save();
    } catch (error: any) {
      logger.error(`Payment status check error: ${error.message}`);
      // Don't throw error, just return current status
    }
  }
  
  // Return payment status
  res.status(200).json({
    success: true,
    data: {
      paymentId: safeIdToString(payment._id),
      merchantOrderId: payment.merchantOrderId,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      failureReason: payment.failureReason,
      receiptUrl: payment.receiptUrl,
      user: payment.userId,
      batch: payment.batchId
    },
  });
});

// @desc    Admin approve payment
// @route   PUT /api/payments/:id/approve
// @access  Private (Admin)
export const approvePayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Find payment by ID
  const payment = await Payment.findById(id);
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  
  // Only pending payments can be approved
  if (payment.status !== 'pending') {
    throw new AppError(`Payment cannot be approved because it is ${payment.status}`, 400);
  }
  
  // Update payment status
  payment.status = 'success';
  payment.paymentDate = new Date();
  payment.approvedBy = req.user?._id as unknown as mongoose.Types.ObjectId;
  
  // Save updated payment
  await payment.save();
  
  // Update user payment status
  await User.findByIdAndUpdate(payment.userId, {
    paymentStatus: true,
    $push: {
      paymentLogs: {
        date: new Date(),
        amount: payment.amount,
        method: payment.paymentMethod,
        transactionId: payment.merchantOrderId,
        status: 'success',
      },
    },
  });
  
  // Generate receipt
  const receiptUrl = await generatePaymentReceipt(safeIdToString(payment._id));
  payment.receiptUrl = receiptUrl;
  await payment.save();
  
  res.status(200).json({
    success: true,
    message: 'Payment approved successfully',
    data: payment,
  });
});

// @desc    Admin reject payment
// @route   PUT /api/payments/:id/reject
// @access  Private (Admin)
export const rejectPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  // Find payment by ID
  const payment = await Payment.findById(id);
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  
  // Only pending payments can be rejected
  if (payment.status !== 'pending') {
    throw new AppError(`Payment cannot be rejected because it is ${payment.status}`, 400);
  }
  
  // Update payment status
  payment.status = 'rejected';
  payment.failureReason = reason || 'Rejected by admin';
  payment.approvedBy = req.user?._id as unknown as mongoose.Types.ObjectId;
  
  // Save updated payment
  await payment.save();
  
  res.status(200).json({
    success: true,
    message: 'Payment rejected successfully',
    data: payment,
  });
});

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private (Admin)
export const getAllPayments = asyncHandler(async (req: Request, res: Response) => {
  const payments = await Payment.find()
    .populate('userId', 'name email phone')
    .populate('batchId', 'name startDate endDate')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private
export const getPaymentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const payment = await Payment.findById(id)
    .populate('userId', 'name email phone')
    .populate('batchId', 'name startDate endDate');
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  
  // Check if user is authorized to view this payment
  const isAdmin = req.user?.role === 'admin';
  const isOwner = safeIdToString(payment.userId._id) === safeIdToString(req.user?._id);
  
  if (!isAdmin && !isOwner) {
    throw new AppError('Not authorized to access this payment', 403);
  }
  
  res.status(200).json({
    success: true,
    data: payment,
  });
});

// @desc    Get payments by user ID
// @route   GET /api/payments/user/:userId
// @access  Private
export const getPaymentsByUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Check if user is authorized to view these payments
  const isAdmin = req.user?.role === 'admin';
  const isOwner = safeIdToString(userId) === safeIdToString(req.user?._id);
  
  if (!isAdmin && !isOwner) {
    throw new AppError('Not authorized to access these payments', 403);
  }
  
  const payments = await Payment.find({ userId })
    .populate('batchId', 'name startDate endDate')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});

// @desc    Get payments by batch ID
// @route   GET /api/payments/batch/:batchId
// @access  Private (Admin)
export const getPaymentsByBatch = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.params;
  
  // Check if batch exists
  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new AppError('Batch not found', 404);
  }
  
  const payments = await Payment.find({ batchId })
    .populate('userId', 'name email phone')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});

// @desc    Generate payment receipt PDF
// @route   GET /api/payments/:id/receipt
// @access  Private
export const getPaymentReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const payment = await Payment.findById(id)
    .populate('userId', 'name email phone')
    .populate('batchId', 'name');
  
  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  
  // Check if user is authorized to view this payment
  const isAdmin = req.user?.role === 'admin';
  const isOwner = safeIdToString(payment.userId._id) === safeIdToString(req.user?._id);
  
  if (!isAdmin && !isOwner) {
    throw new AppError('Not authorized to access this payment', 403);
  }
  
  // Generate receipt if it doesn't exist
  if (!payment.receiptUrl && payment.status === 'success') {
    const receiptUrl = await generatePaymentReceipt(safeIdToString(payment._id));
    payment.receiptUrl = receiptUrl;
    await payment.save();
  }
  
  if (!payment.receiptUrl) {
    throw new AppError('Receipt not available for this payment', 400);
  }
  
  // Return receipt URL
  res.status(200).json({
    success: true,
    data: {
      receiptUrl: payment.receiptUrl,
    },
  });
});

// @desc    Get payment receipt file
// @route   GET /api/payments/:id/receipt/file
// @access  Private
export const getPaymentReceiptFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info(`Attempting to serve receipt file for payment ID: ${id}`);
  
  const payment = await Payment.findById(id)
    .populate('userId', 'name email phone')
    .populate('batchId', 'name');
  
  if (!payment) {
    logger.error(`Payment not found for ID: ${id}`);
    throw new AppError('Payment not found', 404);
  }
  
  // Check if user is authorized to view this payment
  const isAdmin = req.user?.role === 'admin';
  const isOwner = safeIdToString(payment.userId._id) === safeIdToString(req.user?._id);
  
  if (!isAdmin && !isOwner) {
    logger.error(`Unauthorized access attempt for payment ${id} by user ${req.user?._id}`);
    throw new AppError('Not authorized to access this payment', 403);
  }
  
  logger.info(`Payment found: ${payment._id}, receiptUrl: ${payment.receiptUrl}, status: ${payment.status}`);
  
  // Generate receipt if it doesn't exist
  if (!payment.receiptUrl && payment.status === 'success') {
    logger.info(`Generating receipt for payment ${id}`);
    const receiptUrl = await generatePaymentReceipt(safeIdToString(payment._id));
    payment.receiptUrl = receiptUrl;
    await payment.save();
    logger.info(`Generated receipt URL: ${receiptUrl}`);
  }
  
  if (!payment.receiptUrl) {
    logger.error(`No receipt URL available for payment ${id}`);
    throw new AppError('Receipt not available for this payment', 400);
  }
  
  // Extract file path from receipt URL
  // The receiptUrl is in format: /uploads/receipts/filename.pdf
  const relativePath = payment.receiptUrl;
  const filePath = path.join(process.cwd(), relativePath);
  
  logger.info(`Looking for receipt file at: ${filePath}`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    logger.error(`Receipt file not found at path: ${filePath}`);
    // Try to list files in the directory to debug
    const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      logger.error(`Files in uploads/receipts directory: ${files.join(', ')}`);
    } else {
      logger.error(`Uploads directory does not exist: ${uploadsDir}`);
    }
    throw new AppError('Receipt file not found', 404);
  }
  
  logger.info(`Receipt file found, serving: ${filePath}`);
  
  // Set headers for file download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="receipt_${id}.pdf"`);
  
  // Send the file
  res.sendFile(filePath);
});

// Helper function to generate payment receipt
const generatePaymentReceipt = async (paymentId: string): Promise<string> => {
  try {
    // Find payment with user and batch details
    const payment = await Payment.findById(paymentId)
      .populate('userId', 'firstName lastName email phoneNumber')
      .populate('batchId', 'name');
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    // Get font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Set margins
    const margin = 50;
    const width = page.getWidth() - 2 * margin;
    
    // Try to embed logo (now using PNG)
    let logoImage = null;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'swrzee-logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      }
    } catch (error) {
      logger.warn('Could not embed logo image:', error);
    }
    
    // Draw company header
    let y = page.getHeight() - margin;
    
    // Draw logo if available
    if (logoImage) {
      const logoWidth = 60;
      const logoHeight = 60;
      const logoX = margin;
      const logoY = y - logoHeight;
      
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
      
      // Company info starts after logo
      y = logoY - 20;
    } else {
      y -= 20;
    }
    
    // Draw company name
    page.drawText('Swrzee Enterprise', {
      x: margin,
      y,
      size: 16,
      font: boldFont,
    });
    
    y -= 25;
    
    // Draw company tagline
    page.drawText('Micro Manufacturing cum Training Centre', {
      x: margin,
      y,
      size: 12,
      font: font,
    });
    
    y -= 20;
    
    // Draw registration details
    page.drawText('Udyam Regd. No. AS-19 - 0018220 | Estd-01-01-2025', {
      x: margin,
      y,
      size: 10,
      font: font,
    });
    
    y -= 20;
    
    // Draw address
    page.drawText('PO & Dist. - Kokrajhar : Bodoland : Assam : 783370', {
      x: margin,
      y,
      size: 10,
      font: font,
    });
    
    y -= 20;
    
    // Draw email
    page.drawText('Email - enterprise@swrzee.in', {
      x: margin,
      y,
      size: 10,
      font: font,
    });
    
    y -= 30;
    
    // Draw border line
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + width, y },
      thickness: 2,
      color: rgb(0, 0, 0),
    });
    
    y -= 30;
    
    // Draw receipt title
    page.drawText('PAYMENT RECEIPT', {
      x: margin,
      y,
      size: 18,
      font: boldFont,
    });
    
    // Draw receipt details
    const user = payment.userId as unknown as IUser;
    const batch = payment.batchId as unknown as IBatch;
    
    const receiptDetails = [
      { label: 'Receipt No:', value: safeIdToString(payment._id) },
      { label: 'Date:', value: dayjs(payment.paymentDate).format('DD/MM/YYYY') },
      { label: 'Payment Method:', value: payment.paymentMethod },
      { label: 'Transaction ID:', value: payment.transactionId || payment.merchantOrderId || 'N/A' },
      { label: 'Status:', value: payment.status.toUpperCase() },
    ];
    
    y -= 40;
    
    receiptDetails.forEach(detail => {
      page.drawText(detail.label, {
        x: margin,
        y,
        size: 10,
        font: boldFont,
      });
      
      page.drawText(detail.value, {
        x: margin + 100,
        y,
        size: 10,
        font: font,
      });
      
      y -= 20;
    });
    
    // Draw customer details
    y -= 20;
    page.drawText('Customer Details', {
      x: margin,
      y,
      size: 14,
      font: boldFont,
    });
    
    y -= 25;
    
    const customerDetails = [
      { label: 'Name:', value: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A' },
      { label: 'Email:', value: user.email },
      { label: 'Phone:', value: user.phoneNumber || 'N/A' },
    ];
    
    customerDetails.forEach(detail => {
      page.drawText(detail.label, {
        x: margin,
        y,
        size: 10,
        font: boldFont,
      });
      
      page.drawText(detail.value, {
        x: margin + 100,
        y,
        size: 10,
        font: font,
      });
      
      y -= 20;
    });
    
    // Draw payment details
    y -= 20;
    page.drawText('Payment Details', {
      x: margin,
      y,
      size: 14,
      font: boldFont,
    });
    
    y -= 25;
    
    // Draw table header
    const tableHeaders = ['Description', 'Amount'];
    const columnWidths = [width * 0.7, width * 0.3];
    
    tableHeaders.forEach((header, index) => {
      const x = margin + (index > 0 ? columnWidths[0] : 0);
      
      page.drawText(header, {
        x,
        y,
        size: 10,
        font: boldFont,
      });
    });
    
    // Draw horizontal line
    y -= 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + width, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Draw table row
    y -= 20;
    
    // Description column
    page.drawText(payment.description || `Payment for ${batch.name}`, {
      x: margin,
      y,
      size: 10,
      font: font,
    });
    
    // Amount column
    page.drawText(`Rs. ${payment.amount.toFixed(2)}`, {
      x: margin + columnWidths[0],
      y,
      size: 10,
      font: font,
    });
    
    // Draw horizontal line
    y -= 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + width, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Draw total
    y -= 20;
    page.drawText('Total:', {
      x: margin + columnWidths[0] - 50,
      y,
      size: 10,
      font: boldFont,
    });
    
    page.drawText(`Rs. ${payment.amount.toFixed(2)}`, {
      x: margin + columnWidths[0],
      y,
      size: 10,
      font: boldFont,
    });
    
    // Draw footer
    y = margin + 50;
    page.drawText('Thank you for your payment!', {
      x: margin,
      y,
      size: 12,
      font: boldFont,
    });
    
    y -= 20;
    page.drawText('This is a computer-generated receipt and does not require a signature.', {
      x: margin,
      y,
      size: 8,
      font: font,
    });
    
    // Save PDF to buffer
    const pdfBytes = await pdfDoc.save();
    
    // Create directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Save PDF to file
    const fileName = `receipt_${paymentId}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);
    
    // Return file URL
    return `/uploads/receipts/${fileName}`;
  } catch (error: any) {
    logger.error(`Error generating receipt: ${error.message}`);
    throw new Error(`Failed to generate receipt: ${error.message}`);
  }
}; 