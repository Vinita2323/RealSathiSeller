import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../../components/ProtectedRoute';
import PageSkeleton from '../../../components/PageSkeleton';
import { AdminProvider } from '../context/AdminContext';
import { AdminLayout } from '../layouts/AdminLayout';

const AdminLogin = lazy(() => import('../pages/AdminLogin').then(m => ({ default: m.AdminLogin })));

const AdminRoutes = () => {
  return (
    <AdminProvider>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          
          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute role="admin" redirectPath="/admin/login" />}>
            <Route path="*" element={<AdminLayout />} />
          </Route>
        </Routes>
      </Suspense>
    </AdminProvider>
  );
};

export default AdminRoutes;
