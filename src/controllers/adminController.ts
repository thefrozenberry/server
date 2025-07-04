import { Request, Response } from "express";
import { User } from '../models/User';
import { Batch } from '../models/Batch';
import { Service } from '../models/Service';
import { Payment } from '../models/Payment';
import { Attendance } from '../models/Attendance';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import dayjs from 'dayjs';
import { logger } from '../utils/logger';

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  // Get total users count
  const totalUsers = await User.countDocuments({ role: 'user' });
  
  // Get active users count
  const activeUsers = await User.countDocuments({ role: 'user', activeStatus: true });
  
  // Get total batches count
  const totalBatches = await Batch.countDocuments();
  
  // Get active batches count
  const activeBatches = await Batch.countDocuments({ status: { $in: ['upcoming', 'running'] } });
  
  // Get total services count
  const totalServices = await Service.countDocuments();
  
  // Get total revenue
  const revenueResult = await Payment.aggregate([
    {
      $match: {
        status: 'success',
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]);
  
  const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
  
  // Get recent payments
  const recentPayments = await Payment.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name email phone')
    .populate('batchId', 'programName');
  
  // Get batch enrollment stats
  const batchStats = await Batch.aggregate([
    {
      $project: {
        programName: 1,
        totalFee: 1,
        studentCount: { $size: '$students' },
        fillRate: {
          $multiply: [
            {
              $cond: [
                { $eq: [{ $size: '$students' }, 0] },
                0,
                { $divide: [{ $size: '$students' }, { $add: [{ $size: '$students' }, 10] }] }
              ]
            },
            100,
          ],
        },
      },
    },
    {
      $sort: {
        fillRate: -1,
      },
    },
    {
      $limit: 5,
    },
  ]);
  
  // Get attendance stats for the current month
  const startOfMonth = dayjs().startOf('month').toDate();
  const endOfMonth = dayjs().endOf('month').toDate();
  
  const attendanceStats = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startOfMonth, $lte: endOfMonth },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  // Format attendance stats
  const formattedAttendanceStats: {
    present: number;
    absent: number;
    late: number;
    [key: string]: number;
  } = {
    present: 0,
    absent: 0,
    late: 0,
  };
  
  attendanceStats.forEach((stat) => {
    if (stat._id) {
      formattedAttendanceStats[stat._id.toString()] = stat.count;
    }
  });
  
  // Calculate attendance rate
  const totalAttendance = formattedAttendanceStats.present + formattedAttendanceStats.absent + formattedAttendanceStats.late;
  const attendanceRate = totalAttendance > 0
    ? Math.round(((formattedAttendanceStats.present + formattedAttendanceStats.late) / totalAttendance) * 100)
    : 0;
  
  res.status(200).json({
    success: true,
    data: {
      userStats: {
        total: totalUsers,
        active: activeUsers,
      },
      batchStats: {
        total: totalBatches,
        active: activeBatches,
        topBatches: batchStats,
      },
      serviceStats: {
        total: totalServices,
      },
      financialStats: {
        totalRevenue,
        recentPayments,
      },
      attendanceStats: {
        ...formattedAttendanceStats,
        attendanceRate,
      },
    },
  });
});

// @desc    Create a new admin
// @route   POST /api/admin
// @access  Private/SuperAdmin
export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, phoneNumber, password, role } = req.body;

  // Check if user with the same email or phone already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (existingUser) {
    throw new AppError('User with this email or phone number already exists', 400);
  }

  // Create new admin user
  const user = await User.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    role: role || 'admin',
    userId: `ADMIN${Date.now()}`,
    profileComplete: true,
  });

  res.status(201).json({
    success: true,
    message: 'Admin created successfully',
    data: {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
    },
  });
});

// @desc    Get all admins
// @route   GET /api/admin
// @access  Private/SuperAdmin
export const getAllAdmins = asyncHandler(async (req: Request, res: Response) => {
  // Get all admin users
  const admins = await User.find({ role: 'admin' })
    .select('-password')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: admins.length,
    data: admins,
  });
});

