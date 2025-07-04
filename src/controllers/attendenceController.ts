import { Request, Response } from "express";
import { Attendance } from '../models/Attendance';
import { User } from '../models/User';
import { Batch } from '../models/Batch';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import dayjs from 'dayjs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { uploadAttendancePhoto } from '../utils/cloudinary';
import { logger } from '../utils/logger';
import { compareFaces } from '../utils/image';
import mongoose from 'mongoose';

// Helper function to safely convert IDs to strings
const safeIdToString = (id: unknown): string => {
  if (id instanceof mongoose.Types.ObjectId) {
    return id.toString();
  }
  return String(id);
};

// @desc    Mark attendance for a user
// @route   POST /api/attendance/mark
// @access  Private
export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { userId, batchId, date, status, remarks } = req.body;

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

  // Check if attendance already exists for this date and user
  const existingAttendance = await Attendance.findOne({
    userId: user._id,
    batchId,
    date: new Date(date),
  });

  if (existingAttendance) {
    // Update existing attendance
    existingAttendance.status = status;
    if (remarks) existingAttendance.remarks = remarks;
    
    // Add activity log
    existingAttendance.activities.push({
      description: `Attendance manually updated to ${status}${remarks ? ` - ${remarks}` : ''}`,
      timestamp: new Date()
    });
    
    await existingAttendance.save();
    
    // Update user attendance stats
    await updateUserAttendanceStats(safeIdToString(user._id));

    res.status(200).json({
      success: true,
      message: `Attendance updated to ${status}`,
      data: existingAttendance,
    });
  } else {
    // Create new attendance record
    const attendance = await Attendance.create({
      userId: user._id,
      batchId,
      date: new Date(date),
      status,
      remarks,
      activities: [{
        description: `Attendance manually marked as ${status}${remarks ? ` - ${remarks}` : ''}`,
        timestamp: new Date()
      }]
    });

    // Update user attendance stats
    await updateUserAttendanceStats(safeIdToString(user._id));

    res.status(201).json({
      success: true,
      message: `Attendance marked as ${status}`,
      data: attendance,
    });
  }
});

// @desc    Get attendance for the logged in user
// @route   GET /api/attendance/me
// @access  Private
export const getUserAttendance = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  
  // Get all attendance records for the user
  const attendance = await Attendance.find({ userId })
    .sort({ date: -1 });

  // Get batch information for each attendance record
  const attendanceWithBatchInfo = await Promise.all(
    attendance.map(async (record) => {
      const batch = await Batch.findById(record.batchId);
      const attendanceObj = record.toObject();
      
      return {
        ...attendanceObj,
        batchInfo: batch ? {
          name: batch.programName,
          startDate: batch.startDate,
          endDate: batch.endDate,
          classTiming: batch.classTiming
        } : null
      };
    })
  );

  res.status(200).json({
    success: true,
    count: attendanceWithBatchInfo.length,
    data: attendanceWithBatchInfo,
  });
});

// @desc    Get today's attendance for the logged in user
// @route   GET /api/attendance/me/today
// @access  Private
export const getTodayAttendance = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  
  // Get today's attendance only
  const todayStart = dayjs().startOf('day').toDate();
  const todayEnd = dayjs().endOf('day').toDate();
  
  const todayAttendance = await Attendance.findOne({
    userId,
    date: { $gte: todayStart, $lt: todayEnd }
  });

  if (!todayAttendance) {
    res.status(200).json({
      success: true,
      data: null,
      message: 'No attendance record for today'
    });
    return;
  }

  // Get batch information
  const batch = await Batch.findById(todayAttendance.batchId);
  const attendanceObj = todayAttendance.toObject();
  
  const attendanceWithBatchInfo = {
    ...attendanceObj,
    batchInfo: batch ? {
      name: batch.programName,
      startDate: batch.startDate,
      endDate: batch.endDate,
      classTiming: batch.classTiming
    } : null
  };

  res.status(200).json({
    success: true,
    data: attendanceWithBatchInfo,
    message: 'Today\'s attendance found'
  });
});

