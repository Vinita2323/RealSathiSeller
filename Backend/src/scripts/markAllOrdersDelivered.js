import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const markAllDelivered = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const now = new Date();

    const orderRes = await mongoose.connection.collection('orders').updateMany(
      {},
      {
        $set: {
          orderStatus: 'Delivered',
          sellerStatus: 'DELIVERED',
          captainStatus: 'Delivered',
          paymentStatus: 'Paid',
          captainDeliveredAt: now,
        },
      }
    );
    console.log(`Orders updated to Delivered: ${orderRes.modifiedCount}`);

    const notifRes = await mongoose.connection.collection('sellernotifications').updateMany(
      {},
      {
        $set: {
          status: 'DELIVERED',
          paymentStatus: 'Paid',
        },
      }
    );
    console.log(`SellerNotifications updated to DELIVERED: ${notifRes.modifiedCount}`);

    const transportRes = await mongoose.connection.collection('transportbookings').updateMany(
      { status: { $nin: ['RIDE_COMPLETED', 'CANCELLED', 'REJECTED'] } },
      {
        $set: {
          status: 'RIDE_COMPLETED',
        },
      }
    );
    console.log(`Transport bookings updated to RIDE_COMPLETED: ${transportRes.modifiedCount}`);

    console.log('All orders and bookings successfully marked as Delivered!');
    process.exit(0);
  } catch (error) {
    console.error('Error marking orders delivered:', error);
    process.exit(1);
  }
};

markAllDelivered();
