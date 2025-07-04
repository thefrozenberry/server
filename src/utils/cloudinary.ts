import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/config';
import { logger } from './logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Upload file to Cloudinary
 * @param filePath Local file path or base64 data
 * @param folder Cloudinary folder
 * @param options Additional upload options
 * @returns Upload result
 */
export const uploadToCloudinary = async (
  filePath: string,
  folder: string,
  options: any = {}
) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      ...options,
    });
    
    logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
    
    return {
      url: result.secure_url,
      cloudinaryId: result.public_id,
    };
  } catch (error: any) {
    logger.error(`Cloudinary upload error: ${error.message}`);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Upload profile image with auto-cropping
 * @param filePath Local file path or base64 data
 * @returns Upload result
 */
export const uploadProfileImage = async (filePath: string) => {
  return uploadToCloudinary(filePath, 'user-profile', {
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'face' },
    ],
  });
};

/**
 * Upload attendance photo
 * @param filePath Local file path or base64 data
 * @returns Upload result
 */
export const uploadAttendancePhoto = async (filePath: string) => {
  return uploadToCloudinary(filePath, 'attendance-photos', {
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
    ],
  });
};

/**
 * Upload PDF receipt
 * @param filePath Local file path or base64 data
 * @returns Upload result
 */
export const uploadPdfReceipt = async (filePath: string) => {
  return uploadToCloudinary(filePath, 'receipts', {
    resource_type: 'raw',
    format: 'pdf',
  });
};

/**
 * Delete file from Cloudinary
 * @param cloudinaryId Cloudinary public ID
 * @returns Deletion result
 */
export const deleteFromCloudinary = async (cloudinaryId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(cloudinaryId);
    logger.info(`File deleted from Cloudinary: ${cloudinaryId}`);
    return result;
  } catch (error: any) {
    logger.error(`Cloudinary delete error: ${error.message}`);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export default {
  uploadToCloudinary,
  uploadProfileImage,
  uploadAttendancePhoto,
  uploadPdfReceipt,
  deleteFromCloudinary,
}; 