// @desc    Get attendance statistics for the logged in user
// @route   GET /api/attendance/stats
// @access  Private
export const getAttendanceStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id as mongoose.Types.ObjectId;
  const { recalculate, force } = req.query;
  
  // Get user with attendance stats
  const user = await User.findById(userId).select('attendanceStats');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // If recalculate is requested, update the stats
  if (recalculate === 'true') {
    try {
      await updateUserAttendanceStats(safeIdToString(userId));
      // Fetch updated user data
      const updatedUser = await User.findById(userId).select('attendanceStats');
      if (updatedUser) {
        user.attendanceStats = updatedUser.attendanceStats;
      }
    } catch (error) {
      logger.error('Error during recalculation:', error);
      throw new AppError('Failed to recalculate stats', 500);
    }
  }

  // Get all attendance records for debugging
  const allAttendance = await Attendance.find({ userId }).sort({ date: -1 });
  
  // Get recent attendance records for additional context
  const recentAttendance = await Attendance.find({ userId })
    .sort({ date: -1 })
    .limit(10);

  // Get batch information for recent attendance
  const recentAttendanceWithBatchInfo = await Promise.all(
    recentAttendance.map(async (record) => {
      const batch = await Batch.findById(record.batchId);
      const attendanceObj = record.toObject();
      
      return {
        ...attendanceObj,
        batchInfo: batch ? {
          name: batch.programName
        } : null
      };
    })
  );

  // Calculate stats manually for verification
  const present = allAttendance.filter(record => record.status === 'present').length;
  const absent = allAttendance.filter(record => record.status === 'absent').length;
  const late = allAttendance.filter(record => record.status === 'late').length;
  const halfDay = allAttendance.filter(record => record.status === 'half-day').length;
  const total = present + absent + late + halfDay;
  const effectiveAttendance = present + late + (halfDay * 0.5);
  const calculatedPercentage = total > 0 ? Math.round((effectiveAttendance / total) * 100) : 0;

  // Check if stored stats match calculated stats
  const statsMatch = (
    user.attendanceStats.present === present &&
    user.attendanceStats.absent === absent &&
    user.attendanceStats.late === late &&
    user.attendanceStats.halfDay === halfDay &&
    user.attendanceStats.percentage === calculatedPercentage
  );

  // If stats don't match and force is true, update them
  if (!statsMatch && force === 'true') {
    try {
      await updateUserAttendanceStats(safeIdToString(userId));
      const updatedUser = await User.findById(userId).select('attendanceStats');
      if (updatedUser) {
        user.attendanceStats = updatedUser.attendanceStats;
      }
    } catch (error) {
      logger.error('Error during force update:', error);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...user.attendanceStats,
      recentAttendance: recentAttendanceWithBatchInfo,
      lastUpdated: new Date(),
      // Debug information
      debug: {
        totalRecords: allAttendance.length,
        calculatedStats: {
          present,
          absent,
          late,
          halfDay,
          total,
          effectiveAttendance,
          percentage: calculatedPercentage
        },
        storedStats: user.attendanceStats,
        statsMatch,
        recordsByStatus: {
          present: allAttendance.filter(r => r.status === 'present').map(r => ({ date: r.date, status: r.status })),
          absent: allAttendance.filter(r => r.status === 'absent').map(r => ({ date: r.date, status: r.status })),
          late: allAttendance.filter(r => r.status === 'late').map(r => ({ date: r.date, status: r.status })),
          halfDay: allAttendance.filter(r => r.status === 'half-day').map(r => ({ date: r.date, status: r.status }))
        }
      }
    },
  });
});

// @desc    Get attendance for a specific batch
// @route   GET /api/attendance/batch/:batchId
// @access  Private/Admin
export const getBatchAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.params;
  const { date, status } = req.query;
  
  // Build query
  const query: any = { batchId };
  
  // Add date filter if provided
  if (date) {
    query.date = new Date(date as string);
  }
  
  // Add status filter if provided
  if (status) {
    query.status = status;
  }

  // Get attendance records for the batch
  const attendance = await Attendance.find(query)
    .sort({ date: -1 })
    .populate('userId', 'firstName lastName userId phoneNumber email');

  // Get batch information
  const batch = await Batch.findById(batchId);

  res.status(200).json({
    success: true,
    count: attendance.length,
    data: attendance,
    batchInfo: batch ? {
      name: batch.programName,
      startDate: batch.startDate,
      endDate: batch.endDate,
      classTiming: batch.classTiming
    } : null
  });
});

