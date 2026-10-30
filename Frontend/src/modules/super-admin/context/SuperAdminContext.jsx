import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const SuperAdminContext = createContext();

export const SuperAdminProvider = ({ children }) => {
  const navigate = useNavigate();
  const { setSuperAdminSessionValid } = useAuth();

  const [sessionValid, setSessionValid] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);

  const [superAdmin, setSuperAdmin] = useState(() => {
    try {
      const stored = localStorage.getItem('sathiseller_super_admin_data');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      if (path.startsWith('/super-admin/login')) {
        if (!cancelled) setSessionChecking(false);
        return;
      }
      try {
        const res = await API.get('/auth/super-admin/me');
        if (!cancelled && res.data?.success && res.data.superAdmin) {
          setSuperAdmin(res.data.superAdmin);
          setSessionValid(true);
          setSuperAdminSessionValid?.(true);
          localStorage.setItem('sathiseller_super_admin_session', '1');
          localStorage.setItem('sathiseller_super_admin_data', JSON.stringify(res.data.superAdmin));
          localStorage.removeItem('sathiseller_super_admin_token');
        } else if (!cancelled) {
          setSessionValid(false);
          setSuperAdminSessionValid?.(false);
        }
      } catch (e) {
        if (!cancelled) {
          setSessionValid(false);
          setSuperAdminSessionValid?.(false);
          localStorage.removeItem('sathiseller_super_admin_token');
          localStorage.removeItem('sathiseller_super_admin_session');
        }
      } finally {
        if (!cancelled) setSessionChecking(false);
      }
    };
    validate();
    return () => {
      cancelled = true;
    };
  }, [setSuperAdminSessionValid]);

  const login = useCallback((adminData) => {
    localStorage.removeItem('sathiseller_super_admin_token');
    localStorage.setItem('sathiseller_super_admin_data', JSON.stringify(adminData));
    localStorage.setItem('sathiseller_super_admin_session', '1');
    setSuperAdmin(adminData);
    setSessionValid(true);
    setSuperAdminSessionValid?.(true);
  }, [setSuperAdminSessionValid]);

  const logout = useCallback(async () => {
    try {
      await API.post('/auth/super-admin/logout');
    } catch (e) {}
    localStorage.removeItem('sathiseller_super_admin_token');
    localStorage.removeItem('sathiseller_super_admin_data');
    localStorage.removeItem('sathiseller_super_admin_session');
    setSuperAdmin(null);
    setSessionValid(false);
    setSuperAdminSessionValid?.(false);
    navigate('/super-admin/login');
  }, [navigate, setSuperAdminSessionValid]);

  return (
    <SuperAdminContext.Provider
      value={{
        token: sessionValid ? 'cookie' : null,
        superAdmin,
        sidebarOpen,
        setSidebarOpen,
        login,
        logout,
        isAuthenticated: sessionValid,
        sessionChecking,
      }}
    >
      {children}
    </SuperAdminContext.Provider>
  );
};

export const useSuperAdmin = () => {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error('useSuperAdmin must be used within a SuperAdminProvider');
  }
  return context;
};
