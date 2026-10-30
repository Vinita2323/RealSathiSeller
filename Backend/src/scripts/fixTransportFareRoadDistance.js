import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { estimateRoadDistanceKm, estimateDuration } from '../utils/haversine.js';
import { calculateFare, toStoredFareBreakdown } from '../utils/fareCalculator.js';

dotenv.config();

const bookingId = process.argv[2] || 'TRB-1791791215-8ZUT8';

await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.db.collection('transportbookings');
const booking = await col.findOne({ bookingId });

if (!booking) {
  console.error('Booking not found:', bookingId);
  process.exit(1);
}

const v = booking.vehicleSnapshot;
if (!v) {
  console.error('Missing vehicleSnapshot on booking');
  process.exit(1);
}

const dist = estimateRoadDistanceKm(
  booking.pickupLocation.lat,
  booking.pickupLocation.lng,
  booking.dropLocation.lat,
  booking.dropLocation.lng
);

const fare = calculateFare(v, dist, {
  stopsCount: Array.isArray(booking.stops) ? booking.stops.length : 0,
});
const fareBreakdown = toStoredFareBreakdown(fare);
const rate = Number(booking.captainCommissionRate || 0);
const captainCommAmount = Math.round(((fareBreakdown.totalFare * rate) / 100) * 100) / 100;
const captainEarnings = Math.max(0, Math.round((fareBreakdown.totalFare - captainCommAmount) * 100) / 100);

console.log('BEFORE', {
  distanceKm: booking.distanceKm,
  totalFare: booking.fareBreakdown?.totalFare,
  captainEarnings: booking.captainEarnings,
});
console.log('AFTER', {
  distanceKm: dist,
  fareBreakdown,
  captainEarnings,
});

await col.updateOne(
  { bookingId },
  {
    $set: {
      distanceKm: dist,
      estimatedDurationMin: estimateDuration(dist),
      fareBreakdown,
      captainEarnings,
    },
  }
);

const updated = await col.findOne(
  { bookingId },
  { projection: { distanceKm: 1, fareBreakdown: 1, captainEarnings: 1 } }
);
console.log('UPDATED', JSON.stringify(updated, null, 2));
await mongoose.disconnect();
