import { Request, Response } from "express";
import { Batch } from '../models/Batch';
import { User } from '../models/User';
import { Service } from '../models/Service';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import mongoose from 'mongoose';

// @desc    Create a new batch
// @route   POST /api/batches
// @access  Private/Admin
export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const { 
    batchId, 
    programName, 
    courseCredit, 
    services, 
    duration, 
    startDate, 
    endDate, 
    year, 
    totalFee,
    attendancePolicy
  } = req.body;

  // Check if batch with the same ID already exists
  const existingBatch = await Batch.findOne({ batchId });
  if (existingBatch) {
    throw new AppError('Batch with this ID already exists', 400);
  }

  // Create new batch
  const batch = await Batch.create({
    batchId,
    programName,
    courseCredit,
    services,
    duration,
    startDate,
    endDate,
    year,
    totalFee,
    attendancePolicy: attendancePolicy || {
      minPercentage: 75,
      graceDays: 3
    }
  });

  res.status(201).json({
    success: true,
    message: 'Batch created successfully',
    data: batch,
  });
});

// @desc    Get all batches
// @route   GET /api/batches
// @access  Private/Admin
export const getAllBatches = asyncHandler(async (req: Request, res: Response) => {
  const { status, year } = req.query;
  
  // Build query
  const query: any = {};
  
  // Add status filter if provided
  if (status) {
    query.status = status;
  }
  
  // Add year filter if provided
  if (year) {
    query.year = Number(year);
  }

  // Get batches
  const batches = await Batch.find(query)
    .sort({ startDate: 1 })
    .populate('services', 'serviceName description');

  res.status(200).json({
    success: true,
    count: batches.length,
    data: batches,
  });
});

// @desc    Get active batches
// @route   GET /api/batches/active
// @access  Public
export const getActiveBatches = asyncHandler(async (req: Request, res: Response) => {
  // Get active batches (upcoming or running)
  const batches = await Batch.find({ status: { $in: ['upcoming', 'running'] } })
    .sort({ startDate: 1 })
    .populate('services', 'serviceName description');

  res.status(200).json({
    success: true,
    count: batches.length,
    data: batches,
  });
});

// @desc    Get batch by ID
// @route   GET /api/batches/:id
// @access  Private
export const getBatchById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get batch
  const batch = await Batch.findById(id).populate('services', 'serviceName description price');

  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  res.status(200).json({
    success: true,
    data: batch,
  });
});

// @desc    Update batch
// @route   PUT /api/batches/:id
// @access  Private/Admin
export const updateBatch = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    batchId, 
    programName, 
    courseCredit, 
    services, 
    duration, 
    startDate, 
    endDate, 
    year, 
    totalFee,
    attendancePolicy,
    status
  } = req.body;
  
  // Find batch
  let batch = await Batch.findById(id);

  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Check if batch with the same ID already exists (excluding current batch)
  if (batchId && batchId !== batch.batchId) {
    const existingBatch = await Batch.findOne({ batchId });
    if (existingBatch) {
      throw new AppError('Batch with this ID already exists', 400);
    }
  }

  // Update batch
  batch = await Batch.findByIdAndUpdate(
    id,
    {
      batchId,
      programName,
      courseCredit,
      services,
      duration,
      startDate,
      endDate,
      year,
      totalFee,
      attendancePolicy,
      status
    },
    { new: true, runValidators: true }
  ).populate('services', 'serviceName description');

  res.status(200).json({
    success: true,
    message: 'Batch updated successfully',
    data: batch,
  });
});

// @desc    Delete batch
// @route   DELETE /api/batches/:id
// @access  Private/Admin
export const deleteBatch = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Find batch
  const batch = await Batch.findById(id);

  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Check if batch has enrolled students
  if (batch.students && batch.students.length > 0) {
    throw new AppError('Cannot delete batch with enrolled students', 400);
  }

  // Delete batch
  await Batch.findByIdAndDelete(batch._id);

  res.status(200).json({
    success: true,
    message: 'Batch deleted successfully',
  });
});

// @desc    Get students in a batch
// @route   GET /api/batches/:id/students
// @access  Private/Admin
export const getBatchStudents = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Find batch
  const batch = await Batch.findById(id);

  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Get students in the batch
  const students = await User.find({ batchId: id })
    .select('userId firstName lastName email phone paymentStatus profileImage');

  res.status(200).json({
    success: true,
    count: students.length,
    data: students,
  });
});

// @desc    Add student to batch
// @route   POST /api/batches/:id/students/:userId
// @access  Private/Admin
export const addStudentToBatch = asyncHandler(async (req: Request, res: Response) => {
  const { id, userId } = req.params;
  
  // Find batch
  const batch = await Batch.findById(id);

  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Find user
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if user is already in the batch
  const userObjectId = new mongoose.Types.ObjectId(userId);
  if (batch.students.some(studentId => studentId.equals(userObjectId))) {
    throw new AppError('User is already in this batch', 400);
  }

  // Add user to batch
  batch.students.push(userObjectId);
  await batch.save();

  // Update user's batch ID
  user.batchId = id;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Student added to batch successfully',
    data: batch,
  });
});

// @desc    Remove student from batch
// @route   DELETE /api/batches/:id/students/:userId
// @access  Private/Admin
export const removeStudentFromBatch = asyncHandler(async (req: Request, res: Response) => {
  const { id, userId } = req.params;
  
  // Find batch
  const batch = await Batch.findById(id);

  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Find user
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if user is in the batch
  const userObjectId = new mongoose.Types.ObjectId(userId);
  if (!batch.students.some(studentId => studentId.equals(userObjectId))) {
    throw new AppError('User is not in this batch', 400);
  }

  // Remove user from batch
  batch.students = batch.students.filter(student => !student.equals(userObjectId));
  await batch.save();

  // Clear user's batch ID if it matches this batch
  if (user.batchId === id) {
    user.batchId = '';
    await user.save();
  }

  res.status(200).json({
    success: true,
    message: 'Student removed from batch successfully',
    data: batch,
  });
});

// @desc    Get batch statistics
// @route   GET /api/batches/stats
// @access  Private/Admin
export const getBatchStats = asyncHandler(async (req: Request, res: Response) => {
  // Get batch counts by status
  const statusCounts = await Batch.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get batch counts by year
  const yearCounts = await Batch.aggregate([
    {
      $group: {
        _id: '$year',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);

  // Get total students enrolled
  const totalStudents = await User.countDocuments({ batchId: { $ne: '' } });

  // Get recent batches
  const recentBatches = await Batch.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('batchId programName startDate endDate status');

  res.status(200).json({
    success: true,
    data: {
      statusCounts,
      yearCounts,
      totalStudents,
      recentBatches
    }
  });
}); 