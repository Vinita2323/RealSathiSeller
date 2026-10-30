import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadToCloudinary } from '../config/cloudinary.js';

const router = express.Router();

// Supported subfolders for clean organization
const ALLOWED_FOLDERS = ['banners', 'products', 'categories', 'profiles', 'reviews', 'transport', 'misc'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Configure Multer dynamic storage destination based on folder parameter
const storage = multer.diskStorage({
  destination(req, file, cb) {
    let folder = req.query.folder || req.body.folder || 'banners';
    if (!ALLOWED_FOLDERS.includes(folder.toLowerCase())) {
      folder = 'misc';
    }

    const targetDir = path.join(process.cwd(), 'uploads', folder.toLowerCase());
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

function checkFileType(file, cb) {
  const allowedExt = /\.(jpe?g|png|webp|gif|svg|pdf)$/i;
  const allowedMime =
    /^(image\/(jpeg|jpg|png|webp|gif|svg\+xml)|application\/pdf)$/i;

  const extname = allowedExt.test(path.extname(file.originalname || '').toLowerCase());
  const mimetype = allowedMime.test(file.mimetype || '');

  // Some browsers send empty/octet-stream for camera blobs — allow if extension is valid
  const looseMime =
    !file.mimetype ||
    file.mimetype === 'application/octet-stream' ||
    file.mimetype === 'binary/octet-stream';

  if ((extname && mimetype) || (extname && looseMime)) {
    return cb(null, true);
  }
  return cb(new Error('Only JPG, PNG, WEBP, GIF, SVG, or PDF files are allowed'));
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

// Helper to check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloudName && cloudName !== 'your_cloud_name_here');
};

const runSingleUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
          : err.message || 'File upload failed';
      return res.status(400).json({ success: false, message });
    }
    return next();
  });
};

// Single File Upload Endpoint (images + PDF for registration docs)
router.post('/', runSingleUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  let folder = req.query.folder || req.body.folder || 'banners';
  if (!ALLOWED_FOLDERS.includes(folder.toLowerCase())) {
    folder = 'misc';
  }

  const isPdf =
    (req.file.mimetype || '').includes('pdf') ||
    /\.pdf$/i.test(req.file.originalname || req.file.filename || '');

  // If Cloudinary is configured, upload to Cloudinary
  if (isCloudinaryConfigured()) {
    try {
      const uploadRes = await uploadToCloudinary(req.file.path, folder.toLowerCase());
      // Delete temporary local file after uploading to Cloudinary
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(200).json({
        success: true,
        message: isPdf
          ? 'PDF uploaded to Cloudinary successfully'
          : 'Image uploaded to Cloudinary successfully',
        imageUrl: uploadRes.secure_url,
        publicId: uploadRes.public_id,
        provider: 'cloudinary',
      });
    } catch (err) {
      console.warn('Cloudinary upload failed, falling back to local file storage:', err.message);
    }
  }

  // Fallback to local storage URL
  const filename = req.file.filename;
  const relativePath = `uploads/${folder.toLowerCase()}/${filename}`;
  const fileUrl = `${req.protocol}://${req.get('host')}/${relativePath}`;

  res.status(200).json({
    success: true,
    message: isPdf ? 'PDF uploaded locally' : 'Image uploaded locally',
    imageUrl: fileUrl,
    filePath: `/${relativePath}`,
    provider: 'local',
  });
});

// Base64 Image Upload Endpoint for Cloudinary
router.post('/base64', async (req, res) => {
  try {
    const { image, folder = 'products' } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Base64 image string is required' });
    }

    if (isCloudinaryConfigured()) {
      const uploadRes = await uploadToCloudinary(image, folder.toLowerCase());
      return res.status(200).json({
        success: true,
        message: 'Base64 image uploaded to Cloudinary successfully',
        imageUrl: uploadRes.secure_url,
        publicId: uploadRes.public_id,
        provider: 'cloudinary',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cloudinary not configured yet. Returning original data URL.',
      imageUrl: image,
      provider: 'base64',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error uploading base64 image',
    });
  }
});

export default router;
