/**
 * One-off: pay drivers for Repair & Services legs completed BEFORE driver earnings existed.
 *
 *   node src/scripts/backfillRepairEarnings.js            → dry run (only prints what would be paid)
 *   node src/scripts/backfillRepairEarnings.js --apply    → credits wallets and cash-to-settle
 *
 * Safe to run more than once: each leg is paid at most once (same claim flag the live flow uses).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import RepairBooking from '../models/RepairBooking.model.js';
import RepairPayment from '../models/RepairPayment.model.js';
import CommissionSettings from '../models/CommissionSettings.model.js';
import { creditRepairLeg, computeLegEarnings, recordRepairCashCollected } from '../utils/repairEarnings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const apply = process.argv.includes('--apply');

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, family: 4 });

let rate = 5;
try {
  const settings = await CommissionSettings.getOrCreateActiveSettings();
  if (Number.isFinite(Number(settings?.captainCommission))) rate = Number(settings.captainCommission);
} catch { /* default */ }

const pickups = await RepairBooking.find({ atCenterAt: { $ne: null }, pickupCaptainId: { $ne: null }, pickupEarningCredited: { $ne: true } });
const deliveries = await RepairBooking.find({ status: 'DELIVERED', deliveryCaptainId: { $ne: null }, deliveryEarningCredited: { $ne: true } });

console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — commission ${rate}% (min ₹15 per leg)`);
console.log(`Pickup legs to pay: ${pickups.length} | Delivery legs to pay: ${deliveries.length}\n`);

let total = 0;
for (const b of pickups) {
  const amt = computeLegEarnings(b, 'pickup', rate);
  total += amt;
  console.log(`  pickup   ${b.bookingId}  ₹${amt}`);
  if (apply) await creditRepairLeg(b, 'pickup', { at: b.atCenterAt });
}
for (const b of deliveries) {
  const amt = computeLegEarnings(b, 'delivery', rate);
  total += amt;
  const cash = await RepairPayment.find({ booking: b._id, method: 'CASH', status: 'COLLECTED' }).lean();
  const cashSum = cash.reduce((s, p) => s + p.amount, 0);
  console.log(`  delivery ${b.bookingId}  ₹${amt}${cashSum ? `  (+ ₹${cashSum} cash collected by the driver)` : ''}`);
  if (apply) {
    const paid = await creditRepairLeg(b, 'delivery', { at: b.deliveredAt });
    if (paid && cashSum > 0) await recordRepairCashCollected(b.deliveryCaptainId, cashSum);
  }
}
console.log(`\nTotal ${apply ? 'credited' : 'that would be credited'}: ₹${total.toFixed(2)}`);
if (!apply) console.log('Nothing was changed. Re-run with --apply to credit these.');
await mongoose.disconnect();
process.exit(0);
