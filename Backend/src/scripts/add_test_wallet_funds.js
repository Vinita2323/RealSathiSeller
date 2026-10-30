import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI;

const generateTxnId = () => `CTX-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  const updateResult = await db.collection('captains').updateMany(
    {
      $or: [
        { phone: '9302841832' },
        { 'bankDetails.accountNumber': /9999/ },
      ],
    },
    {
      $set: { walletBalance: 3500 },
    }
  );

  console.log('Update result:', updateResult);

  const captains = await db.collection('captains').find({
    $or: [
      { phone: '9302841832' },
      { 'bankDetails.accountNumber': /9999/ },
    ],
  }).toArray();

  console.log('Verified Captains:', captains.map(c => ({ id: c._id, name: c.name, phone: c.phone, balance: c.walletBalance })));

  // Ensure credit transactions exist for breakdown
  for (const cap of captains) {
    const existingCredits = await db.collection('captaintransactions').countDocuments({
      captainId: cap._id,
      type: 'CREDIT',
    });

    if (existingCredits < 2) {
      await db.collection('captaintransactions').insertOne({
        transactionId: generateTxnId(),
        captainId: cap._id,
        orderId: 'DEL-88219',
        type: 'CREDIT',
        amount: 2000,
        balanceBefore: 0,
        balanceAfter: 2000,
        description: 'Earnings from Order Delivery #DEL-88219',
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.collection('captaintransactions').insertOne({
        transactionId: generateTxnId(),
        captainId: cap._id,
        orderId: 'TRN-44912',
        type: 'CREDIT',
        amount: 1500,
        balanceBefore: 2000,
        balanceAfter: 3500,
        description: 'Earnings from Transport Ride #TRN-44912',
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Created transactions for ${cap.name}`);
    } else {
      console.log(`Transactions already exist for ${cap.name}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(console.error);
