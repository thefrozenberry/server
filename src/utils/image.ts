import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/config';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Process and resize an image
 * @param inputBuffer Image buffer or file path
 * @param options Processing options
 * @returns Processed image buffer
 */
export const processImage = async (
  inputBuffer: Buffer | string,
  options: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  } = {}
): Promise<Buffer> => {
  try {
    const {
      width,
      height,
      fit = 'cover',
      format = 'jpeg',
      quality = 80,
    } = options;
    
    // Create sharp instance
    let image = sharp(inputBuffer);
    
    // Resize if width or height is provided
    if (width || height) {
      image = image.resize({
        width,
        height,
        fit,
        withoutEnlargement: true,
      });
    }
    
    // Set output format and quality
    switch (format) {
      case 'jpeg':
        image = image.jpeg({ quality });
        break;
      case 'png':
        image = image.png({ quality });
        break;
      case 'webp':
        image = image.webp({ quality });
        break;
    }
    
    // Get processed image buffer
    const outputBuffer = await image.toBuffer();
    
    logger.info(`Image processed: ${width}x${height}, format: ${format}, quality: ${quality}`);
    
    return outputBuffer;
  } catch (error: any) {
    logger.error(`Image processing error: ${error.message}`);
    throw new Error(`Failed to process image: ${error.message}`);
  }
};

/**
 * Process profile image (resize to 500x500)
 * @param buffer Image buffer
 * @returns Processed image buffer
 */
export const processProfileImage = async (buffer: Buffer): Promise<Buffer> => {
  return await sharp(buffer)
    .resize(500, 500, {
      fit: 'cover',
      position: 'center',
    })
    .toBuffer();
};

/**
 * Process attendance photo
 * @param inputBuffer Image buffer or file path
 * @returns Processed image buffer
 */
export const processAttendancePhoto = async (inputBuffer: Buffer | string): Promise<Buffer> => {
  return processImage(inputBuffer, {
    width: 800,
    height: 600,
    fit: 'inside',
    format: 'jpeg',
    quality: 75,
  });
};

/**
 * Save image buffer to file
 * @param buffer Image buffer
 * @param fileName File name
 * @param subDir Subdirectory within uploads
 * @returns File path
 */
export const saveImageToFile = (
  buffer: Buffer,
  fileName: string,
  subDir: string = 'images'
): string => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../../uploads', subDir);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Save image to file
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);
    
    logger.info(`Image saved to ${filePath}`);
    
    return filePath;
  } catch (error: any) {
    logger.error(`Failed to save image to file: ${error.message}`);
    throw new Error(`Failed to save image to file: ${error.message}`);
  }
};

/**
 * Convert base64 string to buffer
 * @param base64 Base64 encoded string
 * @returns Buffer
 */
export const base64ToBuffer = (base64: string): Buffer => {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
};

/**
 * Compare faces between two images
 * @param sourceImageUrl URL of the source image
 * @param targetImageUrl URL of the target image
 * @returns Confidence score (0-100)
 */
export const compareFaces = async (sourceImageUrl: string, targetImageUrl: string): Promise<number> => {
  try {
    // Using Cloudinary's AI capabilities for face detection and comparison
    // Note: This is a simplified implementation
    // In production, you might want to use a dedicated face recognition API like AWS Rekognition or Azure Face

    // For now, we'll simulate face comparison with a random score
    // In a real implementation, you would call an actual face comparison API
    
    logger.info(`Comparing faces: ${sourceImageUrl} vs ${targetImageUrl}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate a random confidence score between 70 and 100 for demo purposes
    // In production, replace this with actual API call
    const confidenceScore = Math.floor(Math.random() * 30) + 70;
    
    logger.info(`Face comparison result: ${confidenceScore}% confidence`);
    
    return confidenceScore;
  } catch (error) {
    logger.error('Face comparison error:', error);
    throw new Error('Failed to compare faces');
  }
};

/**
 * Detect faces in an image
 * @param imageUrl URL of the image
 * @returns Number of faces detected
 */
export const detectFaces = async (imageUrl: string): Promise<number> => {
  try {
    // Using Cloudinary's AI capabilities for face detection
    // Note: This is a simplified implementation
    
    logger.info(`Detecting faces in: ${imageUrl}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate a random number of faces for demo purposes
    // In production, replace this with actual API call
    const faceCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 faces
    
    logger.info(`Face detection result: ${faceCount} faces detected`);
    
    return faceCount;
  } catch (error) {
    logger.error('Face detection error:', error);
    throw new Error('Failed to detect faces');
  }
}; 