// @desc    Get admin by ID
// @route   GET /api/admin/:id
// @access  Private/SuperAdmin
export const getAdminById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get admin user
  const admin = await User.findById(id).select('-password');

  if (!admin || admin.role !== 'admin') {
    throw new AppError('Admin not found', 404);
  }

  res.status(200).json({
    success: true,
    data: admin,
  });
});

// @desc    Update admin
// @route   PUT /api/admin/:id
// @access  Private/SuperAdmin
export const updateAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, email, phoneNumber, password } = req.body;
  
  // Find admin user
  const admin = await User.findById(id);

  if (!admin || admin.role !== 'admin') {
    throw new AppError('Admin not found', 404);
  }

  // Check if email or phone already exists with another user
  if (email && email !== admin.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }
  }

  if (phoneNumber && phoneNumber !== admin.phoneNumber) {
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      throw new AppError('Phone number already in use', 400);
    }
  }

  // Update admin fields
  if (firstName) admin.firstName = firstName;
  if (lastName) admin.lastName = lastName;
  if (email) admin.email = email;
  if (phoneNumber) admin.phoneNumber = phoneNumber;

  // Update password if provided
  if (password) {
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(password, salt);
  }

  // Save updated admin
  await admin.save();

  res.status(200).json({
    success: true,
    message: 'Admin updated successfully',
    data: {
      userId: admin.userId,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      role: admin.role,
    },
  });
});

// @desc    Delete admin
// @route   DELETE /api/admin/:id
// @access  Private/SuperAdmin
export const deleteAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Find admin user
  const admin = await User.findById(id);

  if (!admin || admin.role !== 'admin') {
    throw new AppError('Admin not found', 404);
  }

  // Cannot delete your own account
  const adminId = admin._id ? admin._id.toString() : '';
  const userId = req.user?._id ? req.user._id.toString() : '';
  
  if (adminId === userId) {
    throw new AppError('You cannot delete your own account', 400);
  }

  // Delete admin
  await User.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Admin deleted successfully',
  });
});

