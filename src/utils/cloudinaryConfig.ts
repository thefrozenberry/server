// Cloudinary configuration for frontend uploads
export const cloudinaryConfig = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloud_name',
  uploadPreset: 'user_uploads', // Create this unsigned upload preset in your Cloudinary dashboard
  folder: 'user-profile',
};

/**
 * Get Cloudinary upload URL
 * @returns Upload URL
 */
export const getCloudinaryUploadUrl = (): string => {
  return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
};

/**
 * Extract Cloudinary ID from URL
 * @param url Cloudinary URL
 * @returns Cloudinary public ID
 */
export const extractCloudinaryId = (url: string): string => {
  // Example URL: https://res.cloudinary.com/cloud-name/image/upload/v1234567890/folder/filename.jpg
  const regex = /\/v\d+\/(.+)$/;
  const match = url.match(regex);
  return match ? match[1].replace(/\.[^/.]+$/, '') : '';
}; 