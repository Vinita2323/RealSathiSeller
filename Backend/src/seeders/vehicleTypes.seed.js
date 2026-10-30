/**
 * Vehicle Types Seeder
 * Run this ONCE after deploying the backend to populate the vehicletypes collection.
 *
 * Usage:
 *   node src/seeders/vehicleTypes.seed.js
 *
 * It is safe to run multiple times — uses upsert so it will not create duplicates.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import VehicleType from '../models/VehicleType.model.js';

const VEHICLE_TYPES = [
  {
    name: 'Motorcycle',
    slug: 'motorcycle',
    description: 'Ideal for small packages, documents & lightweight goods up to 20 kg.',
    capacityKg: 20,
    icon: 'bike',
    baseFare: 30,
    perKmFare: 8,
    minimumFare: 80,
    platformFee: 10,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: '3 Wheeler',
    slug: 'three-wheeler',
    description: 'Auto-rickshaw cargo variant. Great for medium goods up to 500 kg.',
    capacityKg: 500,
    icon: 'truck',
    baseFare: 60,
    perKmFare: 14,
    minimumFare: 200,
    platformFee: 15,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Mini Truck',
    slug: 'mini-truck',
    description: 'Compact truck for household and commercial goods up to 750 kg.',
    capacityKg: 750,
    icon: 'truck',
    baseFare: 80,
    perKmFare: 18,
    minimumFare: 300,
    platformFee: 20,
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Pickup 8ft',
    slug: 'pickup-8ft',
    description: '8-foot flatbed pickup. Suitable for furniture and large goods up to 1200 kg.',
    capacityKg: 1200,
    icon: 'truck',
    baseFare: 120,
    perKmFare: 24,
    minimumFare: 500,
    platformFee: 25,
    isActive: true,
    sortOrder: 4,
  },
  {
    name: 'Truck 14ft',
    slug: 'truck-14ft',
    description: '14-foot truck for heavy commercial shipments up to 2000 kg.',
    capacityKg: 2000,
    icon: 'truck',
    baseFare: 200,
    perKmFare: 35,
    minimumFare: 800,
    platformFee: 30,
    isActive: true,
    sortOrder: 5,
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected for seeding');

    let created = 0;
    let updated = 0;

    for (const vt of VEHICLE_TYPES) {
      const result = await VehicleType.findOneAndUpdate(
        { slug: vt.slug }, // match by slug (unique key)
        { $set: vt },
        { upsert: true, new: true, runValidators: true }
      );
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
        console.log(`  ✨ Created: ${vt.name}`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${vt.name}`);
      }
    }

    console.log(`\n✅ Seeding complete — ${created} created, ${updated} updated`);
    console.log('Vehicle types in DB:');
    const all = await VehicleType.find().sort({ sortOrder: 1 }).select('name slug baseFare perKmFare minimumFare platformFee isActive');
    console.table(all.map(v => ({
      Name: v.name,
      Slug: v.slug,
      BaseFare: `₹${v.baseFare}`,
      PerKm: `₹${v.perKmFare}`,
      MinFare: `₹${v.minimumFare}`,
      PlatformFee: `₹${v.platformFee}`,
      Active: v.isActive,
    })));

    await mongoose.disconnect();
    console.log('\n✅ Database disconnected. Seed complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
