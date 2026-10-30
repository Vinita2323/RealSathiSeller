import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageSkeleton from './PageSkeleton';

const ProtectedRoute = ({ role, redirectPath }) => {
  const { isAuthInitializing, isRoleAuthenticated } = useAuth();

  let defaultRedirect = '/login';
  if (role === 'seller') {
    defaultRedirect = '/seller/login';
  } else if (role === 'captain') {
    defaultRedirect = '/captain/login';
  } else if (role === 'admin') {
    defaultRedirect = '/admin/login';
  } else if (role === 'super_admin') {
    defaultRedirect = '/super-admin/login';
  }

  // While auth is initializing, show loading screen (don't redirect yet)
  if (isAuthInitializing) {
    return <PageSkeleton />;
  }

  // Check role-specific authentication
  const isAuthForRole = isRoleAuthenticated(role);

  if (!isAuthForRole) {
    return <Navigate to={redirectPath || defaultRedirect} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

