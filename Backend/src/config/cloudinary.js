import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const getCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
  });
  return cloudinary;
};

/**
 * Upload an image (base64 string, URL, or file path) to Cloudinary
 * @param {string} fileStr - Base64 data URL or local file path
 * @param {string} folder - Destination subfolder in Cloudinary
 * @returns {Promise<object>} Upload result with secure_url, public_id, etc.
 */
export const uploadToCloudinary = async (fileStr, folder = 'Sathi Seller') => {
  try {
    const client = getCloudinary();
    const res = await client.uploader.upload(fileStr, {
      folder: `Sathi Seller/${folder}`,
      resource_type: 'auto',
    });
    return res;
  } catch (error) {
    console.error('Cloudinary upload error details:', error);
    throw new Error(error.message || 'Cloudinary upload failed');
  }
};

export default cloudinary;
