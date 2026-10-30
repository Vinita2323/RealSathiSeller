import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import performanceLogger from '../middleware/performanceMiddleware.js';

import categoryRoutes from '../routes/categoryRoutes.js';
import bannerRoutes from '../routes/bannerRoutes.js';
import sellerRoutes from '../routes/sellerRoutes.js';
import productRoutes from '../routes/productRoutes.js';
import membershipRoutes from '../routes/membershipRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(performanceLogger);
app.use(compression({ threshold: 1024 }));
app.use(cors());
app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/admin', adminRoutes);

const runBenchmark = async () => {
  await connectDB();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(5099, resolve));
  console.log('\n======================================================');
  console.log('🚀 SHEX PERFORMANCE AUDIT BENCHMARK SUITE');
  console.log('======================================================\n');

  const testEndpoints = [
    { name: 'Categories (Cold / First DB Query)', url: 'http://localhost:5099/api/categories?fresh=true' },
    { name: 'Categories (Warm In-Memory Cache)', url: 'http://localhost:5099/api/categories' },
    { name: 'Banners (Cold / First DB Query)', url: 'http://localhost:5099/api/banners?fresh=true' },
    { name: 'Banners (Warm In-Memory Cache)', url: 'http://localhost:5099/api/banners' },
    { name: 'Public Sellers (Cold / First DB Query)', url: 'http://localhost:5099/api/sellers?fresh=true' },
    { name: 'Public Sellers (Warm In-Memory Cache)', url: 'http://localhost:5099/api/sellers' },
    { name: 'Products Listing (Bounded Pagination 50 + Lean)', url: 'http://localhost:5099/api/products?page=1&limit=50' },
    { name: 'Seller Membership Plans (Warm Cache)', url: 'http://localhost:5099/api/membership/seller/plans' },
    { name: 'Captain Membership Plans (Warm Cache)', url: 'http://localhost:5099/api/membership/captain/plans' },
  ];

  for (const ep of testEndpoints) {
    const start = performance.now();
    const res = await fetch(ep.url);
    const data = await res.json();
    const clientLatency = (performance.now() - start).toFixed(2);
    const serverTiming = res.headers.get('x-response-time') || 'N/A';
    const status = res.status;
    const count = data.count !== undefined ? data.count : (data.plans ? data.plans.length : 'N/A');

    console.log(`📌 [${ep.name}]`);
    console.log(`   Status: ${status} OK | Server Processing (X-Response-Time): ${serverTiming} | Total Roundtrip: ${clientLatency}ms | Items: ${count}`);
  }

  console.log('\n======================================================');
  console.log('✅ BENCHMARK RUN COMPLETED SUCCESSFULLY');
  console.log('======================================================\n');

  server.close(() => {
    process.exit(0);
  });
};

runBenchmark().catch((err) => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
