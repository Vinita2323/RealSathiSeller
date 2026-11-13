import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import TechnicianLogin from '../pages/TechnicianLogin';
import TechnicianJobs from '../pages/TechnicianJobs';
import TechnicianJob from '../pages/TechnicianJob';

// The technician panel has its own login + token (technicians are created by admin),
// so it uses a tiny local guard instead of the shared role-based ProtectedRoute.
const TechnicianGuard = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sathiseller_technician_token') : null;
  return token ? <Outlet /> : <Navigate to="/technician/login" replace />;
};

const TechnicianRoutes = () => (
  <Routes>
    <Route path="/login" element={<TechnicianLogin />} />
    <Route element={<TechnicianGuard />}>
      <Route path="/jobs" element={<TechnicianJobs />} />
      <Route path="/jobs/:id" element={<TechnicianJob />} />
    </Route>
    <Route path="*" element={<Navigate to="/technician/jobs" replace />} />
  </Routes>
);

export default TechnicianRoutes;
