import { Request, Response } from "express";
import { Service } from '../models/Service';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';

// @desc    Create a new service
// @route   POST /api/services
// @access  Private/Admin
export const createService = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, price, duration, isActive, category, features } = req.body;

  // Check if service with the same name already exists
  const existingService = await Service.findOne({ serviceName: name });
  if (existingService) {
    throw new AppError('Service with this name already exists', 400);
  }

  // Create new service
  const service = await Service.create({
    serviceName: name,
    description,
    price,
    duration,
    unit: 'piece', // Default to 'piece'
    active: isActive,
    dropdownOptions: {
      title: category || 'Options',
      options: features || []
    },
    imageURL: { url: '', cloudinaryId: '' }
  });

  res.status(201).json({
    success: true,
    message: 'Service created successfully',
    data: service,
  });
});

// @desc    Get all services
// @route   GET /api/services
// @access  Private/Admin
export const getAllServices = asyncHandler(async (req: Request, res: Response) => {
  const { category, isActive } = req.query;
  
  // Build query
  const query: any = {};
  
  // Add category filter if provided
  if (category) {
    query['dropdownOptions.title'] = category;
  }
  
  // Add active status filter if provided
  if (isActive !== undefined) {
    query.active = isActive === 'true';
  }

  // Get services
  const services = await Service.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: services.length,
    data: services,
  });
});

// @desc    Get active services
// @route   GET /api/services/active
// @access  Public
export const getActiveServices = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;
  
  // Build query
  const query: any = { active: true };
  
  // Add category filter if provided
  if (category) {
    query['dropdownOptions.title'] = category;
  }

  // Get active services
  const services = await Service.find(query).sort({ price: 1 });

  res.status(200).json({
    success: true,
    count: services.length,
    data: services,
  });
});

// @desc    Get service by ID
// @route   GET /api/services/:id
// @access  Private/Admin
export const getServiceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get service
  const service = await Service.findById(id);

  if (!service) {
    throw new AppError('Service not found', 404);
  }

  res.status(200).json({
    success: true,
    data: service,
  });
});

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private/Admin
export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price, duration, isActive, category, features } = req.body;
  
  // Find service
  let service = await Service.findById(id);

  if (!service) {
    throw new AppError('Service not found', 404);
  }

  // Check if service with the same name already exists (excluding current service)
  if (name && name !== service.serviceName) {
    const existingService = await Service.findOne({ serviceName: name });
    if (existingService) {
      throw new AppError('Service with this name already exists', 400);
    }
  }

  // Update service
  service = await Service.findByIdAndUpdate(
    id,
    {
      serviceName: name,
      description,
      price,
      duration,
      active: isActive,
      dropdownOptions: {
        title: category || service.dropdownOptions?.title || 'Options',
        options: features || service.dropdownOptions?.options || []
      }
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Service updated successfully',
    data: service,
  });
});

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private/Admin
export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Find service
  const service = await Service.findById(id);

  if (!service) {
    throw new AppError('Service not found', 404);
  }

  // Delete service
  await Service.findByIdAndDelete(service._id);

  res.status(200).json({
    success: true,
    message: 'Service deleted successfully',
  });
}); 