import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';
import express from 'express';
import productRoutes from '../routes/productRoutes.js';
import sellerRoutes from '../routes/sellerRoutes.js';
import http from 'http';

async function testApiEndpoints() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected for Express API test');

  const app = express();
  app.use(express.json());
  app.use('/api/products', productRoutes);
  app.use('/api/sellers', sellerRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5098, resolve));
  const baseUrl = 'http://localhost:5098';

  console.log('\n===============================================================');
  console.log('DIRECT HTTP API INTEGRATION TESTS');
  console.log('===============================================================\n');

  async function fetchJson(url) {
    const res = await fetch(url);
    return await res.json();
  }

  // 1. Customer request without coordinates -> must return count 0
  const noLocProds = await fetchJson(`${baseUrl}/api/products`);
  console.log(`1. GET /api/products (no lat/lng) -> Count: ${noLocProds.count}, Products: ${noLocProds.products.length}, Msg: "${noLocProds.message}"`);
  if (noLocProds.products.length === 0) console.log('   ✅ PASS: Zero fallback products returned.');
  else console.error('   ❌ FAIL: Fallback products leaked!');

  // 2. Customer request for sellers without coordinates -> must return count 0
  const noLocSellers = await fetchJson(`${baseUrl}/api/sellers`);
  console.log(`2. GET /api/sellers (no lat/lng) -> Count: ${noLocSellers.count}, Sellers: ${noLocSellers.sellers.length}, Msg: "${noLocSellers.message}"`);
  if (noLocSellers.sellers.length === 0) console.log('   ✅ PASS: Zero fallback sellers returned.');
  else console.error('   ❌ FAIL: Fallback sellers leaked!');

  // 3. Customer request at Vijay Nagar, Indore (22.7533, 75.8937)
  const vijayProds = await fetchJson(`${baseUrl}/api/products?lat=22.7533&lng=75.8937`);
  console.log(`3. GET /api/products?lat=22.7533&lng=75.8937 -> Count: ${vijayProds.count}, Products: ${vijayProds.products.length}`);
  const vijaySellers = await fetchJson(`${baseUrl}/api/sellers?lat=22.7533&lng=75.8937`);
  console.log(`   GET /api/sellers?lat=22.7533&lng=75.8937 -> Count: ${vijaySellers.count}, Sellers: ${vijaySellers.sellers.map(s => s.businessName).join(', ')}`);
  const hasRajasthanInVijay = vijayProds.products.some(p => p.seller && p.seller.toLowerCase().includes('jasnath'));
  if (!hasRajasthanInVijay && vijayProds.products.length > 0) {
    console.log('   ✅ PASS: Correct Indore sellers & products returned, zero Rajasthan sellers.');
  } else {
    console.error('   ❌ FAIL: Out of area seller/product leaked in Vijay Nagar query!');
  }

  // 4. Customer request at Rajasthan (25.8850, 71.8500)
  const rajProds = await fetchJson(`${baseUrl}/api/products?lat=25.8850&lng=71.8500`);
  console.log(`4. GET /api/products?lat=25.8850&lng=71.8500 -> Count: ${rajProds.count}, Products: ${rajProds.products.length}`);
  const hasIndoreInRaj = rajProds.products.some(p => p.seller && (p.seller.toLowerCase().includes('fashion') || p.seller.toLowerCase().includes('clothing')));
  if (!hasIndoreInRaj && rajProds.products.length > 0) {
    console.log('   ✅ PASS: Correct Rajasthan products returned, zero Indore products.');
  } else {
    console.error('   ❌ FAIL: Out of area seller/product leaked in Rajasthan query!');
  }

  // 5. Customer request at Remote Location (27.0000, 70.0000)
  const remoteProds = await fetchJson(`${baseUrl}/api/products?lat=27.0000&lng=70.0000`);
  console.log(`5. GET /api/products?lat=27.0000&lng=70.0000 -> Count: ${remoteProds.count}, Products: ${remoteProds.products.length}, Msg: "${remoteProds.message}"`);
  if (remoteProds.products.length === 0) console.log('   ✅ PASS: Empty result for remote location with zero sellers.');

  // 6. Direct store endpoint for out-of-area user
  const sellersDb = await mongoose.model('Seller').find({ businessName: 'Shree jasnath showroom gida' }).lean();
  if (sellersDb.length > 0) {
    const sId = sellersDb[0]._id;
    // Access Rajasthan store from Indore user
    const storeFromIndore = await fetchJson(`${baseUrl}/api/sellers/${sId}?lat=22.7533&lng=75.8937`);
    console.log(`6. GET /api/sellers/${sId}?lat=22.7533&lng=75.8937 (Distance: ${storeFromIndore.seller?.distance}) -> Products: ${storeFromIndore.products?.length || 0}, Msg: "${storeFromIndore.message}"`);
    if (storeFromIndore.products?.length === 0 && storeFromIndore.seller?.isCovered === false) {
      console.log('   ✅ PASS: Products blocked for user outside seller service radius.');
    } else {
      console.error('   ❌ FAIL: Products returned for out-of-radius user!');
    }
  }

  server.close();
  await mongoose.disconnect();
  console.log('\nAll API integration tests finished successfully!');
}

testApiEndpoints().catch(err => {
  console.error(err);
  process.exit(1);
});
