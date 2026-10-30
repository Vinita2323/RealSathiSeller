import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function updateCategoryImages() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is missing');
    return;
  }
  await mongoose.connect(uri);

  const updates = [
    { name: 'Sugar & Sweeteners', image: '/uploads/categories/Sugar-removebg-preview.png' },
    { name: 'Ready-to-Cook', image: '/uploads/categories/readyfoot-removebg-preview.png' },
    { name: 'Spices & Masala', image: '/uploads/categories/masala-removebg-preview.png' },
    { name: 'Grains & Flours', image: '/uploads/categories/grains-removebg-preview.png' },
    { name: 'Oil & Ghee', image: '/uploads/categories/OilGhee-removebg-preview.png' },
    { name: 'Home Care', image: '/uploads/categories/homecare-removebg-preview.png' },
    { name: 'Personal Care', image: '/uploads/categories/personalcare-removebg-preview.png' },
    { name: 'Grocery Essentials', image: '/uploads/categories/Grocery-removebg-preview.png' },
    { name: 'Grocery', image: '/uploads/categories/Grocery-removebg-preview.png' },
    { name: 'Groceries', image: '/uploads/categories/Grocery-removebg-preview.png' },
    { name: 'Groceries & Grains', image: '/uploads/categories/grains-removebg-preview.png' },
    { name: 'ladies poshak', image: '/uploads/categories/personalcare-removebg-preview.png' },
    { name: 'bags for ladies', image: '/uploads/categories/homecare-removebg-preview.png' },
    { name: 'घर की सजावट का सामान', image: '/uploads/categories/homecare-removebg-preview.png' },
    { name: 'Coffees ☕️', image: '/uploads/categories/Sugar-removebg-preview.png' },
    { name: 'लोकप्रिय', image: '/uploads/categories/Grocery-removebg-preview.png' }
  ];

  for (const u of updates) {
    await mongoose.connection.db.collection('categories').updateOne(
      { name: u.name },
      { $set: { image: u.image } }
    );
  }

  console.log('Category images updated in MongoDB successfully');
  await mongoose.disconnect();
}

updateCategoryImages().catch(console.error);
