import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';
import express from 'express';
import adminRoutes from '../routes/adminRoutes.js';
import sellerRoutes from '../routes/sellerRoutes.js';
import Seller from '../models/Seller.model.js';
import Product from '../models/Product.model.js';
import http from 'http';

async function testDeleteSeller() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected for delete test');

  // Create a temporary test seller and a test product
  const testSeller = await Seller.create({
    businessName: 'Temporary Test Seller Store',
    ownerName: 'Test Owner',
    phone: '9999999990',
    status: 'approved',
    accountStatus: 'approved'
  });
  console.log(`Created test seller: ID ${testSeller._id} ("${testSeller.businessName}")`);

  const testProduct = await Product.create({
    name: 'Temporary Test Product for Delete',
    mrp: 100,
    salePrice: 80,
    stock: 10,
    sellerId: testSeller._id,
    seller: testSeller.businessName
  });
  console.log(`Created test product: ID ${testProduct._id} ("${testProduct.name}")`);

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/sellers', sellerRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5097, resolve));
  const baseUrl = 'http://localhost:5097';

  // Call DELETE /api/admin/sellers/:id
  const deleteRes = await fetch(`${baseUrl}/api/admin/sellers/${testSeller._id}`, {
    method: 'DELETE'
  });
  const deleteData = await deleteRes.json();
  console.log('DELETE response:', deleteData);

  // Verify seller is gone from DB
  const verifySeller = await Seller.findById(testSeller._id);
  console.log('Seller in DB after delete:', verifySeller ? 'STILL EXISTS (FAIL)' : 'DELETED (PASS)');

  // Verify associated product is cleaned up
  const verifyProduct = await Product.findById(testProduct._id);
  console.log('Product in DB after delete:', verifyProduct ? 'STILL EXISTS' : 'CLEANED UP (PASS)');

  server.close();
  await mongoose.disconnect();

  if (!verifySeller) {
    console.log('\n✅ DELETE SELLER ENDPOINT TEST PASSED SUCCESSFULLY!');
  } else {
    console.error('\n❌ DELETE SELLER ENDPOINT TEST FAILED!');
    process.exit(1);
  }
}

testDeleteSeller().catch(err => {
  console.error(err);
  process.exit(1);
});
