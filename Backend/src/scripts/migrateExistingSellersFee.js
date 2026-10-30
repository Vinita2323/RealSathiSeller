import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Seller from '../models/Seller.model.js';

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const feeCutoff = new Date('2026-09-12T12:46:51.865Z');

  const filter = {
    $or: [
      { accountStatus: 'approved' },
      { status: 'approved' },
      { createdAt: { $lt: feeCutoff } },
    ],
    registrationFeeStatus: { $ne: 'paid' },
  };

  const toUpdate = await Seller.find(filter);
  console.log(`Found ${toUpdate.length} sellers to exempt from registration fee.`);

  const result = await Seller.updateMany(filter, {
    $set: { registrationFeeStatus: 'not_required' },
  });

  console.log(`Updated ${result.modifiedCount} sellers to registrationFeeStatus: 'not_required'.`);

  const allSellers = await Seller.find({}, {
    phone: 1,
    businessName: 1,
    status: 1,
    accountStatus: 1,
    registrationFeeStatus: 1,
    createdAt: 1,
  });

  console.log('\n--- ALL SELLERS CURRENT STATUS ---');
  console.table(
    allSellers.map((s) => ({
      phone: s.phone,
      name: s.businessName,
      status: s.status,
      accountStatus: s.accountStatus,
      feeStatus: s.registrationFeeStatus,
      createdAt: s.createdAt ? s.createdAt.toISOString().slice(0, 10) : 'N/A',
    }))
  );

  await mongoose.disconnect();
  console.log('\nMigration complete and disconnected.');
}

migrate().catch(console.error);
