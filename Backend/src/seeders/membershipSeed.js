import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SellerMembershipPlan from '../models/SellerMembershipPlan.model.js';
import CaptainMembershipPlan from '../models/CaptainMembershipPlan.model.js';

dotenv.config();

const sellerDefaultPlans = [
  {
    name: 'Monthly Plan',
    durationType: 'monthly',
    durationMonths: 1,
    price: 999,
    description: 'Start selling on Sathi Seller with our monthly plan. Cancel anytime.',
    features: ['List up to 50 products', 'Order management', 'Wallet & payouts', 'Customer support', 'Analytics dashboard'],
    status: 'active',
    displayOrder: 1,
  },
  {
    name: 'Half-Yearly Plan',
    durationType: 'halfYearly',
    durationMonths: 6,
    price: 4999,
    description: 'Best value for growing sellers. Save ₹994 compared to monthly.',
    features: ['List up to 200 products', 'Order management', 'Wallet & payouts', 'Priority customer support', 'Advanced analytics', 'Promotional tools'],
    status: 'active',
    displayOrder: 2,
  },
  {
    name: 'Yearly Plan',
    durationType: 'yearly',
    durationMonths: 12,
    price: 7999,
    description: 'Maximum savings for serious sellers. Save ₹3,989 compared to monthly.',
    features: ['Unlimited product listings', 'Order management', 'Wallet & payouts', 'Dedicated account manager', 'Full analytics suite', 'All promotional tools', 'Early feature access'],
    status: 'active',
    displayOrder: 3,
  },
];

const captainDefaultPlans = [
  {
    name: 'Monthly Plan',
    durationType: 'monthly',
    durationMonths: 1,
    price: 299,
    description: 'Start delivering with Sathi Seller. Cancel anytime.',
    features: ['Accept delivery jobs', 'Wallet & withdrawals', 'Route navigation', 'Earnings dashboard'],
    status: 'active',
    displayOrder: 1,
  },
  {
    name: 'Half-Yearly Plan',
    durationType: 'halfYearly',
    durationMonths: 6,
    price: 1499,
    description: 'Great value for regular captains. Save ₹295 compared to monthly.',
    features: ['Accept delivery & transport jobs', 'Wallet & withdrawals', 'Route navigation', 'Priority job assignment', 'Earnings dashboard'],
    status: 'active',
    displayOrder: 2,
  },
  {
    name: 'Yearly Plan',
    durationType: 'yearly',
    durationMonths: 12,
    price: 2499,
    description: 'Best value for full-time captains. Save ₹1,089 compared to monthly.',
    features: ['All job types', 'Wallet & withdrawals', 'Route navigation', 'Priority job assignment', 'Earnings analytics', 'Bonus rewards access', 'Dedicated support'],
    status: 'active',
    displayOrder: 3,
  },
];

const seedMembershipPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Seed Seller Plans (only if none exist)
    const existingSellerPlans = await SellerMembershipPlan.countDocuments();
    if (existingSellerPlans === 0) {
      await SellerMembershipPlan.insertMany(sellerDefaultPlans);
      console.log('✓ Seeded 3 default Seller Membership Plans');
    } else {
      console.log(`ℹ Seller plans already exist (${existingSellerPlans} found) — skipping`);
    }

    // Seed Captain Plans (only if none exist)
    const existingCaptainPlans = await CaptainMembershipPlan.countDocuments();
    if (existingCaptainPlans === 0) {
      await CaptainMembershipPlan.insertMany(captainDefaultPlans);
      console.log('✓ Seeded 3 default Captain Membership Plans');
    } else {
      console.log(`ℹ Captain plans already exist (${existingCaptainPlans} found) — skipping`);
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error.message);
    process.exit(1);
  }
};

seedMembershipPlans();
