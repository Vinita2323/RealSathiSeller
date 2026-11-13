import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from '../../../components/ProtectedRoute';
import PageSkeleton from '../../../components/PageSkeleton';
import Home from '../pages/Home';
import BottomNav from '../components/BottomNav';
import UserDesktopHeader from '../components/UserDesktopHeader';

const Categories = lazy(() => import('../pages/Categories'));
const Cart = lazy(() => import('../pages/Cart'));
const Checkout = lazy(() => import('../pages/Checkout'));
const Payment = lazy(() => import('../pages/Payment'));
const TrackOrder = lazy(() => import('../pages/TrackOrder'));
const Orders = lazy(() => import('../pages/Orders'));
const OrderHistory = lazy(() => import('../pages/OrderHistory'));
const Profile = lazy(() => import('../pages/Profile'));
const Login = lazy(() => import('../pages/Login'));
const VerifyOtp = lazy(() => import('../pages/VerifyOtp'));
const ProductDetails = lazy(() => import('../pages/ProductDetails'));
const Wishlist = lazy(() => import('../pages/Wishlist'));
const FlashSale = lazy(() => import('../pages/FlashSale'));
const BestSelling = lazy(() => import('../pages/BestSelling'));
const AllSellers = lazy(() => import('../pages/AllSellers'));
const SellerStore = lazy(() => import('../pages/SellerStore'));
const LocationSelectionPage = lazy(() => import('../pages/LocationSelectionPage'));
const Notifications = lazy(() => import('../pages/Notifications'));
const AccountInfo = lazy(() => import('../pages/AccountInfo'));
const SavedAddresses = lazy(() => import('../pages/SavedAddresses'));
const Wallet = lazy(() => import('../pages/Wallet'));
const Terms = lazy(() => import('../pages/Terms'));
const Faqs = lazy(() => import('../pages/Faqs'));
const HelpSupport = lazy(() => import('../pages/HelpSupport'));
const RepairHome = lazy(() => import('../pages/repair/RepairHome'));
const RepairBook = lazy(() => import('../pages/repair/RepairBook'));
const RepairTrack = lazy(() => import('../pages/repair/RepairTrack'));

const UserRoutes = () => {
  const location = useLocation();
  const isCart = location.pathname === '/cart';
  const isCheckout = location.pathname === '/checkout';
  const isPayment = location.pathname === '/payment';
  const isTrackOrder = location.pathname === '/track-order';
  const isOrderHistory = location.pathname === '/order-history';
  const isProfile = location.pathname === '/profile';
  const isLogin = location.pathname === '/login';
  const isVerifyOtp = location.pathname === '/verify-otp';
  const isProductDetails = location.pathname.startsWith('/product');
  const isSellerStore = location.pathname.startsWith('/store');
  const isWishlist = location.pathname === '/wishlist';
  const isFlashSale = location.pathname === '/flash-sale';
  const isNotifications = location.pathname === '/notifications';
  const isLocation = location.pathname === '/location';
  const isPlaceholder = ['/account-information', '/saved-addresses', '/wallet', '/terms', '/privacy', '/faqs', '/support'].includes(location.pathname);
  
  const isRepairFlow = location.pathname.startsWith('/repair/');

  const hideBottomNav = isRepairFlow || isCart || isCheckout || isPayment || isTrackOrder || isOrderHistory || isProfile || isLogin || isVerifyOtp || isProductDetails || isSellerStore || isWishlist || isFlashSale || isNotifications || isLocation || isPlaceholder;

  return (
    <>
      {!isLogin && !isVerifyOtp && <UserDesktopHeader />}
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public Browsing Routes (Accessible to Guests) */}
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/sellers" element={<AllSellers />} />
          <Route path="/store/:sellerId" element={<SellerStore />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/flash-sale" element={<FlashSale />} />
          <Route path="/bestseller" element={<BestSelling />} />
          <Route path="/location" element={<LocationSelectionPage />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/terms" element={<Navigate to="/privacy" replace />} />
          <Route path="/privacy" element={<Terms />} />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="/support" element={<HelpSupport />} />

          {/* Protected User Routes (Requires User Authentication) */}
          <Route element={<ProtectedRoute role="user" />}>
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/track-order" element={<TrackOrder />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/order-history" element={<OrderHistory />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/account-information" element={<AccountInfo />} />
            <Route path="/saved-addresses" element={<SavedAddresses />} />
            <Route path="/wallet" element={<Wallet />} />
            {/* Repair & Services (separate module) */}
            <Route path="/repair" element={<RepairHome />} />
            <Route path="/repair/book" element={<RepairBook />} />
            <Route path="/repair/booking/:id" element={<RepairTrack />} />
          </Route>
        </Routes>
      </Suspense>
      
      {/* Shared Navigation */}
      {!hideBottomNav && <BottomNav />}
    </>
  );
};

export default UserRoutes;
