import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';
import Seller from '../models/Seller.model.js';
import Product from '../models/Product.model.js';
import { getEligibleSellersForLocation, isValidCoordinate } from '../utils/sellerLocationHelper.js';
import { haversineDistance } from '../utils/haversine.js';

async function runVerification() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(' connected to MongoDB\n');

  // Locations to test
  const LOC_VIJAY_NAGAR = { name: 'Vijay Nagar, Indore', lat: 22.7533, lng: 75.8937 };
  const LOC_PALASIA = { name: 'Palasia, Indore', lat: 22.7244, lng: 75.8875 };
  const LOC_RAU = { name: 'Rau, Indore', lat: 22.6560, lng: 75.8280 };
  const LOC_RAJASTHAN = { name: 'Manpura Kharda, Rajasthan', lat: 25.8850, lng: 71.8500 };
  const LOC_REMOTE = { name: 'Remote Desert (No Sellers)', lat: 27.0000, lng: 70.0000 };

  console.log('===============================================================');
  console.log('TEST SUITE: EXACT LOCATION & RADIUS VISIBILITY VERIFICATION');
  console.log('===============================================================\n');

  // Helper to test a location
  async function testLocation(loc) {
    console.log(`--- Testing Location: ${loc.name} (${loc.lat}, ${loc.lng}) ---`);
    const { eligibleSellers, eligibleSellerIds, eligibleSellerNames } = await getEligibleSellersForLocation(loc.lat, loc.lng);
    
    console.log(`Eligible Sellers (${eligibleSellers.length}):`);
    eligibleSellers.forEach(s => {
      console.log(`  - [${s.businessName}] Distance: ${s.distance}, Radius: ${s.serviceRadius} KM`);
    });

    let products = [];
    if (eligibleSellerIds.length > 0) {
      products = await Product.find({
        $or: [
          { sellerId: { $in: eligibleSellerIds } },
          { seller: { $in: eligibleSellerNames } },
          { seller: { $in: eligibleSellerIds.map(id => id.toString()) } }
        ]
      }).select('name seller sellerId').lean();
    }

    console.log(`Eligible Products (${products.length}):`);
    products.slice(0, 5).forEach(p => {
      console.log(`  * [${p.name}] - Seller: ${p.seller}`);
    });
    if (products.length > 5) {
      console.log(`  ... and ${products.length - 5} more products`);
    }

    // Verify that NO product belongs to an ineligible seller
    const allSellers = await Seller.find({}).lean();
    const ineligibleSellers = allSellers.filter(s => !eligibleSellerIds.some(eid => eid.toString() === s._id.toString()));
    const ineligibleSellerNames = ineligibleSellers.map(s => s.businessName).filter(Boolean);
    const leakedProducts = products.filter(p => ineligibleSellerNames.includes(p.seller));

    if (leakedProducts.length > 0) {
      console.error(`❌ LEAK DETECTED! ${leakedProducts.length} products belong to ineligible sellers!`);
    } else {
      console.log(`✅ PASS: Zero leaked products from ineligible sellers.`);
    }
    console.log('');
    return { sellersCount: eligibleSellers.length, productsCount: products.length };
  }

  // TEST 1 & 2: Vijay Nagar
  const rVijay = await testLocation(LOC_VIJAY_NAGAR);

  // TEST 5: Palasia
  const rPalasia = await testLocation(LOC_PALASIA);

  // TEST 3 & 4: Rau (Distant sellers rejected)
  const rRau = await testLocation(LOC_RAU);

  // TEST: Rajasthan
  const rRaj = await testLocation(LOC_RAJASTHAN);

  // TEST 6: Remote location (0 sellers)
  const rRemote = await testLocation(LOC_REMOTE);

  console.log('===============================================================');
  console.log('SUMMARY TABLE:');
  console.log('===============================================================');
  console.table([
    { Location: LOC_VIJAY_NAGAR.name, 'Eligible Sellers': rVijay.sellersCount, 'Eligible Products': rVijay.productsCount },
    { Location: LOC_PALASIA.name, 'Eligible Sellers': rPalasia.sellersCount, 'Eligible Products': rPalasia.productsCount },
    { Location: LOC_RAU.name, 'Eligible Sellers': rRau.sellersCount, 'Eligible Products': rRau.productsCount },
    { Location: LOC_RAJASTHAN.name, 'Eligible Sellers': rRaj.sellersCount, 'Eligible Products': rRaj.productsCount },
    { Location: LOC_REMOTE.name, 'Eligible Sellers': rRemote.sellersCount, 'Eligible Products': rRemote.productsCount },
  ]);

  await mongoose.disconnect();
}

runVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
