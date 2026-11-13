import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import healthRoutes from './routes/healthRoutes.js';
import path from 'path';
import fs from 'fs';
import { initSocket } from './socket/socket.js';
import userAuthRoutes from './routes/userAuthRoutes.js';
import userNotificationRoutes from './routes/userNotificationRoutes.js';
import sellerAuthRoutes from './routes/sellerAuthRoutes.js';
import captainAuthRoutes from './routes/captainAuthRoutes.js';
import captainRoutes from './routes/captainRoutes.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import superAdminAuthRoutes from './routes/superAdminAuthRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { releaseAllExpiredPaymentHolds } from './controllers/orderController.js';
import adminRoutes from './routes/adminRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import vehicleTypeRoutes from './routes/vehicleTypeRoutes.js';
import transportBookingRoutes from './routes/transportBookingRoutes.js';
import membershipRoutes from './routes/membershipRoutes.js';
import policyRoutes from './routes/policyRoutes.js';
import fcmTokenRoutes from './routes/fcmTokenRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import profileEditRequestRoutes from './routes/profileEditRequestRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import sellerRegistrationFeeRoutes from './routes/sellerRegistrationFeeRoutes.js';
import captainRegistrationFeeRoutes from './routes/captainRegistrationFeeRoutes.js';
import commissionRoutes from './routes/commissionRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import repairRoutes from './routes/repairRoutes.js';
import razorpayWebhookRoutes from './routes/razorpayWebhookRoutes.js';
import compression from 'compression';
import performanceLogger from './middleware/performanceMiddleware.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// Performance Timing Middleware (Logs latency & attaches X-Response-Time header)
app.use(performanceLogger);

// Middlewares
app.use(compression({
  threshold: 1024, // compress responses over 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(cors({
  // Reflect the request origin so credentialed admin cookie auth works
  // (origin cannot be "*" when credentials are enabled).
  origin: (origin, callback) => callback(null, origin || true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  // Let browsers cache the preflight so every cart/wishlist/order mutation
  // (which carries a custom Authorization header) doesn't pay for a second
  // OPTIONS round trip on top of the actual request.
  maxAge: 86400,
}));

app.use(cookieParser());

// CSP headers to allow Google Maps and other third-party services
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://code.jquery.com http://localhost:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com http://localhost:*; img-src 'self' data: https: http://localhost:*; connect-src 'self' http://localhost:* https://maps.googleapis.com https://maps.gstatic.com https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' https://fonts.gstatic.com http://localhost:*; frame-src 'self' https://maps.googleapis.com http://localhost:*;"
  );
  next();
});

// Razorpay webhook needs the raw request body for signature verification, so it is
// mounted before the global JSON parser (which would consume and re-serialize it).
app.use('/api/payments/razorpay', razorpayWebhookRoutes);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static uploads folder with aggressive caching headers (7 days)
const uploadsDir = fs.existsSync(path.join(__dirname, '../uploads')) 
  ? path.join(__dirname, '../uploads') 
  : path.join(process.cwd(), 'uploads');

const serveUploads = express.static(uploadsDir, { 
  maxAge: '7d', 
  etag: true, 
  immutable: true 
});

app.use('/uploads', serveUploads);
app.use('/api/uploads', serveUploads);

// Fallback for missing uploads images: return 404 so frontend gracefully displays initial letter
const handleUploadFallback = (req, res, next) => {
  res.status(404).send('Image not found');
};

app.use('/uploads', handleUploadFallback);
app.use('/api/uploads', handleUploadFallback);

// Core API Routes (Mounted under both /api and root for backwards compatibility)
const registerRoutes = (prefix = '') => {
  app.use(`${prefix}/auth/user`, userAuthRoutes);
  app.use(`${prefix}/user/notifications`, userNotificationRoutes);
  app.use(`${prefix}/auth/seller`, sellerAuthRoutes);
  app.use(`${prefix}/auth/captain`, captainAuthRoutes);
  app.use(`${prefix}/captain`, captainRoutes);
  app.use(`${prefix}/auth/admin`, adminAuthRoutes);
  app.use(`${prefix}/auth/super-admin`, superAdminAuthRoutes);
  app.use(`${prefix}/super-admin`, superAdminRoutes);
  app.use(`${prefix}/banners`, bannerRoutes);
  app.use(`${prefix}/upload`, uploadRoutes);
  app.use(`${prefix}/categories`, categoryRoutes);
  app.use(`${prefix}/products`, productRoutes);
  app.use(`${prefix}/sellers`, sellerRoutes);
  app.use(`${prefix}/cart`, cartRoutes);
  app.use(`${prefix}/wishlist`, wishlistRoutes);
  app.use(`${prefix}/user/addresses`, addressRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/returns`, returnRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/wallet`, walletRoutes);
  app.use(`${prefix}/membership`, membershipRoutes);
  app.use(`${prefix}/policies`, policyRoutes);
  app.use(`${prefix}/fcm-tokens`, fcmTokenRoutes);
  app.use(`${prefix}/transport/vehicles`, vehicleTypeRoutes);
  app.use(`${prefix}/transport/bookings`, transportBookingRoutes);
  app.use(`${prefix}/profile-edit-requests`, profileEditRequestRoutes);
  app.use(`${prefix}/ratings`, ratingRoutes);
  app.use(`${prefix}/transport/ratings`, ratingRoutes);
  app.use(`${prefix}/reviews`, reviewRoutes);
  app.use(`${prefix}/faqs`, faqRoutes);
  app.use(`${prefix}/support-settings`, supportRoutes);
  app.use(`${prefix}/support`, supportRoutes);
  app.use(`${prefix}/seller-registration-fee`, sellerRegistrationFeeRoutes);
  app.use(`${prefix}/captain-registration-fee`, captainRegistrationFeeRoutes);
  app.use(`${prefix}/referral`, referralRoutes);
  app.use(`${prefix}/pricing`, pricingRoutes);
  app.use(`${prefix}/repair`, repairRoutes);
  app.use(`${prefix}`, commissionRoutes);
};

app.use('', healthRoutes);
app.use('/api', healthRoutes);
registerRoutes('/api');
registerRoutes('');

// Base route
app.get('/', (req, res) => {
  res.send('Sathi Seller API Server is Running');
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 7000;

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'production'} mode on port ${PORT}`);
  const sweepUnpaidOrders = () => {
    releaseAllExpiredPaymentHolds().catch((err) => {
      console.error('[Orders] Failed to release expired payment holds:', err.message);
    });
  };
  setTimeout(sweepUnpaidOrders, 15000);
  setInterval(sweepUnpaidOrders, 5 * 60 * 1000);
});

// Connect to MongoDB Atlas
connectDB();