// @desc    Get attendance by ID
// @route   GET /api/attendance/:id
// @access  Private/Admin
export const getAttendanceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get attendance record
  const attendance = await Attendance.findById(id)
    .populate('userId', 'firstName lastName userId phoneNumber email')
    .populate('batchId', 'name startDate endDate');

  if (!attendance) {
    throw new AppError('Attendance record not found', 404);
  }

  res.status(200).json({
    success: true,
    data: attendance,
  });
});

// @desc    Update attendance
// @route   PUT /api/attendance/:id
// @access  Private/Admin
export const updateAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  
  // Find attendance record
  const attendance = await Attendance.findById(id);

  if (!attendance) {
    throw new AppError('Attendance record not found', 404);
  }

  // Update attendance
  attendance.status = status || attendance.status;
  if (remarks) attendance.remarks = remarks;
  
  await attendance.save();
  
  // Update user attendance stats
  await updateUserAttendanceStats(safeIdToString(attendance.userId));

  res.status(200).json({
    success: true,
    message: 'Attendance updated successfully',
    data: attendance,
  });
});

// @desc    Delete attendance
// @route   DELETE /api/attendance/:id
// @access  Private/Admin
export const deleteAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Find attendance record
  const attendance = await Attendance.findById(id);

  if (!attendance) {
    throw new AppError('Attendance record not found', 404);
  }

  // Store userId for stats update
  const userId = attendance.userId;

  // Delete attendance
  await Attendance.findByIdAndDelete(attendance._id);
  
  // Update user attendance stats
  await updateUserAttendanceStats(safeIdToString(userId));

  res.status(200).json({
    success: true,
    message: 'Attendance deleted successfully',
  });
});

