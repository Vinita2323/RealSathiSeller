import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../models/User.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import Admin from '../models/Admin.model.js';
import Product from '../models/Product.model.js';
import Order from '../models/Order.model.js';
import Category from '../models/Category.model.js';
import Banner from '../models/Banner.model.js';
import TransportBooking from '../models/TransportBooking.model.js';
import VehicleType from '../models/VehicleType.model.js';
import SellerNotification from '../models/SellerNotification.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import WithdrawalRequest from '../models/WithdrawalRequest.model.js';
import SellerMembership from '../models/SellerMembership.model.js';
import SellerMembershipPlan from '../models/SellerMembershipPlan.model.js';
import CaptainMembership from '../models/CaptainMembership.model.js';
import CaptainMembershipPlan from '../models/CaptainMembershipPlan.model.js';
import Rating from '../models/Rating.model.js';
import ProductReview from '../models/ProductReview.model.js';
import ProfileEditRequest from '../models/ProfileEditRequest.model.js';
import Policy from '../models/Policy.model.js';
import PlatformLedger from '../models/PlatformLedger.model.js';
import PayoutRequest from '../models/PayoutRequest.model.js';
import FinancialAdjustment from '../models/FinancialAdjustment.model.js';
import FinancialAuditLog from '../models/FinancialAuditLog.model.js';
import RefundRequest from '../models/RefundRequest.model.js';
import ReturnRequest from '../models/ReturnRequest.model.js';
import Referral from '../models/Referral.model.js';
import ReferralSettings from '../models/ReferralSettings.model.js';
import CommissionSettings from '../models/CommissionSettings.model.js';
import SellerRegistrationPayment from '../models/SellerRegistrationPayment.model.js';
import CaptainRegistrationPayment from '../models/CaptainRegistrationPayment.model.js';
import SellerRegistrationFeeConfig from '../models/SellerRegistrationFeeConfig.model.js';
import CaptainRegistrationFeeConfig from '../models/CaptainRegistrationFeeConfig.model.js';
import RazorpayWebhookEvent from '../models/RazorpayWebhookEvent.model.js';
import Cart from '../models/Cart.model.js';
import Wishlist from '../models/Wishlist.model.js';
import Faq from '../models/Faq.model.js';
import SupportSetting from '../models/SupportSetting.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const models = [
  { name: 'User', model: User },
  { name: 'Seller', model: Seller },
  { name: 'Captain', model: Captain },
  { name: 'Admin', model: Admin },
  { name: 'Product', model: Product },
  { name: 'Order', model: Order },
  { name: 'Category', model: Category },
  { name: 'Banner', model: Banner },
  { name: 'TransportBooking', model: TransportBooking },
  { name: 'VehicleType', model: VehicleType },
  { name: 'SellerNotification', model: SellerNotification },
  { name: 'CaptainNotification', model: CaptainNotification },
  { name: 'CaptainTransaction', model: CaptainTransaction },
  { name: 'WalletTransaction', model: WalletTransaction },
  { name: 'WithdrawalRequest', model: WithdrawalRequest },
  { name: 'SellerMembership', model: SellerMembership },
  { name: 'SellerMembershipPlan', model: SellerMembershipPlan },
  { name: 'CaptainMembership', model: CaptainMembership },
  { name: 'CaptainMembershipPlan', model: CaptainMembershipPlan },
  { name: 'Rating', model: Rating },
  { name: 'ProductReview', model: ProductReview },
  { name: 'ProfileEditRequest', model: ProfileEditRequest },
  { name: 'Policy', model: Policy },
  { name: 'PlatformLedger', model: PlatformLedger },
  { name: 'PayoutRequest', model: PayoutRequest },
  { name: 'FinancialAdjustment', model: FinancialAdjustment },
  { name: 'FinancialAuditLog', model: FinancialAuditLog },
  { name: 'RefundRequest', model: RefundRequest },
  { name: 'ReturnRequest', model: ReturnRequest },
  { name: 'Referral', model: Referral },
  { name: 'ReferralSettings', model: ReferralSettings },
  { name: 'CommissionSettings', model: CommissionSettings },
  { name: 'SellerRegistrationPayment', model: SellerRegistrationPayment },
  { name: 'CaptainRegistrationPayment', model: CaptainRegistrationPayment },
  { name: 'SellerRegistrationFeeConfig', model: SellerRegistrationFeeConfig },
  { name: 'CaptainRegistrationFeeConfig', model: CaptainRegistrationFeeConfig },
  { name: 'RazorpayWebhookEvent', model: RazorpayWebhookEvent },
  { name: 'Cart', model: Cart },
  { name: 'Wishlist', model: Wishlist },
  { name: 'Faq', model: Faq },
  { name: 'SupportSetting', model: SupportSetting },
];

