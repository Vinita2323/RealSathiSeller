import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Order from '../models/Order.model.js';
import PlatformLedger from '../models/PlatformLedger.model.js';
import PayoutRequest from '../models/PayoutRequest.model.js';
import WithdrawalRequest from '../models/WithdrawalRequest.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import SellerNotification from '../models/SellerNotification.model.js';
import RefundRequest from '../models/RefundRequest.model.js';
import TransportBooking from '../models/TransportBooking.model.js';
import ReturnRequest from '../models/ReturnRequest.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const getPlanInfo = (plan) => {
  const root = plan.queryPlanner?.winningPlan || plan.executionStats?.executionStages || plan;
  let stage = root.stage;
  let indexName = root.indexName;

  const traverse = (node) => {
    if (!node) return;
    if (node.stage === 'IXSCAN' || node.stage === 'COLLSCAN') {
      stage = node.stage;
      indexName = node.indexName || indexName;
      return;
    }
    if (node.inputStage) traverse(node.inputStage);
    if (node.inputStages) node.inputStages.forEach(traverse);
  };

  traverse(root);
  return { stage, indexName, docsExamined: plan.executionStats?.totalDocsExamined, keysExamined: plan.executionStats?.totalKeysExamined };
};

async function verifyAll() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB for Query Execution Plan Verification...\n');

  const queries = [
    {
      name: '1. Platform Ledger by Status & Date Sort',
      explain: async () => PlatformLedger.find({ status: 'SUCCESS' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '2. Platform Ledger by Type & Date Sort',
      explain: async () => PlatformLedger.find({ type: 'CREDIT' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '3. Platform Ledger by Category & Date Sort',
      explain: async () => PlatformLedger.find({ category: 'PLATFORM_COMMISSION' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '4. PayoutRequest Filter by Status & Date Sort',
      explain: async () => PayoutRequest.find({ status: 'PENDING' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '5. PayoutRequest Filter by RecipientType & Status',
      explain: async () => PayoutRequest.find({ recipientType: 'SELLER', status: 'PENDING' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '6. WithdrawalRequest Filter by SellerId & Date Sort',
      explain: async () => WithdrawalRequest.find({ sellerId: '660000000000000000000001' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '7. WithdrawalRequest Filter by Status & Date Sort',
      explain: async () => WithdrawalRequest.find({ status: 'PENDING' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '8. WalletTransaction Filter by SellerId & Type',
      explain: async () => WalletTransaction.find({ sellerId: '660000000000000000000001', type: 'CREDIT' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '9. CaptainTransaction Filter by Type (Aggregate Match)',
      explain: async () => CaptainTransaction.find({ type: 'CREDIT' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '10. SellerNotification Filter by SettlementStatus & Date Sort',
      explain: async () => SellerNotification.find({ settlementStatus: 'PENDING' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '11. RefundRequest Filter by Status & Date Sort',
      explain: async () => RefundRequest.find({ status: 'REQUESTED' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '12. Order Filter by PaymentStatus & Date Sort',
      explain: async () => Order.find({ paymentStatus: 'Paid' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '13. Order Filter by OrderStatus & Date Sort',
      explain: async () => Order.find({ orderStatus: 'Delivered' }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '14. TransportBooking Filter by CaptainId & Date Sort',
      explain: async () => TransportBooking.find({ captainId: new mongoose.Types.ObjectId() }).sort({ createdAt: -1 }).explain('executionStats'),
    },
    {
      name: '15. ReturnRequest Filter by Seller & Date Sort',
      explain: async () => ReturnRequest.find({ seller: new mongoose.Types.ObjectId() }).sort({ createdAt: -1 }).explain('executionStats'),
    },
  ];

  for (const q of queries) {
    try {
      const plan = await q.explain();
      const info = getPlanInfo(plan);
      console.log(`Query: ${q.name}`);
      console.log(`Scan Stage: ${info.stage === 'IXSCAN' ? '✅ IXSCAN' : info.stage}`);
      if (info.indexName) {
        console.log(`Index Used: ${info.indexName}`);
      }
      console.log('');
    } catch (err) {
      console.error(`Error explaining ${q.name}:`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('Verification Complete.');
}

verifyAll();
