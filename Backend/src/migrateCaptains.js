import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

async function migrate() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  const driversColl = db.collection('drivers');
  const captainsColl = db.collection('captains');

  const drivers = await driversColl.find({}).toArray();
  console.log('Found drivers in old collection:', drivers.length);

  for (const driver of drivers) {
    await captainsColl.updateOne(
      { phone: driver.phone },
      { $set: driver },
      { upsert: true }
    );
  }

  const count = await captainsColl.countDocuments();
  console.log('Captains collection count after sync:', count);
  await mongoose.disconnect();
}

migrate().catch(console.error);
