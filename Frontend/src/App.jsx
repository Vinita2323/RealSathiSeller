import React, { useState, lazy, Suspense } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import SplashScreen from './modules/user/pages/SplashScreen';
import PageSkeleton from './components/PageSkeleton';
import ErrorBoundary from './components/ErrorBoundary';

const UserRoutes = lazy(() => import('./modules/user/routes/UserRoutes'));
const DeliveryRoutes = lazy(() => import('./modules/delivery/routes/DeliveryRoutes'));
const SellerRoutes = lazy(() => import('./modules/seller/routes/SellerRoutes'));
const AdminRoutes = lazy(() => import('./modules/admin/routes/AdminRoutes'));
const SuperAdminRoutes = lazy(() => import('./modules/super-admin/routes/SuperAdminRoutes'));
const TechnicianRoutes = lazy(() => import('./modules/repair-technician/routes/TechnicianRoutes'));

import { CartProvider } from './modules/user/context/CartContext';
import { WishlistProvider } from './modules/user/context/WishlistContext';
import { OrderProvider } from './modules/user/context/OrderContext';
import { NotificationProvider } from './modules/user/context/NotificationContext';

import { LocationProvider } from './context/LocationContext';
import { AuthProvider } from './context/AuthContext';
import { initializePushNotifications, setupForegroundNotificationHandler } from './services/pushNotificationService';

function App() {
  const location = useLocation();
  const isCaptainRoute = location.pathname.startsWith('/captain');
  const isSellerRoute = location.pathname.startsWith('/seller');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isSuperAdminRoute = location.pathname.startsWith('/super-admin');

  // Initialize Firebase Push Notifications on App mount (SOP Standard)
  React.useEffect(() => {
    initializePushNotifications();

    setupForegroundNotificationHandler((payload) => {
      console.log('🔔 [App Notification Received]:', payload);
      // Optional direct navigation if deep link provided
      if (payload?.data?.link) {
        // Handled or displayed via in-app toast
      }
    });
  }, []);
  
  // Bypass splash screen if accessing any specific sub-route or if splash has already been dismissed
  const isSpecificRoute = location.pathname !== '/' && location.pathname !== '';
  const hasSeenSplash = typeof window !== 'undefined' && sessionStorage.getItem('sathiseller_splash_seen') === 'true';
  const bypassSplash = isCaptainRoute || isSellerRoute || isAdminRoute || isSuperAdminRoute || isSpecificRoute || hasSeenSplash;

  const [showSplash, setShowSplash] = useState(!bypassSplash);

  const handleGetStarted = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sathiseller_splash_seen', 'true');
    }
    setShowSplash(false);
  };

  if (showSplash && !bypassSplash) {
    return <SplashScreen onGetStarted={handleGetStarted} />;
  }

  return (
    <div className="App">
      <ErrorBoundary>
        <AuthProvider>
          <LocationProvider>
            <NotificationProvider>
              <WishlistProvider>
                <CartProvider>
                  <OrderProvider>
                    <Suspense fallback={<PageSkeleton />}>
                      <Routes>
                        <Route path="/captain/*" element={<DeliveryRoutes />} />
                        <Route path="/seller/*" element={<SellerRoutes />} />
                        <Route path="/admin/*" element={<AdminRoutes />} />
                        <Route path="/super-admin/*" element={<SuperAdminRoutes />} />
                        <Route path="/technician/*" element={<TechnicianRoutes />} />
                        <Route path="/*" element={<UserRoutes />} />
                      </Routes>
                    </Suspense>
                  </OrderProvider>
                </CartProvider>
              </WishlistProvider>
            </NotificationProvider>
          </LocationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </div>
  );
}

export default App;
