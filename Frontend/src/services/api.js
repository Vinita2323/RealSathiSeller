import axios from 'axios';

export const getBaseApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    const cleanUrl = envUrl.trim().replace(/\/$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol || 'http:';

    // Localhost, loopback, or LAN private IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocalOrLAN =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    if (isLocalOrLAN) {
      return `${protocol}//${hostname}:7000/api`;
    }

    // Production is served over HTTPS. Use the same origin so the page never
    // calls http://localhost:7000 or a raw IP.
    return `${protocol}//${hostname}/api`;
  }

  return 'http://localhost:7000/api';
};

const API = axios.create({
  baseURL: getBaseApiUrl(),
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
API.interceptors.request.use(
  (config) => {
    let token;
    const currentPath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const requestUrl = config.url || '';

    // Never attach stale authorization headers to public login/otp endpoints
    const isPublicAuthEndpoint =
      requestUrl.includes('/auth/admin/login') ||
      requestUrl.includes('/auth/super-admin/login') ||
      requestUrl.includes('/auth/seller/login') ||
      requestUrl.includes('/auth/seller/send-otp') ||
      requestUrl.includes('/auth/seller/verify-otp') ||
      requestUrl.includes('/auth/captain/login') ||
      requestUrl.includes('/auth/captain/send-otp') ||
      requestUrl.includes('/auth/user/send-otp') ||
      requestUrl.includes('/auth/user/verify-otp');

    if (isPublicAuthEndpoint) {
      if (config.headers) {
        delete config.headers.Authorization;
      }
      return config;
    }

    // Endpoint-specific token resolution
    // Browser path takes priority over request URL so /admin panel always uses admin token
    // (even when it calls /super-admin/* endpoints that are now dual-role accessible)
    if (currentPath.startsWith('/super-admin')) {
      token = localStorage.getItem('sathiseller_super_admin_token');
    } else if (currentPath.startsWith('/admin')) {
      token = localStorage.getItem('sathiseller_admin_token');
    } else if (requestUrl.includes('/super-admin')) {
      token = localStorage.getItem('sathiseller_super_admin_token');
    } else if (requestUrl.includes('/admin')) {
      token = localStorage.getItem('sathiseller_admin_token') || localStorage.getItem('sathiseller_super_admin_token');
    } else if (requestUrl.includes('/captain') || currentPath.startsWith('/captain') || currentPath.startsWith('/delivery')) {
      token = localStorage.getItem('sathiseller_captain_token');
    } else if (requestUrl.includes('/seller') || currentPath.startsWith('/seller')) {
      token = localStorage.getItem('sathiseller_seller_token');
    } else if (
      requestUrl.includes('/cart') ||
      requestUrl.includes('/wishlist') ||
      requestUrl.includes('/user/') ||
      requestUrl.includes('/auth/user')
    ) {
      token = localStorage.getItem('sathiseller_user_token');
    } else if (requestUrl.includes('/transport') || currentPath.startsWith('/transport')) {
      token =
        localStorage.getItem('sathiseller_user_token') ||
        localStorage.getItem('sathiseller_seller_token') ||
        localStorage.getItem('sathiseller_super_admin_token') ||
        localStorage.getItem('sathiseller_admin_token');
    } else {
      token =
        localStorage.getItem('sathiseller_user_token') ||
        localStorage.getItem('sathiseller_seller_token') ||
        localStorage.getItem('sathiseller_captain_token') ||
        localStorage.getItem('sathiseller_admin_token') ||
        localStorage.getItem('sathiseller_super_admin_token');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized globally per role
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const currentPath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';

      if (currentPath.startsWith('/super-admin')) {
        if (!currentPath.startsWith('/super-admin/login')) {
          localStorage.removeItem('sathiseller_super_admin_token');
          localStorage.removeItem('sathiseller_super_admin_data');
          localStorage.removeItem('sathiseller_super_admin_session');
          sessionStorage.setItem('sathiseller_super_admin_auth_expired_redirect', currentPath);
          window.location.href = '/super-admin/login';
        }
      } else if (currentPath.startsWith('/seller')) {
        // Only redirect if on a protected seller page
        if (!currentPath.startsWith('/seller/login') && !currentPath.startsWith('/seller/register') && !currentPath.startsWith('/seller/under-review') && !currentPath.startsWith('/seller/terms') && !currentPath.startsWith('/seller/privacy')) {
          localStorage.removeItem('sathiseller_seller_token');
          localStorage.removeItem('sathiseller_seller_data');
          sessionStorage.setItem('sathiseller_seller_auth_expired_redirect', currentPath);
          window.location.href = '/seller/login';
        }
      } else if (currentPath.startsWith('/captain') || currentPath.startsWith('/delivery')) {
        if (!currentPath.startsWith('/captain/login') && !currentPath.startsWith('/captain/register') && !currentPath.startsWith('/captain/under-review')) {
          localStorage.removeItem('sathiseller_captain_token');
          localStorage.removeItem('sathiseller_captain_data');
          sessionStorage.setItem('sathiseller_captain_auth_expired_redirect', currentPath);
          window.location.href = '/captain/login';
        }
      } else if (currentPath.startsWith('/admin')) {
        if (!currentPath.startsWith('/admin/login')) {
          localStorage.removeItem('sathiseller_admin_token');
          localStorage.removeItem('sathiseller_admin_data');
          localStorage.removeItem('sathiseller_admin_session');
          sessionStorage.setItem('sathiseller_admin_auth_expired_redirect', currentPath);
          window.location.href = '/admin/login';
        }
      } else {
        // Consumer / Customer
        if (!currentPath.startsWith('/login') && !currentPath.startsWith('/verify-otp') && !currentPath.startsWith('/register')) {
          localStorage.removeItem('sathiseller_user_token');
          localStorage.removeItem('sathiseller_user_data');
          sessionStorage.setItem('sathiseller_auth_expired_redirect', currentPath);
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;