export const syncAllIndexes = async ({ dryRun = false } = {}) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in environment.');
    return;
  }

  let connectedHere = false;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      connectTimeoutMS: 10000,
    });
    connectedHere = true;
    console.log(`Connected to MongoDB [${dryRun ? 'DRY-RUN MODE' : 'LIVE SYNC MODE'}]...\n`);
  }

  console.log(`Database Index Synchronization${dryRun ? ' (Dry Run Inspection)' : ''}\n`);

  let totalIndexesChecked = 0;
  let totalIndexesCreated = 0;
  let totalIndexesAlreadyPresent = 0;
  let totalErrors = 0;
  let duplicateKeyErrors = 0;

  for (const { name, model } of models) {
    try {
      // 1. Inspect existing indexes in collection
      let existingIndexes = [];
      try {
        existingIndexes = await model.collection.indexes();
      } catch (e) {
        existingIndexes = [];
      }

      const existingNames = new Set(existingIndexes.map((idx) => idx.name));

      if (dryRun) {
        // Inspect schema defined indexes vs existing in database
        const schemaIndexes = model.schema.indexes();
        console.log(`${name}:`);
        console.log(`✓ indexes checked (${existingIndexes.length} active in MongoDB)`);
        console.log(`✓ schema definitions: ${schemaIndexes.length + 1} declared`);
        totalIndexesChecked += existingIndexes.length;
        totalIndexesAlreadyPresent += existingIndexes.length;
        console.log('');
        continue;
      }

      // 2. Safe non-destructive index synchronization
      await model.createIndexes();

      // 3. Inspect indexes after synchronization
      const currentIndexes = await model.collection.indexes();
      const newlyCreated = currentIndexes.filter((idx) => !existingNames.has(idx.name)).length;
      const alreadyPresent = currentIndexes.length - newlyCreated;

      totalIndexesChecked += currentIndexes.length;
      totalIndexesCreated += newlyCreated;
      totalIndexesAlreadyPresent += alreadyPresent;

      console.log(`${name}:`);
      console.log('✓ indexes checked');
      console.log('✓ indexes synchronized');
      if (newlyCreated > 0) {
        console.log(`  (${newlyCreated} new index(es) created, ${alreadyPresent} existing)`);
      }
      console.log('');
    } catch (err) {
      totalErrors++;
      if (err.code === 11000 || err.message?.includes('E11000') || err.message?.includes('duplicate key')) {
        duplicateKeyErrors++;
      }
      console.error(`✗ ${name} index synchronization error:`, err.message);
      console.log('');
    }
  }

  console.log('-----------------------------------');
  console.log(`Execution Mode: ${dryRun ? 'DRY-RUN (Read-Only Inspection)' : 'LIVE SYNCHRONIZATION'}`);
  console.log(`Total models processed: ${models.length}`);
  console.log(`Total indexes checked: ${totalIndexesChecked}`);
  console.log(`Total indexes created: ${totalIndexesCreated}`);
  console.log(`Total indexes active/present: ${totalIndexesAlreadyPresent}`);
  console.log(`Duplicate key errors: ${duplicateKeyErrors}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Index Health: ${totalErrors === 0 ? '100% HEALTHY' : 'NEEDS REVIEW'}`);
  console.log('-----------------------------------');

  if (connectedHere) {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }

  return {
    totalIndexesChecked,
    totalIndexesCreated,
    totalIndexesAlreadyPresent,
    totalErrors,
    duplicateKeyErrors,
  };
};

if (process.argv[1] && process.argv[1].endsWith('syncIndexes.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  syncAllIndexes({ dryRun: isDryRun })
    .then((stats) => {
      if (stats && stats.totalErrors > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal index sync error:', err);
      process.exit(1);
    });
}
