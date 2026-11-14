import Captain from '../models/Captain.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import CommissionSettings from '../models/CommissionSettings.model.js';
import PlatformLedger from '../models/PlatformLedger.model.js';
import RepairBooking from '../models/RepairBooking.model.js';

/**
 * Driver earnings for Repair & Services.
 * Each completed leg pays the driver once:
 *   - "pickup"   leg → when the repair center confirms the handover OTP
 *   - "delivery" leg → when the customer confirms the delivery OTP
 * Amount follows the same rule as product deliveries: the captain commission % from Commission Settings,
 * with a ₹15 minimum per job. The booking flag is claimed atomically so a leg is never paid twice.
 */
const MIN_PAYOUT = 15;
const round2 = (n) => Math.round(n * 100) / 100;
const txnId = () => `CTX-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const LEG = {
  pickup: { flag: 'pickupEarningCredited', field: 'pickupCaptainEarnings', label: 'pickup' },
  delivery: { flag: 'deliveryEarningCredited', field: 'deliveryCaptainEarnings', label: 'delivery' },
};

export const computeLegEarnings = (booking, leg, ratePercent = 5) => {
  const base = leg === 'pickup' ? Number(booking.diagnosisFee || 0) : Number(booking.amountDue || booking.diagnosisFee || 0);
  return Math.max(MIN_PAYOUT, round2((base * ratePercent) / 100));
};

export const creditRepairLeg = async (booking, leg, { at } = {}) => {
  const cfg = LEG[leg];
  const captainId = leg === 'pickup' ? booking.pickupCaptainId : booking.deliveryCaptainId;
  const captainRef = captainId?._id || captainId;
  if (!cfg || !captainRef) return null;

  // Claim this leg so concurrent / repeated calls can never pay twice
  const claimed = await RepairBooking.findOneAndUpdate(
    { _id: booking._id, [cfg.flag]: { $ne: true } },
    { $set: { [cfg.flag]: true } },
    { new: true }
  );
  if (!claimed) return null;

  try {
  let rate = 5;
  try {
    const settings = await CommissionSettings.getOrCreateActiveSettings();
    if (Number.isFinite(Number(settings?.captainCommission))) rate = Number(settings.captainCommission);
  } catch { /* default rate */ }

  const amount = computeLegEarnings(booking, leg, rate);
  const base = leg === 'pickup' ? Number(booking.diagnosisFee || 0) : Number(booking.amountDue || booking.diagnosisFee || 0);

  const captain = await Captain.findByIdAndUpdate(captainRef, { $inc: { walletBalance: amount } }, { new: true }).select('name walletBalance');
  if (!captain) return null;
  const balanceAfter = Number(captain.walletBalance || 0);
  const balanceBefore = round2(balanceAfter - amount);

  await RepairBooking.updateOne({ _id: booking._id }, { $set: { [cfg.field]: amount } });

  await CaptainTransaction.create({
    transactionId: txnId(),
    captainId: captainRef,
    order: null,
    orderId: booking.bookingId,
    type: 'CREDIT',
    amount,
    grossAmount: base,
    commissionRate: rate,
    commissionAmount: round2((base * rate) / 100),
    netAmount: amount,
    balanceBefore,
    balanceAfter,
    description: `Repair ${cfg.label} completed — ${booking.bookingId}`,
    status: 'COMPLETED',
    ...(at ? { createdAt: at } : {}), // backfill: record it on the day the leg was actually completed
  }).catch((e) => console.warn('[RepairEarnings] transaction log failed:', e.message));

  await PlatformLedger.create({
    transactionId: `TXN-LED-REP-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`,
    category: 'CAPTAIN_EARNING',
    type: 'CREDIT',
    amount,
    source: 'PLATFORM_TREASURY',
    destination: 'CAPTAIN',
    entityType: 'CAPTAIN',
    entityId: String(captain._id),
    entityName: captain.name || 'Captain',
    referenceModel: 'RepairBooking',
    referenceId: booking.bookingId,
    referenceObjId: booking._id,
    status: 'SUCCESS',
    balanceBefore,
    balanceAfter,
    description: `Repair ${cfg.label} fee credited for ${booking.bookingId}`,
    metadata: { bookingId: booking.bookingId, leg, earnings: amount },
  }).catch((e) => console.warn('[RepairEarnings] ledger log failed:', e.message));

  await CaptainNotification.create({
    captainId: captainRef,
    type: 'PAYMENT',
    title: 'Payment Credited!',
    message: `₹${amount.toFixed(2)} credited to your wallet for repair ${cfg.label} ${booking.bookingId}`,
    orderId: booking.bookingId,
    amount,
    icon: 'account_balance_wallet',
  }).catch(() => {});

  return { amount, balanceAfter };
  } catch (err) {
    // Release the claim so this leg can be paid by a later retry
    await RepairBooking.updateOne({ _id: booking._id }, { $set: { [cfg.flag]: false } }).catch(() => {});
    throw err;
  }
};

// Cash handed over by the customer at delivery is owed to the platform → counts towards the driver's cash to settle
export const recordRepairCashCollected = async (captainId, amount) => {
  const value = Number(amount);
  if (!captainId || !Number.isFinite(value) || value <= 0) return;
  await Captain.findByIdAndUpdate(captainId, { $inc: { outstandingCash: value, totalCodCollected: value, cashCollected: value } });
};
