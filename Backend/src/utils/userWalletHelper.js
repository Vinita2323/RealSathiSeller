import User from '../models/User.model.js';
import UserWalletTransaction from '../models/UserWalletTransaction.model.js';

const genTxnId = (prefix = 'UWT') =>
  `${prefix}-${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;

/**
 * Credit user wallet and record ledger entry.
 * @returns {{ success: boolean, balance?: number, transaction?: object, message?: string }}
 */
export const creditUserWallet = async ({
  userId,
  amount,
  description = '',
  category = 'OTHER',
  orderId = '',
  order = null,
  returnId = '',
}) => {
  const amt = Number(Number(amount || 0).toFixed(2));
  if (!userId || !(amt > 0)) {
    return { success: false, message: 'Invalid credit amount' };
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amt } },
    { new: true }
  );
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  const balanceAfter = Number(Number(user.walletBalance || 0).toFixed(2));
  const balanceBefore = Number((balanceAfter - amt).toFixed(2));

  const transaction = await UserWalletTransaction.create({
    transactionId: genTxnId('CR'),
    userId,
    order: order || undefined,
    orderId: orderId || '',
    returnId: returnId || '',
    type: 'CREDIT',
    amount: amt,
    balanceBefore,
    balanceAfter,
    status: 'COMPLETED',
    category,
    description: description || `Wallet credit of ₹${amt.toFixed(2)}`,
  });

  return { success: true, balance: balanceAfter, transaction };
};

/**
 * Debit user wallet atomically (fails if insufficient balance).
 * @returns {{ success: boolean, balance?: number, transaction?: object, message?: string }}
 */
export const debitUserWallet = async ({
  userId,
  amount,
  description = '',
  category = 'ORDER_PAYMENT',
  orderId = '',
  order = null,
}) => {
  const amt = Number(Number(amount || 0).toFixed(2));
  if (!userId || !(amt > 0)) {
    return { success: false, message: 'Invalid debit amount' };
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: amt } },
    { $inc: { walletBalance: -amt } },
    { new: true }
  );

  if (!user) {
    const existing = await User.findById(userId).select('walletBalance').lean();
    if (!existing) return { success: false, message: 'User not found' };
    return {
      success: false,
      message: `Insufficient wallet balance. Available: ₹${Number(existing.walletBalance || 0).toFixed(2)}`,
      balance: Number(existing.walletBalance || 0),
    };
  }

  const balanceAfter = Number(Number(user.walletBalance || 0).toFixed(2));
  const balanceBefore = Number((balanceAfter + amt).toFixed(2));

  const transaction = await UserWalletTransaction.create({
    transactionId: genTxnId('DB'),
    userId,
    order: order || undefined,
    orderId: orderId || '',
    type: 'DEBIT',
    amount: amt,
    balanceBefore,
    balanceAfter,
    status: 'COMPLETED',
    category,
    description: description || `Wallet payment of ₹${amt.toFixed(2)}`,
  });

  return { success: true, balance: balanceAfter, transaction };
};
