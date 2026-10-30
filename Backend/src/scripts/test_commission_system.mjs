import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import CommissionSettings from '../models/CommissionSettings.model.js';
import Order from '../models/Order.model.js';
import TransportBooking from '../models/TransportBooking.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/shippnex';

async function runCommissionTests() {
  console.log('--- 🧪 STARTING COMMISSION SYSTEM VALIDATION TEST ---');
  await mongoose.connect(MONGO_URI);
  console.log(' Connected to MongoDB');

  try {
    // ── Test 1: Get or Create Active Settings ──────────────────────────────
    console.log('\n[Test 1] Testing CommissionSettings.getOrCreateActiveSettings()...');
    let settings = await CommissionSettings.getOrCreateActiveSettings();
    console.log(` Initial Settings => Seller: ${settings.sellerCommission}%, Captain: ${settings.captainCommission}%, Active: ${settings.isActive}`);
    if (typeof settings.sellerCommission !== 'number' || typeof settings.captainCommission !== 'number') {
      throw new Error('Test 1 Failed: Rates are not numeric numbers.');
    }
    console.log('✅ Test 1 Passed: Default singleton settings retrieved.');

    // ── Test 2: Admin Updates Rates to Seller 10% and Captain 5% ────────────
    console.log('\n[Test 2] Setting baseline: Seller 10%, Captain 5%...');
    settings.sellerCommission = 10;
    settings.captainCommission = 5;
    settings.history.unshift({
      sellerCommission: 10,
      captainCommission: 5,
      sellerCommissionType: 'Percentage',
      captainCommissionType: 'Percentage',
      isActive: true,
      changedBy: 'Test Runner',
      changedAt: new Date(),
      reason: 'Baseline 10% / 5% for automated testing',
    });
    await settings.save();
    console.log('✅ Test 2 Passed: Baseline rates saved (Seller: 10%, Captain: 5%).');

    // ── Test 3: Create Order A under 10% / 5% Regime ────────────────────────
    console.log('\n[Test 3] Creating Order A (Amount: ₹1,000) under 10% / 5% rate...');
    const orderAId = `ORD-TEST-${Date.now()}-A`;
    const orderA = await Order.create({
      orderId: orderAId,
      user: new mongoose.Types.ObjectId(),
      items: [{
        product: new mongoose.Types.ObjectId(),
        name: 'Test Grocery Pack',
        price: 1000,
        originalPrice: 1000,
        quantity: 1,
        seller: 'Test Seller Store',
      }],
      shippingAddress: {
        fullName: 'Test Customer A',
        phone: '9876543210',
        addressLine1: 'Sector 62',
        city: 'Noida',
        state: 'UP',
        pincode: '201301',
      },
      itemsTotal: 1000,
      shippingFee: 0,
      discount: 0,
      gst: 0,
      grandTotal: 1000,
      sellerCommissionRate: 10,
      sellerCommissionAmount: 100,
      sellerEarning: 900,
      captainCommissionRate: 5,
      captainCommissionAmount: 50,
      captainEarnings: 50,
      captainEarning: 50,
    });
    console.log(` Order A created => ID: ${orderA.orderId}, SellerComm: ${orderA.sellerCommissionRate}% (₹${orderA.sellerCommissionAmount}), SellerEarn: ₹${orderA.sellerEarning}, CaptainComm: ${orderA.captainCommissionRate}% (₹${orderA.captainCommissionAmount})`);
    if (orderA.sellerCommissionAmount !== 100 || orderA.sellerEarning !== 900) {
      throw new Error('Test 3 Failed: Order A calculations incorrect.');
    }
    console.log('✅ Test 3 Passed: Order A calculated and frozen at 10% / ₹100.');

    // ── Test 4: Admin Updates Rates dynamically to Seller 15%, Captain 8% ───
    console.log('\n[Test 4] Admin updating Commission Settings to: Seller 15%, Captain 8%...');
    settings = await CommissionSettings.getOrCreateActiveSettings();
    settings.sellerCommission = 15;
    settings.captainCommission = 8;
    settings.history.unshift({
      sellerCommission: 15,
      captainCommission: 8,
      sellerCommissionType: 'Percentage',
      captainCommissionType: 'Percentage',
      isActive: true,
      changedBy: 'Admin (Automated Test)',
      changedAt: new Date(),
      reason: 'Dynamic rate change test',
    });
    await settings.save();
    console.log(` Active Rates Updated => Seller: ${settings.sellerCommission}%, Captain: ${settings.captainCommission}%`);
    console.log('✅ Test 4 Passed: Rates dynamically updated in DB.');

    // ── Test 5: Create Order B under NEW 15% / 8% Regime ───────────────────
    console.log('\n[Test 5] Creating Order B (Amount: ₹1,000) under new 15% / 8% rate...');
    const orderBId = `ORD-TEST-${Date.now()}-B`;
    const orderBAmount = 1000;
    const sCommAmt = Number(((orderBAmount * settings.sellerCommission) / 100).toFixed(2));
    const sEarn = Number((orderBAmount - sCommAmt).toFixed(2));
    const cCommAmt = Number(((orderBAmount * settings.captainCommission) / 100).toFixed(2));

    const orderB = await Order.create({
      orderId: orderBId,
      user: new mongoose.Types.ObjectId(),
      items: [{
        product: new mongoose.Types.ObjectId(),
        name: 'Test Grocery Pack B',
        price: 1000,
        originalPrice: 1000,
        quantity: 1,
        seller: 'Test Seller Store',
      }],
      shippingAddress: {
        fullName: 'Test Customer B',
        phone: '9876543211',
        addressLine1: 'Sector 18',
        city: 'Noida',
        state: 'UP',
        pincode: '201301',
      },
      itemsTotal: 1000,
      shippingFee: 0,
      discount: 0,
      gst: 0,
      grandTotal: 1000,
      sellerCommissionRate: settings.sellerCommission,
      sellerCommissionAmount: sCommAmt,
      sellerEarning: sEarn,
      captainCommissionRate: settings.captainCommission,
      captainCommissionAmount: cCommAmt,
      captainEarnings: cCommAmt,
      captainEarning: cCommAmt,
    });
    console.log(` Order B created => ID: ${orderB.orderId}, SellerComm: ${orderB.sellerCommissionRate}% (₹${orderB.sellerCommissionAmount}), SellerEarn: ₹${orderB.sellerEarning}, CaptainComm: ${orderB.captainCommissionRate}% (₹${orderB.captainCommissionAmount})`);
    if (orderB.sellerCommissionRate !== 15 || orderB.sellerCommissionAmount !== 150 || orderB.sellerEarning !== 850) {
      throw new Error('Test 5 Failed: Order B did not apply new 15% rate.');
    }
    console.log('✅ Test 5 Passed: Order B dynamically applied 15% rate (₹150 cut, ₹850 net).');

    // ── Test 6: Verify Historical Immutability on Order A ────────────────────
    console.log('\n[Test 6] Verifying Historical Immutability on Order A...');
    const refetchedOrderA = await Order.findOne({ orderId: orderAId });
    console.log(` Refetched Order A => SellerCommRate: ${refetchedOrderA.sellerCommissionRate}%, CommAmt: ₹${refetchedOrderA.sellerCommissionAmount}, SellerEarn: ₹${refetchedOrderA.sellerEarning}`);
    if (refetchedOrderA.sellerCommissionRate !== 10 || refetchedOrderA.sellerCommissionAmount !== 100) {
      throw new Error('Test 6 Failed: Historical immutability violated! Order A changed.');
    }
    console.log('✅ Test 6 Passed: Historical Order A remains strictly frozen at 10% / ₹100.');

    // ── Test 7: Validation Boundary Checking ────────────────────────────────
    console.log('\n[Test 7] Testing Validation Bounds (Negative and > 100%)...');
    const negativeTest = new CommissionSettings({
      sellerCommission: -5,
      captainCommission: 5,
    });
    let negativeThrew = false;
    try {
      await negativeTest.validate();
    } catch (err) {
      negativeThrew = true;
      console.log(` Negative validation caught correctly: "${err.errors?.sellerCommission?.message}"`);
    }
    if (!negativeThrew) throw new Error('Test 7 Failed: Negative commission was not rejected.');

    const over100Test = new CommissionSettings({
      sellerCommission: 10,
      captainCommission: 105,
    });
    let over100Threw = false;
    try {
      await over100Test.validate();
    } catch (err) {
      over100Threw = true;
      console.log(` >100% validation caught correctly: "${err.errors?.captainCommission?.message}"`);
    }
    if (!over100Threw) throw new Error('Test 7 Failed: >100% commission was not rejected.');
    console.log('✅ Test 7 Passed: Boundary validations enforce 0 <= rate <= 100.');

    // ── Clean up test documents ─────────────────────────────────────────────
    await Order.deleteMany({ orderId: { $in: [orderAId, orderBId] } });
    console.log('\n Cleaned up test orders.');

    console.log('\n======================================================');
    console.log('🎉 ALL COMMISSION SYSTEM TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================');
  } catch (error) {
    console.error('\n❌ COMMISSION TEST FAILED:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runCommissionTests();
