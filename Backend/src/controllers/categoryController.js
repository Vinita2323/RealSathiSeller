import fs from 'fs';
import path from 'path';
import Category from '../models/Category.model.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

// Initial default categories seed
const initialCategories = [
  { name: 'Grains & Flours', icon: 'Wheat', image: '/uploads/categories/grains-removebg-preview.png', priority: 1, status: 'Active' },
  { name: 'Oil & Ghee', icon: 'Droplet', image: '/uploads/categories/OilGhee-removebg-preview.png', priority: 2, status: 'Active' },
  { name: 'Spices & Masala', icon: 'Flame', image: '/uploads/categories/masala-removebg-preview.png', priority: 3, status: 'Active' },
  { name: 'Sugar & Sweeteners', icon: 'Coffee', image: '/uploads/categories/Sugar-removebg-preview.png', priority: 4, status: 'Active' },
  { name: 'Grocery Essentials', icon: 'ShoppingBag', image: '/uploads/categories/Grocery-removebg-preview.png', priority: 5, status: 'Active' },
  { name: 'Ready-to-Cook', icon: 'Utensils', image: '/uploads/categories/readyfoot-removebg-preview.png', priority: 6, status: 'Active' },
  { name: 'Home Care', icon: 'Sparkles', image: '/uploads/categories/homecare-removebg-preview.png', priority: 7, status: 'Active' },
  { name: 'Personal Care', icon: 'Heart', image: '/uploads/categories/personalcare-removebg-preview.png', priority: 8, status: 'Active' },
];

const saveBase64CategoryLocally = (base64Str) => {
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let ext = '.png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('svg')) ext = '.svg';
    else if (mimeType.includes('gif')) ext = '.gif';

    const targetDir = path.join(process.cwd(), 'uploads', 'categories');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `cat-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}${ext}`;
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/categories/${filename}`;
  } catch (err) {
    console.error('Failed to save category base64 image locally:', err.message);
    return null;
  }
};

const processCategoryImage = async (imgStr) => {
  if (!imgStr || typeof imgStr !== 'string' || !imgStr.trim()) {
    return '';
  }

  if (imgStr.startsWith('data:image/')) {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name_here') {
      try {
        const uploadRes = await uploadToCloudinary(imgStr, 'categories');
        if (uploadRes && uploadRes.secure_url) return uploadRes.secure_url;
      } catch (e) {
        console.warn('Cloudinary upload failed for category, persisting locally:', e.message);
      }
    }
    const localPath = saveBase64CategoryLocally(imgStr);
    if (localPath) return localPath;
  }

  // Normalize legacy render or local absolute URLs
  const legacyMatch = imgStr.match(/^https?:\/\/[^\/]+(\/uploads\/categories\/.*)$/);
  if (legacyMatch && !imgStr.includes('cloudinary') && !imgStr.includes('unsplash')) {
    return legacyMatch[1];
  }

  return imgStr;
};

// In-memory cache for ultra-fast category lookups (TTL: 60s)
let categoriesCache = { data: null, timestamp: 0 };

export const invalidateCategoriesCache = () => {
  categoriesCache = { data: null, timestamp: 0 };
};

// Get all categories (Public)
export const getCategories = async (req, res, next) => {
  try {
    const now = Date.now();
    if (!req.query.fresh && categoriesCache.data && now - categoriesCache.timestamp < 60000) {
      return res.status(200).json(categoriesCache.data);
    }

    let categories = await Category.find()
      .select('name slug icon image parent status priority')
      .sort({ priority: 1 })
      .lean();

    // Seed defaults only on a brand-new empty collection.
    // A category an admin deletes must stay deleted.
    if (categories.length === 0) {
      categories = await Category.insertMany(initialCategories);
    }

    // Normalize image paths for seamless rendering
    categories = categories.map(cat => {
      let img = cat.image || '';
      const legacyMatch = img.match(/^https?:\/\/[^\/]+(\/uploads\/categories\/.*)$/);
      if (legacyMatch && !img.includes('cloudinary') && !img.includes('unsplash')) {
        img = legacyMatch[1];
      }
      return {
        ...cat,
        image: img
      };
    });

    const payload = {
      success: true,
      count: categories.length,
      categories,
    };

    categoriesCache = { data: payload, timestamp: now };

    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

// Create new category (Admin)
export const createCategory = async (req, res, next) => {
  try {
    const { name, icon, image, status, priority, parent } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const categoryExists = await Category.findOne({ name: name.trim() });
    if (categoryExists) {
      return res.status(400).json({ success: false, message: 'Category with this name already exists' });
    }

    const processedImg = await processCategoryImage(image);

    const category = await Category.create({
      name: name.trim(),
      icon: icon || 'Package',
      image: processedImg,
      status: status || 'Active',
      priority: priority || 1,
      parent: parent || null,
    });

    invalidateCategoriesCache();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

// Update category (Admin)
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.image) {
      updateData.image = await processCategoryImage(updateData.image);
    }

    const category = await Category.findByIdAndUpdate(id, updateData, { returnDocument: 'after', runValidators: true });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    invalidateCategoriesCache();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

const deleteCategoryTree = async (id) => {
  const children = await Category.find({ parent: id }).select('_id');
  for (const child of children) {
    await deleteCategoryTree(child._id);
  }
  return Category.findByIdAndDelete(id);
};

// Delete category (Admin) — removes the category and any categories under it
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await Category.findById(id).select('_id name');
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await deleteCategoryTree(id);
    invalidateCategoriesCache();

    res.status(200).json({
      success: true,
      message: 'Category deleted permanently',
    });
  } catch (error) {
    next(error);
  }
};
