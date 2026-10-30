import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import PlatformLedger from '../models/PlatformLedger.model.js';
import PayoutRequest from '../models/PayoutRequest.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import WithdrawalRequest from '../models/WithdrawalRequest.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import Admin from '../models/Admin.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sync = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is missing');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // 1. Seed or ensure Root Super Admin exists
    const superAdminEmail = 'superadmin@sathiseller.com';
    let superAdmin = await Admin.findOne({ email: superAdminEmail });
    if (!superAdmin) {
      superAdmin = new Admin({
        name: 'Chief Financial Officer (Super Admin)',
        email: superAdminEmail,
        password: 'SuperAdmin@123',
        role: 'super_admin',
      });
      await superAdmin.save();
      console.log('Seeded Root Super Admin: superadmin@sathiseller.com / SuperAdmin@123');
    } else if (superAdmin.role !== 'super_admin') {
      superAdmin.role = 'super_admin';
      await superAdmin.save();
      console.log('Updated superadmin@sathiseller.com role to super_admin');
    }

    // 2. Sync existing WithdrawalRequests to PayoutRequests
    const existingWithdrawals = await WithdrawalRequest.find();
    console.log(`Found ${existingWithdrawals.length} existing WithdrawalRequests`);

    for (const w of existingWithdrawals) {
      const exists = await PayoutRequest.findOne({ payoutId: w.withdrawalId });
      if (!exists) {
        let recipientPhone = '';
        if (mongoose.Types.ObjectId.isValid(w.sellerId)) {
          const s = await Seller.findById(w.sellerId).lean();
          if (s) recipientPhone = s.phone || '';
        }
        await PayoutRequest.create({
          payoutId: w.withdrawalId,
          recipientType: 'SELLER',
          recipientId: String(w.sellerId),
          recipientName: w.sellerName || 'Seller',
          recipientPhone,
          requestedAmount: w.amount,
          approvedAmount: ['APPROVED', 'COMPLETED'].includes(w.status) ? w.amount : null,
          bankDetails: w.bankDetails || {},
          status: w.status === 'COMPLETED' ? 'PAID' : w.status,
          remarks: w.adminRemark || '',
          paidAt: w.status === 'COMPLETED' ? (w.processedAt || w.updatedAt) : null,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        });
      }
    }
    console.log('Synced historical WithdrawalRequests into PayoutRequests');

    // 3. Sync WalletTransactions into PlatformLedger
    const walletTxns = await WalletTransaction.find();
    console.log(`Found ${walletTxns.length} WalletTransactions to sync`);
    for (const wt of walletTxns) {
      const exists = await PlatformLedger.findOne({ referenceId: wt.transactionId });
      if (!exists) {
        let category = 'SELLER_EARNING';
        let type = 'CREDIT';
        if (wt.type === 'WITHDRAWAL') {
          category = 'SELLER_PAYOUT';
          type = 'DEBIT';
        } else if (wt.type === 'DEBIT_REVERSAL') {
          category = 'FINANCIAL_ADJUSTMENT';
          type = 'DEBIT';
        }

        await PlatformLedger.create({
          transactionId: wt.transactionId,
          category,
          type,
          amount: wt.grossAmount || Math.abs(wt.netAmount) || 0,
          source: type === 'CREDIT' ? 'PLATFORM_TREASURY' : 'SELLER',
          destination: type === 'CREDIT' ? 'SELLER' : 'PLATFORM_TREASURY',
          entityType: 'SELLER',
          entityId: String(wt.sellerId),
          referenceModel: wt.orderId ? 'Order' : 'WalletTransaction',
          referenceId: wt.orderId || wt.transactionId,
          status: wt.settlementStatus === 'SETTLED' ? 'SUCCESS' : (wt.settlementStatus || 'SUCCESS'),
          balanceBefore: wt.balanceBefore || 0,
          balanceAfter: wt.balanceAfter || 0,
          description: wt.description || 'Synced historical transaction',
          createdAt: wt.createdAt,
          updatedAt: wt.updatedAt,
        });
      }
    }

    // 4. Sync CaptainTransactions into PlatformLedger
    const captainTxns = await CaptainTransaction.find();
    console.log(`Found ${captainTxns.length} CaptainTransactions to sync`);
    for (const ct of captainTxns) {
      const exists = await PlatformLedger.findOne({ referenceId: ct.transactionId });
      if (!exists) {
        let category = 'CAPTAIN_EARNING';
        let type = 'CREDIT';
        if (ct.type === 'WITHDRAWAL') {
          category = 'CAPTAIN_PAYOUT';
          type = 'DEBIT';
        }

        await PlatformLedger.create({
          transactionId: ct.transactionId,
          category,
          type,
          amount: ct.amount || 0,
          source: type === 'CREDIT' ? 'PLATFORM_TREASURY' : 'CAPTAIN',
          destination: type === 'CREDIT' ? 'CAPTAIN' : 'PLATFORM_TREASURY',
          entityType: 'CAPTAIN',
          entityId: String(ct.captainId),
          referenceModel: ct.orderId ? 'Order' : 'CaptainTransaction',
          referenceId: ct.orderId || ct.transactionId,
          status: ct.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING',
          balanceBefore: ct.balanceBefore || 0,
          balanceAfter: ct.balanceAfter || 0,
          description: ct.description || 'Synced historical captain transaction',
          createdAt: ct.createdAt,
          updatedAt: ct.updatedAt,
        });
      }
    }

    console.log('Super Admin Financial Synchronization complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Sync error:', err);
    process.exit(1);
  }
};

sync();