// @desc    Generate system report
// @route   GET /api/admin/report
// @access  Private/Admin
export const generateSystemReport = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  // Set default date range to current month if not provided
  const start = startDate 
    ? new Date(startDate as string) 
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  
  const end = endDate 
    ? new Date(endDate as string) 
    : new Date();
  
  // Get user statistics
  const userStats = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
      },
    },
  ]);
  
  // Get batch statistics
  const batchStats = await Batch.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  // Get payment statistics
  const paymentStats = await Payment.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$amount' },
      },
    },
  ]);
  
  // Get attendance statistics
  const attendanceStats = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  // Create PDF report
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Add title
  page.drawText('System Report', {
    x: 50,
    y: height - 50,
    size: 24,
    font: boldFont,
  });
  
  // Add date range
  page.drawText(`Date Range: ${dayjs(start).format('DD/MM/YYYY')} - ${dayjs(end).format('DD/MM/YYYY')}`, {
    x: 50,
    y: height - 80,
    size: 12,
    font: font,
  });
  
  // Add user statistics
  page.drawText('User Statistics', {
    x: 50,
    y: height - 120,
    size: 16,
    font: boldFont,
  });
  
  let y = height - 150;
  userStats.forEach((stat) => {
    page.drawText(`${stat._id}: ${stat.count}`, {
      x: 50,
      y,
      size: 12,
      font: font,
    });
    y -= 20;
  });
  
  // Add batch statistics
  y -= 20;
  page.drawText('Batch Statistics', {
    x: 50,
    y,
    size: 16,
    font: boldFont,
  });
  
  y -= 30;
  batchStats.forEach((stat) => {
    page.drawText(`${stat._id}: ${stat.count}`, {
      x: 50,
      y,
      size: 12,
      font: font,
    });
    y -= 20;
  });
  
  // Add payment statistics
  y -= 20;
  page.drawText('Payment Statistics', {
    x: 50,
    y,
    size: 16,
    font: boldFont,
  });
  
  y -= 30;
  paymentStats.forEach((stat) => {
    page.drawText(`${stat._id}: ${stat.count} (Rs. ${stat.total.toFixed(2)})`, {
      x: 50,
      y,
      size: 12,
      font: font,
    });
    y -= 20;
  });
  
  // Add attendance statistics
  y -= 20;
  page.drawText('Attendance Statistics', {
    x: 50,
    y,
    size: 16,
    font: boldFont,
  });
  
  y -= 30;
  attendanceStats.forEach((stat) => {
    page.drawText(`${stat._id}: ${stat.count}`, {
      x: 50,
      y,
      size: 12,
      font: font,
    });
    y -= 20;
  });
  
  // Add footer
  page.drawText(`Generated on: ${dayjs().format('DD/MM/YYYY HH:mm:ss')}`, {
    x: 50,
    y: 50,
    size: 10,
    font: font,
  });
  
  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();
  
  // Create directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'uploads', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Save PDF file
  const fileName = `system_report_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  fs.writeFileSync(filePath, pdfBytes);
  
  // Send file to client
  res.download(filePath, fileName, (err) => {
    if (err) {
      logger.error(`Error downloading report: ${err.message}`);
      throw new AppError('Error downloading file', 500);
    }
  });
});

// @desc    Get system logs
// @route   GET /api/admin/logs
// @access  Private/Admin
export const systemLogs = asyncHandler(async (req: Request, res: Response) => {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
    
    // Get the latest log file or the one specified in query
    const { file } = req.query;
    const logFile = file 
      ? path.join(logsDir, file as string)
      : path.join(logsDir, logFiles[0]);
    
    // Check if file exists
    if (!fs.existsSync(logFile)) {
      throw new AppError('Log file not found', 404);
    }
    
    // Read log file (last 500 lines to avoid memory issues)
    const logs = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .slice(-500)
      .join('\n');
    
    res.status(200).json({
      success: true,
      data: {
        files: logFiles,
        currentFile: path.basename(logFile),
        logs,
      },
    });
  } catch (error: any) {
    logger.error(`Error reading logs: ${error.message}`);
    throw new AppError('Error reading log files', 500);
  }
});

// @desc    Export data
// @route   GET /api/admin/export/:type
// @access  Private/Admin
export const exportData = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.params;
  const { startDate, endDate } = req.query;
  
  // Set default date range to current month if not provided
  const start = startDate 
    ? new Date(startDate as string) 
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  
  const end = endDate 
    ? new Date(endDate as string) 
    : new Date();
  
  let data: any[] = [];
  let fileName = '';
  
  // Export different data based on type
  switch (type) {
    case 'users':
      data = await User.find({
        createdAt: { $gte: start, $lte: end },
      }).select('-password');
      fileName = 'users_export.json';
      break;
    
    case 'batches':
      data = await Batch.find({
        createdAt: { $gte: start, $lte: end },
      });
      fileName = 'batches_export.json';
      break;
    
    case 'payments':
      data = await Payment.find({
        createdAt: { $gte: start, $lte: end },
      });
      fileName = 'payments_export.json';
      break;
    
    case 'attendance':
      data = await Attendance.find({
        date: { $gte: start, $lte: end },
      });
      fileName = 'attendance_export.json';
      break;
    
    default:
      throw new AppError('Invalid export type', 400);
  }
  
  // Create directory if it doesn't exist
  const exportsDir = path.join(process.cwd(), 'uploads', 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  
  // Save export file
  const filePath = path.join(exportsDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  
  // Send file to client
  res.download(filePath, fileName, (err) => {
    if (err) {
      logger.error(`Error downloading export: ${err.message}`);
      throw new AppError('Error downloading file', 500);
    }
  });
}); 