import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { haversineDistance } from '../utils/haversine.js';
import Seller from '../models/Seller.model.js';
import Product from '../models/Product.model.js';

async function audit() {
  await mongoose.connect(process.env.MONGODB_URI);
  const sellers = await Seller.find().lean();
  const products = await Product.find().lean();

  console.log(`Loaded ${sellers.length} sellers and ${products.length} products from MongoDB`);

  const locations = [
    { name: 'Vijay Nagar, Indore', lat: 22.7533, lng: 75.8937 },
    { name: 'Palasia, Indore', lat: 22.7244, lng: 75.8875 },
    { name: 'Rau, Indore', lat: 22.6560, lng: 75.8280 },
    { name: 'Manpura Kharda, Rajasthan', lat: 25.8850, lng: 71.8500 }
  ];

  for (const loc of locations) {
    console.log('\n==========================================');
    console.log(`TESTING FOR USER AT: ${loc.name} (${loc.lat}, ${loc.lng})`);
    console.log('==========================================');

    const eligibleSellers = [];
    for (const s of sellers) {
      const coords = s.location?.coordinates || s.warehouseLocation?.location?.coordinates || [0, 0];
      const dist = haversineDistance(loc.lat, loc.lng, coords[1], coords[0]);
      const radius = s.serviceRadius || 5;
      const isEligible = dist <= radius && s.status === 'approved' && coords[0] !== 0 && coords[1] !== 0;

      if (isEligible) {
        eligibleSellers.push(s);
      }

      console.log(`Seller: [${s.businessName.padEnd(28)}] | Coords: [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}] | Dist: ${dist.toFixed(2).padStart(6)} KM | Radius: ${String(radius).padStart(3)} KM | Eligible: ${isEligible ? '✅ YES' : '❌ NO'}`);
    }

    const eligibleSellerIds = eligibleSellers.map(s => String(s._id));
    const eligibleProducts = products.filter(p => {
      return p.sellerId && eligibleSellerIds.includes(String(p.sellerId));
    });

    console.log(`\n-> Eligible Sellers Count: ${eligibleSellers.length}`);
    console.log(`-> Eligible Products Count: ${eligibleProducts.length}`);
    console.log(`-> Eligible Product Names (first 5):`, eligibleProducts.slice(0, 5).map(p => `${p.name} [by ${p.seller}]`));
  }

  await mongoose.disconnect();
}

audit().catch(console.error);
