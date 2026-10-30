import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SuperAdminProvider, useSuperAdmin } from '../context/SuperAdminContext';
import { SuperAdminLayout } from '../layouts/SuperAdminLayout';
import PageSkeleton from '../../../components/PageSkeleton';

// Lazy-loaded Super Admin Pages
const SuperAdminLogin = lazy(() => import('../pages/SuperAdminLogin').then(m => ({ default: m.SuperAdminLogin })));
const SuperAdminDashboard = lazy(() => import('../pages/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const SuperAdminTransactions = lazy(() => import('../pages/SuperAdminTransactions').then(m => ({ default: m.SuperAdminTransactions })));
const SuperAdminPayments = lazy(() => import('../pages/SuperAdminPayments').then(m => ({ default: m.SuperAdminPayments })));
const SuperAdminSellerSettlements = lazy(() => import('../pages/SuperAdminSellerSettlements').then(m => ({ default: m.SuperAdminSellerSettlements })));
const SuperAdminCaptainSettlements = lazy(() => import('../pages/SuperAdminCaptainSettlements').then(m => ({ default: m.SuperAdminCaptainSettlements })));
const SuperAdminPayouts = lazy(() => import('../pages/SuperAdminPayouts').then(m => ({ default: m.SuperAdminPayouts })));
const SuperAdminRefunds = lazy(() => import('../pages/SuperAdminRefunds').then(m => ({ default: m.SuperAdminRefunds })));
const SuperAdminCommissions = lazy(() => import('../pages/SuperAdminCommissions').then(m => ({ default: m.SuperAdminCommissions })));
const SuperAdminAdjustments = lazy(() => import('../pages/SuperAdminAdjustments').then(m => ({ default: m.SuperAdminAdjustments })));
const SuperAdminReports = lazy(() => import('../pages/SuperAdminReports').then(m => ({ default: m.SuperAdminReports })));
const SuperAdminAuditLogs = lazy(() => import('../pages/SuperAdminAuditLogs').then(m => ({ default: m.SuperAdminAuditLogs })));

// Protected Route Component for Super Admin — cookie session must be validated
const SuperAdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, sessionChecking } = useSuperAdmin();
  if (sessionChecking) {
    return <PageSkeleton />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/super-admin/login" replace />;
  }
  return children;
};

const SuperAdminRoutesContent = () => {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<SuperAdminLogin />} />

        {/* Protected Routes */}
        <Route
          element={
            <SuperAdminProtectedRoute>
              <SuperAdminLayout />
            </SuperAdminProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/transactions" element={<SuperAdminTransactions />} />
          <Route path="/payments" element={<SuperAdminPayments />} />
          <Route path="/seller-settlements" element={<SuperAdminSellerSettlements />} />
          <Route path="/captain-settlements" element={<SuperAdminCaptainSettlements />} />
          <Route path="/payouts" element={<SuperAdminPayouts />} />
          <Route path="/payouts/sellers" element={<SuperAdminPayouts />} />
          <Route path="/payouts/captains" element={<SuperAdminPayouts />} />
          <Route path="/refunds" element={<SuperAdminRefunds />} />
          <Route path="/commissions" element={<SuperAdminCommissions />} />
          <Route path="/financial-adjustments" element={<SuperAdminAdjustments />} />
          <Route path="/reports" element={<SuperAdminReports />} />
          <Route path="/audit-logs" element={<SuperAdminAuditLogs />} />
          <Route path="*" element={<Navigate to="/super-admin/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

const SuperAdminRoutes = () => {
  return (
    <SuperAdminProvider>
      <SuperAdminRoutesContent />
    </SuperAdminProvider>
  );
};

export default SuperAdminRoutes;
