import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clearStoredUserLocation } from '../utils/userLocation';
import { authService } from '../services/authService';
import API from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [adminSessionValid, setAdminSessionValid] = useState(false);
  const [superAdminSessionValid, setSuperAdminSessionValid] = useState(false);

  const computeRoleAndAuth = useCallback((preferredRole = null) => {
    try {
      const userToken = localStorage.getItem('sathiseller_user_token');
      const sellerToken = localStorage.getItem('sathiseller_seller_token');
      const captainToken = localStorage.getItem('sathiseller_captain_token');
      const adminSession = localStorage.getItem('sathiseller_admin_session') === '1' || adminSessionValid;
      const superAdminSession =
        localStorage.getItem('sathiseller_super_admin_session') === '1' || superAdminSessionValid;

      if (preferredRole === 'super_admin' && (superAdminSession || superAdminSessionValid)) {
        return { isAuth: true, role: 'super_admin' };
      }
      if (preferredRole === 'admin' && (adminSession || adminSessionValid || superAdminSession)) {
        return { isAuth: true, role: 'admin' };
      }
      if (preferredRole === 'seller' && sellerToken) return { isAuth: true, role: 'seller' };
      if (preferredRole === 'captain' && captainToken) return { isAuth: true, role: 'captain' };
      if (preferredRole === 'user' && userToken) return { isAuth: true, role: 'user' };

      const path = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
      if (path.startsWith('/super-admin') && (superAdminSession || superAdminSessionValid)) {
        return { isAuth: true, role: 'super_admin' };
      }
      if (path.startsWith('/admin') && (adminSession || adminSessionValid || superAdminSession)) {
        return { isAuth: true, role: 'admin' };
      }
      if (path.startsWith('/seller') && sellerToken) {
        return { isAuth: true, role: 'seller' };
      }
      if ((path.startsWith('/captain') || path.startsWith('/delivery')) && captainToken) {
        return { isAuth: true, role: 'captain' };
      }

      if (userToken) return { isAuth: true, role: 'user' };
      if (adminSession || adminSessionValid) return { isAuth: true, role: 'admin' };
      if (superAdminSession || superAdminSessionValid) return { isAuth: true, role: 'super_admin' };
      if (sellerToken) return { isAuth: true, role: 'seller' };
      if (captainToken) return { isAuth: true, role: 'captain' };

      return { isAuth: false, role: null };
    } catch (e) {
      console.error('[AuthContext] computeRoleAndAuth error:', e);
      return { isAuth: false, role: null };
    }
  }, [adminSessionValid, superAdminSessionValid]);

  const isRoleAuthenticated = useCallback((role) => {
    try {
      if (!role || role === 'user') {
        return !!localStorage.getItem('sathiseller_user_token');
      }
      if (role === 'admin') {
        // Provisional UI access after a successful login sets sathiseller_admin_session.
        // Cookie is still required for every admin API; invalid cookies are cleared on init/401.
        return (
          adminSessionValid === true ||
          localStorage.getItem('sathiseller_admin_session') === '1'
        );
      }
      if (role === 'super_admin') {
        return (
          superAdminSessionValid === true ||
          localStorage.getItem('sathiseller_super_admin_session') === '1'
        );
      }
      if (role === 'seller') {
        return !!localStorage.getItem('sathiseller_seller_token');
      }
      if (role === 'captain') {
        return !!localStorage.getItem('sathiseller_captain_token');
      }
      return false;
    } catch (e) {
      return false;
    }
  }, [adminSessionValid, superAdminSessionValid]);

  const syncAuthFromStorage = useCallback((explicitRole = null) => {
    const { isAuth, role } = computeRoleAndAuth(explicitRole);
    setIsAuthenticated(isAuth);
    setUserRole(role);
  }, [computeRoleAndAuth]);

  // Initialize auth on app load — admin/super-admin must be validated by the backend.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';

      if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
        try {
          const res = await authService.getAdminProfile();
          if (!cancelled && res?.success && res.admin) {
            setAdminSessionValid(true);
            setIsAuthenticated(true);
            setUserRole('admin');
          } else if (!cancelled) {
            setAdminSessionValid(false);
            localStorage.removeItem('sathiseller_admin_session');
            localStorage.removeItem('sathiseller_admin_token');
          }
        } catch (e) {
          if (!cancelled) {
            setAdminSessionValid(false);
            localStorage.removeItem('sathiseller_admin_session');
            localStorage.removeItem('sathiseller_admin_token');
            localStorage.removeItem('sathiseller_admin_data');
          }
        }
      } else if (path.startsWith('/super-admin') && !path.startsWith('/super-admin/login')) {
        try {
          const res = await API.get('/auth/super-admin/me');
          if (!cancelled && res.data?.success && res.data.superAdmin) {
            setSuperAdminSessionValid(true);
            setIsAuthenticated(true);
            setUserRole('super_admin');
            localStorage.setItem('sathiseller_super_admin_session', '1');
            localStorage.setItem('sathiseller_super_admin_data', JSON.stringify(res.data.superAdmin));
          } else if (!cancelled) {
            setSuperAdminSessionValid(false);
            localStorage.removeItem('sathiseller_super_admin_session');
            localStorage.removeItem('sathiseller_super_admin_token');
          }
        } catch (e) {
          if (!cancelled) {
            setSuperAdminSessionValid(false);
            localStorage.removeItem('sathiseller_super_admin_session');
            localStorage.removeItem('sathiseller_super_admin_token');
            localStorage.removeItem('sathiseller_super_admin_data');
          }
        }
      } else {
        syncAuthFromStorage();
      }

      if (!cancelled) setIsAuthInitializing(false);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [syncAuthFromStorage]);

  const logout = (role = 'user') => {
    if (role === 'user' || !role) {
      localStorage.removeItem('sathiseller_user_token');
      localStorage.removeItem('sathiseller_user_data');
      localStorage.removeItem('sathiseller_user_name');
      localStorage.removeItem('sathiseller_user_email');
      localStorage.removeItem('sathiseller_user_phone');
      clearStoredUserLocation();
    } else if (role === 'seller') {
      localStorage.removeItem('sathiseller_seller_token');
      localStorage.removeItem('sathiseller_seller_data');
      localStorage.removeItem('sathiseller_seller_requires_membership');
    } else if (role === 'captain') {
      localStorage.removeItem('sathiseller_captain_token');
      localStorage.removeItem('sathiseller_captain_data');
    } else if (role === 'admin') {
      authService.adminLogout?.().catch(() => {});
      localStorage.removeItem('sathiseller_admin_token');
      localStorage.removeItem('sathiseller_admin_data');
      localStorage.removeItem('sathiseller_admin_session');
      setAdminSessionValid(false);
    } else if (role === 'super_admin') {
      API.post('/auth/super-admin/logout').catch(() => {});
      localStorage.removeItem('sathiseller_super_admin_token');
      localStorage.removeItem('sathiseller_super_admin_data');
      localStorage.removeItem('sathiseller_super_admin_session');
      setSuperAdminSessionValid(false);
    }

    syncAuthFromStorage();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthInitializing,
        userRole,
        isRoleAuthenticated,
        logout,
        syncAuthFromStorage,
        adminSessionValid,
        setAdminSessionValid,
        superAdminSessionValid,
        setSuperAdminSessionValid,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
