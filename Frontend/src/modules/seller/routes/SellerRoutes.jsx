import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../../../components/ProtectedRoute';
import PageSkeleton from '../../../components/PageSkeleton';
import SellerLayout from '../components/layout/SellerLayout';
import SellerMembershipGate from '../components/SellerMembershipGate';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const SellerLogin = lazy(() => import('../pages/auth/SellerLogin'));
const SellerRegister = lazy(() => import('../pages/auth/SellerRegister'));
const SellerUnderReview = lazy(() => import('../pages/auth/SellerUnderReview'));
const Products = lazy(() => import('../pages/Products'));
const AddProduct = lazy(() => import('../pages/AddProduct'));
const Orders = lazy(() => import('../pages/Orders'));
const Inventory = lazy(() => import('../pages/Inventory'));
const Dispatch = lazy(() => import('../pages/Dispatch'));
const Customers = lazy(() => import('../pages/Customers'));
const Reports = lazy(() => import('../pages/Reports'));
const Settings = lazy(() => import('../pages/Settings'));
const Wallet = lazy(() => import('../pages/Wallet'));
const Return = lazy(() => import('../pages/Return'));
const SellerMembership = lazy(() => import('../pages/SellerMembership'));
const SellerPolicyPage = lazy(() => import('../pages/SellerPolicyPage'));
const SellerSupport = lazy(() => import('../pages/SellerSupport'));
const SellerReferral = lazy(() => import('../pages/SellerReferral'));

const SellerRoutes = () => {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Public Auth & Policy Routes */}
        <Route path="login" element={<SellerLogin />} />
        <Route path="register" element={<SellerRegister />} />
        <Route path="under-review" element={<SellerUnderReview />} />
        <Route path="terms" element={<SellerPolicyPage />} />
        <Route path="privacy" element={<SellerPolicyPage />} />
        <Route path="support" element={<SellerSupport />} />
        <Route path="faqs" element={<SellerSupport />} />
        
        {/* Protected Layout Routes — require active membership for selling panel */}
        <Route element={<ProtectedRoute role="seller" redirectPath="/seller/login" />}>
          <Route element={<SellerMembershipGate />}>
          <Route element={<SellerLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            {/* Category & Subcategory routes disabled for Sellers in Multi-vendor setup */}
            <Route path="category" element={<Navigate to="/seller/dashboard" replace />} />
            <Route path="categories" element={<Navigate to="/seller/dashboard" replace />} />
            <Route path="subcategory" element={<Navigate to="/seller/dashboard" replace />} />
            <Route path="subcategories" element={<Navigate to="/seller/dashboard" replace />} />
            
            {/* Product Group */}
            <Route path="product/add" element={<AddProduct />} />
            <Route path="products/add" element={<AddProduct />} />
            <Route path="product/edit/:id" element={<AddProduct />} />
            <Route path="products/edit/:id" element={<AddProduct />} />
            <Route path="taxes" element={<Navigate to="/seller/dashboard" replace />} />
            <Route path="products" element={<Products />} />
            <Route path="product/list" element={<Products />} />
            <Route path="stock-management" element={<Inventory />} />
            <Route path="inventory" element={<Inventory />} />

            {/* Finance & CRM */}
            <Route path="wallet" element={<Wallet />} />
            <Route path="refer-earn" element={<SellerReferral />} />
            <Route path="referral" element={<SellerReferral />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/sales" element={<Reports />} />
            <Route path="return" element={<Return />} />
            <Route path="returns" element={<Return />} />
            
            {/* Other modules */}
            <Route path="dispatch" element={<Dispatch />} />
            <Route path="customers" element={<Customers />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<SellerSupport />} />
            
            {/* Redirect root to dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
          </Route>
        </Route>

        {/* Membership Route — protected (requires seller token) but full-screen (outside SellerLayout) */}
        <Route element={<ProtectedRoute role="seller" redirectPath="/seller/login" />}>
          <Route path="membership" element={<SellerMembership />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default SellerRoutes;