// @desc    Export attendance report for a batch
// @route   GET /api/attendance/export/:batchId
// @access  Private/Admin
export const exportAttendanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.params;
  const { month, year } = req.query;
  
  // Validate batch
  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Get month and year from query or use current month and year
  const currentDate = dayjs();
  const targetMonth = month ? parseInt(month as string) - 1 : currentDate.month();
  const targetYear = year ? parseInt(year as string) : currentDate.year();
  
  // Get start and end date for the month
  const startDate = dayjs().year(targetYear).month(targetMonth).startOf('month').toDate();
  const endDate = dayjs().year(targetYear).month(targetMonth).endOf('month').toDate();
  
  // Get attendance records for the batch in the specified month
  const attendanceRecords = await Attendance.find({
    batchId,
    date: { $gte: startDate, $lte: endDate },
  }).populate('userId', 'firstName lastName userId');

  // Get users in the batch
  const users = await User.find({ batchId }).select('firstName lastName userId');

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Add title
  page.drawText(`Attendance Report - ${batch.programName}`, {
    x: 50,
    y: height - 50,
    size: 20,
    font: boldFont,
  });
  
  // Add month and year
  page.drawText(`Month: ${dayjs().month(targetMonth).format('MMMM')} ${targetYear}`, {
    x: 50,
    y: height - 80,
    size: 12,
    font,
  });
  
  // Add table headers
  const columnPositions = [50, 150, 250, 350, 450];
  const rowHeight = 30;
  let currentY = height - 120;
  
  page.drawText('User ID', {
    x: columnPositions[0],
    y: currentY,
    size: 12,
    font: boldFont,
  });
  
  page.drawText('Name', {
    x: columnPositions[1],
    y: currentY,
    size: 12,
    font: boldFont,
  });
  
  page.drawText('Present', {
    x: columnPositions[2],
    y: currentY,
    size: 12,
    font: boldFont,
  });
  
  page.drawText('Absent', {
    x: columnPositions[3],
    y: currentY,
    size: 12,
    font: boldFont,
  });
  
  page.drawText('Percentage', {
    x: columnPositions[4],
    y: currentY,
    size: 12,
    font: boldFont,
  });
  
  currentY -= rowHeight;
  
  // Add table rows for each user
  for (const user of users) {
    // Count attendance for the user
    const userAttendance = attendanceRecords.filter(
      (record) => record.userId.toString() === safeIdToString(user._id)
    );
    
    const presentCount = userAttendance.filter((record) => record.status === 'present').length;
    const absentCount = userAttendance.filter((record) => record.status === 'absent').length;
    const totalDays = presentCount + absentCount;
    const percentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
    
    // Add new page if needed
    if (currentY < 50) {
      currentY = height - 50;
      page.drawText('Continued...', {
        x: width - 100,
        y: 30,
        size: 10,
        font,
      });
      const newPage = pdfDoc.addPage();
      currentY = height - 50;
    }
    
    // Draw user data
    page.drawText(user.userId, {
      x: columnPositions[0],
      y: currentY,
      size: 10,
      font,
    });
    
    page.drawText(`${user.firstName} ${user.lastName}`, {
      x: columnPositions[1],
      y: currentY,
      size: 10,
      font,
    });
    
    page.drawText(presentCount.toString(), {
      x: columnPositions[2],
      y: currentY,
      size: 10,
      font,
    });
    
    page.drawText(absentCount.toString(), {
      x: columnPositions[3],
      y: currentY,
      size: 10,
      font,
    });
    
    page.drawText(`${percentage}%`, {
      x: columnPositions[4],
      y: currentY,
      size: 10,
      font,
    });
    
    currentY -= rowHeight;
  }
  
  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();
  
  // Create directory if it doesn't exist
  const reportsDir = path.join(__dirname, '../../uploads/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Save PDF file
  const fileName = `attendance_${batch.batchId.replace(/\s+/g, '_')}_${targetYear}_${targetMonth + 1}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  fs.writeFileSync(filePath, pdfBytes);
  
  // Send file to client
  res.download(filePath, fileName, (err) => {
    if (err) {
      throw new AppError('Error downloading file', 500);
    }
    
    // Delete file after download
    fs.unlinkSync(filePath);
  });
});

// @desc    Check-in attendance with photo
// @route   POST /api/attendance/check-in
// @access  Private
export const checkIn = asyncHandler(async (req: Request, res: Response) => {
  const { photo, location, deviceInfo } = req.body;
  const userId = req.user?._id;
  const userBatchId = req.user?.batchId;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  if (!userBatchId) {
    throw new AppError('User is not assigned to any batch', 400);
  }

  // Get batch details
  const batch = await Batch.findById(userBatchId);
  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Check if batch is active
  if (batch.status !== 'running') {
    throw new AppError(`Batch is ${batch.status}, not active`, 400);
  }

  // Check if already checked in today
  const today = dayjs().startOf('day').toDate();
  const tomorrow = dayjs().endOf('day').toDate();
  
  const existingAttendance = await Attendance.findOne({
    userId,
    batchId: userBatchId,
    date: { $gte: today, $lt: tomorrow }
  });

  // Check if already checked in today
  if (existingAttendance && existingAttendance.checkIn && existingAttendance.checkIn.time) {
    const checkInTime = dayjs(existingAttendance.checkIn.time).format('HH:mm:ss');
    throw new AppError(`Already checked in today at ${checkInTime}. You can only check in once per day.`, 400);
  }

  // Process and upload photo
  if (!photo) {
    throw new AppError('Photo is required for check-in', 400);
  }

  try {
    // Upload photo to Cloudinary
    const uploadResult = await uploadAttendancePhoto(photo);

    // Get user profile image for comparison
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Compare faces if user has a profile image
    let faceMatchConfidence = 0;
    if (user.profileImage && user.profileImage.url) {
      try {
        faceMatchConfidence = await compareFaces(user.profileImage.url, uploadResult.url);
        
        // If face match confidence is too low, flag it but still allow check-in
        if (faceMatchConfidence < 70) {
          logger.warn(`Low face match confidence (${faceMatchConfidence}%) for user ${user.userId} during check-in`);
        }
      } catch (error) {
        logger.error('Face comparison error:', error);
      }
    }

    // Create or update attendance record
    const now = new Date();
    const checkInData = {
      time: now,
      photo: {
        url: uploadResult.url,
        cloudinaryId: uploadResult.cloudinaryId
      },
      location,
      deviceInfo: deviceInfo || 'Unknown device'
    };

    // Determine status based on check-in time and batch timing
    const [startHour, startMinute] = batch.classTiming.startTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    let status: 'present' | 'absent' | 'late' | 'half-day' = 'present';
    
    // Calculate minutes since batch start time
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const minutesLate = currentTimeInMinutes - startTimeInMinutes;
    
    // If more than late threshold minutes late, mark as late
    if (minutesLate > batch.classTiming.lateThreshold) {
      status = 'late';
    }

    if (existingAttendance) {
      // Update existing record (this shouldn't happen due to earlier check, but just in case)
      existingAttendance.checkIn = checkInData;
      existingAttendance.status = status;
      existingAttendance.activities.push({
        description: `Checked in at ${dayjs(now).format('HH:mm:ss')} (${status})`,
        timestamp: now
      });
      
      await existingAttendance.save();
      
      // Update user attendance stats
      await updateUserAttendanceStats(safeIdToString(userId));
      
      res.status(200).json({
        success: true,
        message: `Check-in successful! Status: ${status}`,
        data: {
          attendance: existingAttendance,
          faceMatchConfidence,
          status,
          checkInTime: dayjs(now).format('HH:mm:ss')
        }
      });
    } else {
      // Create new attendance record
      const attendance = await Attendance.create({
        userId,
        batchId: userBatchId,
        date: today,
        checkIn: checkInData,
        status,
        activities: [{
          description: `Checked in at ${dayjs(now).format('HH:mm:ss')} (${status})`,
          timestamp: now
        }]
      });

      // Update user attendance stats
      await updateUserAttendanceStats(safeIdToString(userId));

      res.status(201).json({
        success: true,
        message: `Check-in successful! Status: ${status}`,
        data: {
          attendance,
          faceMatchConfidence,
          status,
          checkInTime: dayjs(now).format('HH:mm:ss')
        }
      });
    }
  } catch (error) {
    logger.error('Check-in error:', error);
    throw new AppError('Failed to process check-in', 500);
  }
});

// @desc    Check-out attendance with photo
// @route   POST /api/attendance/check-out
// @access  Private
export const checkOut = asyncHandler(async (req: Request, res: Response) => {
  const { photo, location, deviceInfo } = req.body;
  const userId = req.user?._id as mongoose.Types.ObjectId;
  const userBatchId = req.user?.batchId;

  if (!userBatchId) {
    throw new AppError('User is not assigned to any batch', 400);
  }

  // Get batch details for timing calculations
  const batch = await Batch.findById(userBatchId);
  if (!batch) {
    throw new AppError('Batch not found', 404);
  }

  // Check if checked in today
  const today = dayjs().startOf('day').toDate();
  const tomorrow = dayjs().endOf('day').toDate();
  
  const attendance = await Attendance.findOne({
    userId,
    batchId: userBatchId,
    date: { $gte: today, $lt: tomorrow }
  });

  if (!attendance) {
    throw new AppError('No check-in record found for today', 400);
  }

  if (!attendance.checkIn || !attendance.checkIn.time) {
    throw new AppError('Must check in before checking out', 400);
  }

  if (attendance.checkOut && attendance.checkOut.time) {
    const checkOutTime = dayjs(attendance.checkOut.time).format('HH:mm:ss');
    throw new AppError(`Already checked out today at ${checkOutTime}. You can only check out once per day.`, 400);
  }

  // Process and upload photo
  if (!photo) {
    throw new AppError('Photo is required for check-out', 400);
  }

  try {
    // Upload photo to Cloudinary
    const uploadResult = await uploadAttendancePhoto(photo);

    // Get user profile image for comparison
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Compare faces if user has a profile image
    let faceMatchConfidence = 0;
    if (user.profileImage && user.profileImage.url) {
      try {
        faceMatchConfidence = await compareFaces(user.profileImage.url, uploadResult.url);
        
        // If face match confidence is too low, flag it but still allow check-out
        if (faceMatchConfidence < 70) {
          logger.warn(`Low face match confidence (${faceMatchConfidence}%) for user ${user.userId} during check-out`);
        }
      } catch (error) {
        logger.error('Face comparison error:', error);
      }
    }

    // Update attendance record
    const now = new Date();
    attendance.checkOut = {
      time: now,
      photo: {
        url: uploadResult.url,
        cloudinaryId: uploadResult.cloudinaryId
      },
      location,
      deviceInfo: deviceInfo || 'Unknown device'
    };

    // Calculate duration and update status if needed
    const checkInTime = new Date(attendance.checkIn.time);
    const checkOutTime = now;
    const durationHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    const durationMinutes = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60);
    
    // Get batch timing for half-day calculation
    const [startHour, startMinute] = batch.classTiming.startTime.split(':').map(Number);
    const [endHour, endMinute] = batch.classTiming.endTime.split(':').map(Number);
    const totalClassDurationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    const halfDayThreshold = totalClassDurationMinutes * 0.5; // 50% of class duration
    
    // If less than half-day threshold, mark as half-day
    if (durationMinutes < halfDayThreshold && attendance.status !== 'absent') {
      attendance.status = 'half-day';
    }

    attendance.activities.push({
      description: `Checked out at ${dayjs(now).format('HH:mm:ss')} (${attendance.status})`,
      timestamp: now
    });
    
    await attendance.save();
    
    // Update user attendance stats
    await updateUserAttendanceStats(safeIdToString(userId));

    res.status(200).json({
      success: true,
      message: `Check-out successful! Status: ${attendance.status}`,
      data: {
        attendance,
        faceMatchConfidence,
        status: attendance.status,
        duration: `${Math.round(durationHours * 100) / 100} hours`,
        checkOutTime: dayjs(now).format('HH:mm:ss')
      }
    });
  } catch (error) {
    logger.error('Check-out error:', error);
    throw new AppError('Failed to process check-out', 500);
  }
});

// Helper function to update user attendance stats
const updateUserAttendanceStats = async (userId: string | mongoose.Types.ObjectId): Promise<void> => {
  try {
    // Convert ObjectId to string if needed
    const userIdStr = userId.toString();
    
    // Get all attendance records for the user
    const attendanceRecords = await Attendance.find({ userId: userIdStr });
    
    // Log all records for debugging
    logger.info(`Found ${attendanceRecords.length} attendance records for user ${userIdStr}`);
    attendanceRecords.forEach(record => {
      logger.info(`Record: date=${record.date}, status=${record.status}, userId=${record.userId}`);
    });
    
    // Count by status with validation
    const present = attendanceRecords.filter(record => record.status === 'present').length;
    const absent = attendanceRecords.filter(record => record.status === 'absent').length;
    const late = attendanceRecords.filter(record => record.status === 'late').length;
    const halfDay = attendanceRecords.filter(record => record.status === 'half-day').length;
    
    // Check for invalid statuses
    const invalidRecords = attendanceRecords.filter(record => 
      !['present', 'absent', 'late', 'half-day'].includes(record.status)
    );
    
    if (invalidRecords.length > 0) {
      logger.warn(`Found ${invalidRecords.length} records with invalid status for user ${userIdStr}:`, 
        invalidRecords.map(r => ({ date: r.date, status: r.status }))
      );
    }
    
    // Calculate percentage (present and late count as full attendance, half-day counts as 0.5)
    const total = present + absent + late + halfDay;
    const effectiveAttendance = present + late + (halfDay * 0.5);
    const percentage = total > 0 ? Math.round((effectiveAttendance / total) * 100) : 0;
    
    // Create the new stats object
    const newStats = {
      present,
      absent,
      late,
      halfDay,
      percentage,
    };
    
    logger.info(`Calculated stats for user ${userIdStr}:`, newStats);
    
    // First, try to find the user to make sure they exist
    const user = await User.findById(userIdStr);
    if (!user) {
      logger.error(`User not found: ${userIdStr}`);
      throw new Error(`User not found: ${userIdStr}`);
    }
    
    // Update user stats using findOneAndUpdate for better reliability
    const updateResult = await User.findOneAndUpdate(
      { _id: userIdStr },
      { 
        $set: { 
          attendanceStats: newStats 
        } 
      },
      { 
        new: true, // Return the updated document
        runValidators: true // Run schema validators
      }
    );
    
    if (!updateResult) {
      logger.error(`Failed to update stats for user ${userIdStr}`);
      throw new Error(`Failed to update stats for user ${userIdStr}`);
    }
    
    logger.info(`Successfully updated attendance stats for user ${userIdStr}: present=${present}, absent=${absent}, late=${late}, half-day=${halfDay}, percentage=${percentage}%`);
    logger.info(`Updated user stats:`, updateResult.attendanceStats);
    
  } catch (error) {
    logger.error(`Error updating attendance stats for user ${userId}:`, error);
    throw error;
  }
};

// Helper function to recalculate stats for all users
const recalculateAllUserStats = async (): Promise<void> => {
  const users = await User.find({ role: 'user' });
  let updatedCount = 0;
  
  for (const user of users) {
    try {
      await updateUserAttendanceStats(safeIdToString(user._id));
      updatedCount++;
    } catch (error) {
      logger.error(`Failed to update stats for user ${user.userId}:`, error);
    }
  }
  
  logger.info(`Recalculated attendance stats for ${updatedCount} users`);
};

// @desc    Recalculate attendance stats for all users (Admin only)
// @route   POST /api/attendance/recalculate-stats
// @access  Private/Admin
export const recalculateStats = asyncHandler(async (req: Request, res: Response) => {
  await recalculateAllUserStats();
  
  res.status(200).json({
    success: true,
    message: 'Attendance stats recalculated for all users',
  });
});

// @desc    Clean up invalid attendance records (Admin only)
// @route   POST /api/attendance/cleanup
// @access  Private/Admin
export const cleanupAttendance = asyncHandler(async (req: Request, res: Response) => {
  // Find all records with invalid status
  const invalidRecords = await Attendance.find({
    status: { $nin: ['present', 'absent', 'late', 'half-day'] }
  });
  
  // Update invalid records to 'absent' (or delete them)
  const updateResult = await Attendance.updateMany(
    { status: { $nin: ['present', 'absent', 'late', 'half-day'] } },
    { status: 'absent' }
  );
  
  // Recalculate stats for all users
  await recalculateAllUserStats();
  
  res.status(200).json({
    success: true,
    message: `Cleaned up ${updateResult.modifiedCount} invalid attendance records`,
    data: {
      invalidRecordsFound: invalidRecords.length,
      recordsUpdated: updateResult.modifiedCount
    }
  });
});

// @desc    Check if stats are saved correctly (Debug endpoint)
// @route   GET /api/attendance/check-stats
// @access  Private
export const checkStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id as mongoose.Types.ObjectId;
  
  // Get user document
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Get all attendance records
  const attendanceRecords = await Attendance.find({ userId });
  
  // Calculate stats manually
  const present = attendanceRecords.filter(record => record.status === 'present').length;
  const absent = attendanceRecords.filter(record => record.status === 'absent').length;
  const late = attendanceRecords.filter(record => record.status === 'late').length;
  const halfDay = attendanceRecords.filter(record => record.status === 'half-day').length;
  const total = present + absent + late + halfDay;
  const effectiveAttendance = present + late + (halfDay * 0.5);
  const calculatedPercentage = total > 0 ? Math.round((effectiveAttendance / total) * 100) : 0;
  
  // Check if stats match
  const statsMatch = (
    user.attendanceStats.present === present &&
    user.attendanceStats.absent === absent &&
    user.attendanceStats.late === late &&
    user.attendanceStats.halfDay === halfDay &&
    user.attendanceStats.percentage === calculatedPercentage
  );
  
  res.status(200).json({
    success: true,
    data: {
      userStats: user.attendanceStats,
      calculatedStats: {
        present,
        absent,
        late,
        halfDay,
        total,
        effectiveAttendance,
        percentage: calculatedPercentage
      },
      statsMatch,
      totalRecords: attendanceRecords.length,
      records: attendanceRecords.map(r => ({
        date: r.date,
        status: r.status
      }))
    }
  });
});
