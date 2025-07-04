# Cloudinary Direct Upload Setup

This guide explains how to set up Cloudinary for direct uploads from the frontend.

## 1. Create a Cloudinary Account

If you don't have one already, sign up at [Cloudinary](https://cloudinary.com/).

## 2. Create an Upload Preset

1. Log in to your Cloudinary dashboard
2. Go to Settings > Upload
3. Scroll down to "Upload presets"
4. Click "Add upload preset"
5. Configure the preset:
   - Name: `user_uploads` (or whatever you specified in the code)
   - Signing Mode: **Unsigned** (important for direct frontend uploads)
   - Folder: `user-profile` (optional, for organization)
   - Set any other restrictions as needed (file types, size limits, etc.)
6. Save the preset

## 3. Configure Environment Variables

Add these variables to your `.env` file:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 4. Update Frontend Configuration

In your frontend code, update the Cloudinary configuration:

```typescript
// src/utils/cloudinaryConfig.ts
export const cloudinaryConfig = {
  cloudName: 'your_cloud_name', // Replace with your actual cloud name
  uploadPreset: 'user_uploads', // The preset you created
  folder: 'user-profile',
};
```

## 5. Security Considerations

Since we're using unsigned uploads, consider these security measures:

1. **Set upload restrictions** in your upload preset:
   - Limit file types to images only
   - Set maximum file size (e.g., 5MB)
   - Enable moderation if needed

2. **Configure CORS settings** in your Cloudinary dashboard:
   - Go to Settings > Security
   - Add your frontend domain to the allowed origins

3. **Monitor usage** to detect any abuse

## 6. Implementation Flow

The implementation follows this flow:

1. User selects an image on the frontend
2. Frontend uploads the image directly to Cloudinary
3. Cloudinary returns the URL and public ID
4. Frontend sends the URL and ID to your backend
5. Backend stores these values in the user's profile
6. If the user already had a profile image, the backend deletes the old one from Cloudinary

This approach avoids the "request entity too large" error by bypassing your server for the actual file upload. 