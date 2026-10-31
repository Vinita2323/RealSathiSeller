import API from './api';
import { registerFCMToken, removeFCMToken } from './pushNotificationService';
import { disconnectUserSocket } from './userSocket';
import { applySavedAddressesAsDeliveryLocation, clearStoredUserLocation } from '../utils/userLocation';

const saveCaptainAuthSession = (token, captain) => {
  if (token) {
    try {
      localStorage.setItem('sathiseller_captain_token', token);
    } catch (e) {
      // Storage quota reached: remove bulky items and retry
      try {
        localStorage.removeItem('sathiseller_captain_data');
        localStorage.setItem('sathiseller_captain_token', token);
      } catch (innerErr) {
        console.error('Failed to set captain token in localStorage:', innerErr);
      }
    }
  }

  if (captain) {
    try {
      // Strip any heavy base64 strings or sensitive props
      const safeData = { ...captain };
      delete safeData.documents;
      delete safeData.password;
      delete safeData.otp;
      delete safeData.otpExpiry;

      localStorage.setItem('sathiseller_captain_data', JSON.stringify(safeData));
      if (safeData.name) localStorage.setItem('sathiseller_captain_name', safeData.name);
      if (safeData.phone) localStorage.setItem('sathiseller_captain_phone', safeData.phone);
    } catch (err) {
      console.warn('LocalStorage quota reached when saving captain data; falling back to minimal record:', err);
      try {
        const minimalData = {
          _id: captain._id || captain.id,
          name: captain.name,
          phone: captain.phone,
          accountStatus: captain.accountStatus,
          status: captain.status,
          role: captain.role || 'captain',
        };
        localStorage.setItem('sathiseller_captain_data', JSON.stringify(minimalData));
        if (captain.name) localStorage.setItem('sathiseller_captain_name', captain.name);
        if (captain.phone) localStorage.setItem('sathiseller_captain_phone', captain.phone);
      } catch (fallbackErr) {
        console.error('Failed to store minimal captain data in localStorage:', fallbackErr);
      }
    }
  }
};

export const authService = {
  // User Auth
  sendUserOtp: async (phone) => {
    const response = await API.post('/auth/user/send-otp', { phone });
    return response.data;
  },

  verifyUserOtp: async (phone, otp) => {
    const response = await API.post('/auth/user/verify-otp', { phone, otp });
    if (response.data.token) {
      localStorage.setItem('sathiseller_user_token', response.data.token);
      localStorage.setItem('sathiseller_user_data', JSON.stringify(response.data.user));
      const uName = response.data.user?.name || response.data.user?.phone || 'User';
      localStorage.setItem('sathiseller_user_name', uName);
      if (response.data.user?.email) {
        localStorage.setItem('sathiseller_user_email', response.data.user.email);
      }
      if (response.data.user?.phone) {
        localStorage.setItem('sathiseller_user_phone', response.data.user.phone);
      }
      if (response.data.user?.addresses && Array.isArray(response.data.user.addresses)) {
        localStorage.setItem('sathiseller_saved_addresses', JSON.stringify(response.data.user.addresses));
        if (response.data.user.addresses.length > 0) {
          applySavedAddressesAsDeliveryLocation(response.data.user.addresses);
        } else {
          clearStoredUserLocation();
        }
      } else {
        clearStoredUserLocation();
      }
      // Register FCM Push Token on login (SOP Step 7)
      registerFCMToken(true, 'user').catch(() => {});
    }
    return response.data;
  },

  // Seller Auth
  registerSeller: async (formData) => {
    const response = await API.post('/auth/seller/register', formData);
    return response.data;
  },

  sendSellerOtp: async (phone, options = {}) => {
    const payload = { phone };
    if (options.purpose) payload.purpose = options.purpose;
    const response = await API.post('/auth/seller/send-otp', payload);
    return response.data;
  },

  verifySellerOtp: async (phone, otp) => {
    try {
      const response = await API.post('/auth/seller/verify-otp', { phone, otp });
      if (response.data.token) {
        localStorage.setItem('sathiseller_seller_token', response.data.token);
        localStorage.setItem('sathiseller_seller_data', JSON.stringify(response.data.seller));
        // Register FCM Push Token on login (SOP Step 7)
        registerFCMToken(true, 'seller').catch(() => {});
      }
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  sellerLogin: async (phone, password) => {
    const response = await API.post('/auth/seller/login', { phone, password });
    if (response.data.token) {
      localStorage.setItem('sathiseller_seller_token', response.data.token);
      localStorage.setItem('sathiseller_seller_data', JSON.stringify(response.data.seller));
      if (response.data.requiresMembership) {
        localStorage.setItem('sathiseller_seller_requires_membership', '1');
      } else {
        localStorage.removeItem('sathiseller_seller_requires_membership');
      }
      registerFCMToken(true, 'seller').catch(() => {});
    }
    return response.data;
  },

  sellerResetPassword: async (phone, otp, newPassword) => {
    const response = await API.post('/auth/seller/reset-password', { phone, otp, newPassword });
    if (response.data.token) {
      localStorage.setItem('sathiseller_seller_token', response.data.token);
      localStorage.setItem('sathiseller_seller_data', JSON.stringify(response.data.seller));
      registerFCMToken(true, 'seller').catch(() => {});
    }
    return response.data;
  },

  getSellerProfile: async () => {
    const response = await API.get('/auth/seller/profile');
    if (response.data.seller) {
      localStorage.setItem('sathiseller_seller_data', JSON.stringify(response.data.seller));
    }
    return response.data;
  },

  updateSellerProfile: async (profileData) => {
    const response = await API.put('/auth/seller/profile', profileData);
    if (response.data.seller) {
      localStorage.setItem('sathiseller_seller_data', JSON.stringify(response.data.seller));
    }
    return response.data;
  },

  updateSellerOnlineStatus: async (isOnline) => {
    const response = await API.put('/auth/seller/status', { isOnline });
    if (response.data.seller) {
      localStorage.setItem('sathiseller_seller_data', JSON.stringify(response.data.seller));
    }
    try {
      window.dispatchEvent(new CustomEvent('seller_status_changed', { detail: { isOnline: response.data.isOnline } }));
    } catch (e) {}
    return response.data;
  },


  // Captain Auth
  registerCaptain: async (formData) => {
    const response = await API.post('/auth/captain/register', formData);
    return response.data;
  },

  sendCaptainOtp: async (phone, options = {}) => {
    const payload = { phone };
    if (options.purpose) payload.purpose = options.purpose;
    const response = await API.post('/auth/captain/send-otp', payload);
    return response.data;
  },

  verifyCaptainOtp: async (phone, otp) => {
    try {
      const response = await API.post('/auth/captain/verify-otp', { phone, otp });
      if (response.data.token) {
        saveCaptainAuthSession(response.data.token, response.data.captain);
        // Register FCM Push Token on login (SOP Step 7)
        registerFCMToken(true, 'captain').catch(() => {});
      }
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  captainLogin: async (phone, password) => {
    const response = await API.post('/auth/captain/login', { phone, password });
    if (response.data.token) {
      saveCaptainAuthSession(response.data.token, response.data.captain);
      registerFCMToken(true, 'captain').catch(() => {});
    }
    return response.data;
  },

  captainResetPassword: async (phone, otp, newPassword) => {
    const response = await API.post('/auth/captain/reset-password', { phone, otp, newPassword });
    if (response.data.token) {
      saveCaptainAuthSession(response.data.token, response.data.captain);
      registerFCMToken(true, 'captain').catch(() => {});
    }
    return response.data;
  },

  // Admin Auth — session is HttpOnly cookie; never store the password or JWT in localStorage.
  adminLogin: async (email, password, rememberMe = false) => {
    const response = await API.post('/auth/admin/login', { email, password, rememberMe: Boolean(rememberMe) });
    if (response.data?.success && response.data.admin) {
      localStorage.removeItem('sathiseller_admin_token');
      localStorage.setItem('sathiseller_admin_data', JSON.stringify(response.data.admin));
      localStorage.setItem('sathiseller_admin_session', '1');
      registerFCMToken(true, 'admin').catch(() => {});
    }
    return response.data;
  },

  getAdminProfile: async () => {
    const response = await API.get('/auth/admin/profile');
    if (response.data && response.data.admin) {
      localStorage.setItem('sathiseller_admin_data', JSON.stringify(response.data.admin));
      localStorage.setItem('sathiseller_admin_session', '1');
      try {
        window.dispatchEvent(new Event('admin_profile_updated'));
      } catch (e) {}
    }
    return response.data;
  },

  updateAdminProfile: async (profileData) => {
    const response = await API.put('/auth/admin/profile', profileData);
    if (response.data && response.data.admin) {
      localStorage.setItem('sathiseller_admin_data', JSON.stringify(response.data.admin));
      localStorage.removeItem('sathiseller_admin_token');
      try {
        window.dispatchEvent(new Event('admin_profile_updated'));
      } catch (e) {}
    }
    return response.data;
  },

  adminLogout: async () => {
    try {
      await API.post('/auth/admin/logout');
    } catch (e) {}
    removeFCMToken('admin').catch(() => {});
    localStorage.removeItem('sathiseller_admin_token');
    localStorage.removeItem('sathiseller_admin_data');
    localStorage.removeItem('sathiseller_admin_session');
  },

  // User in-app notifications
  getUserNotifications: async () => {
    const response = await API.get('/user/notifications');
    return response.data;
  },

  getUserUnreadNotificationCount: async () => {
    const response = await API.get('/user/notifications/unread-count');
    return response.data;
  },

  markUserNotificationRead: async (id) => {
    const response = await API.put(`/user/notifications/${id}/read`);
    return response.data;
  },

  markAllUserNotificationsRead: async () => {
    const response = await API.put('/user/notifications/read-all');
    return response.data;
  },

  // Logout utility
  logout: (role) => {
    removeFCMToken(role).catch(() => {});

    if (role === 'user') {
      disconnectUserSocket();
      localStorage.removeItem('sathiseller_user_token');
      localStorage.removeItem('sathiseller_user_data');
      localStorage.removeItem('sathiseller_user_name');
      localStorage.removeItem('sathiseller_user_email');
      localStorage.removeItem('sathiseller_user_phone');
      localStorage.removeItem('sathiseller_user_dob');
      localStorage.removeItem('sathiseller_saved_addresses');
      localStorage.removeItem('sathiseller_selected_checkout_address');
      localStorage.removeItem('sathiseller_pending_action');
      clearStoredUserLocation();
      sessionStorage.removeItem('sathiseller_auth_expired_redirect');
    } else if (role === 'seller') {
      localStorage.removeItem('sathiseller_seller_token');
      localStorage.removeItem('sathiseller_seller_data');
      localStorage.removeItem('sathiseller_seller_requires_membership');
    } else if (role === 'captain') {
      localStorage.removeItem('sathiseller_captain_token');
      localStorage.removeItem('sathiseller_captain_data');
    } else if (role === 'admin') {
      API.post('/auth/admin/logout').catch(() => {});
      localStorage.removeItem('sathiseller_admin_token');
      localStorage.removeItem('sathiseller_admin_data');
      localStorage.removeItem('sathiseller_admin_session');
    } else if (role === 'super_admin') {
      API.post('/auth/super-admin/logout').catch(() => {});
      localStorage.removeItem('sathiseller_super_admin_token');
      localStorage.removeItem('sathiseller_super_admin_data');
      localStorage.removeItem('sathiseller_super_admin_session');
    }
  },
};

// Client-side in-memory cache and request deduplication for frequently fetched static data
const clientMemCache = {
  banners: { data: null, timestamp: 0, promise: null },
  categories: { data: null, timestamp: 0, promise: null },
  sellerPlans: { data: null, timestamp: 0, promise: null },
  captainPlans: { data: null, timestamp: 0, promise: null },
};

export const clearClientCache = (key) => {
  if (key && clientMemCache[key]) {
    clientMemCache[key] = { data: null, timestamp: 0, promise: null };
  } else if (!key) {
    Object.keys(clientMemCache).forEach((k) => {
      clientMemCache[k] = { data: null, timestamp: 0, promise: null };
    });
  }
};

export const bannerService = {
  getBanners: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && clientMemCache.banners.data && (now - clientMemCache.banners.timestamp < 60000)) {
      return clientMemCache.banners.data;
    }
    if (clientMemCache.banners.promise) {
      return clientMemCache.banners.promise;
    }

    clientMemCache.banners.promise = API.get('/banners')
      .then((response) => {
        clientMemCache.banners.data = response.data;
        clientMemCache.banners.timestamp = Date.now();
        clientMemCache.banners.promise = null;
        return response.data;
      })
      .catch((err) => {
        clientMemCache.banners.promise = null;
        throw err;
      });

    return clientMemCache.banners.promise;
  },
  createBanner: async (data) => {
    clearClientCache('banners');
    const response = await API.post('/banners', data);
    return response.data;
  },
  updateBanner: async (id, data) => {
    clearClientCache('banners');
    const response = await API.put(`/banners/${id}`, data);
    return response.data;
  },
  deleteBanner: async (id) => {
    clearClientCache('banners');
    const response = await API.delete(`/banners/${id}`);
    return response.data;
  },
  uploadImage: async (formData, folder = 'banners') => {
    const response = await API.post(`/upload?folder=${folder}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export const categoryService = {
  getCategories: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && clientMemCache.categories.data && (now - clientMemCache.categories.timestamp < 60000)) {
      return clientMemCache.categories.data;
    }
    if (clientMemCache.categories.promise) {
      return clientMemCache.categories.promise;
    }

    clientMemCache.categories.promise = API.get(forceRefresh ? '/categories?fresh=1' : '/categories')
      .then((response) => {
        clientMemCache.categories.data = response.data;
        clientMemCache.categories.timestamp = Date.now();
        clientMemCache.categories.promise = null;
        return response.data;
      })
      .catch((err) => {
        clientMemCache.categories.promise = null;
        throw err;
      });

    return clientMemCache.categories.promise;
  },
  getAllCategories: async (forceRefresh = false) => {
    return categoryService.getCategories(forceRefresh);
  },
  createCategory: async (data) => {
    clearClientCache('categories');
    const response = await API.post('/categories', data);
    return response.data;
  },
  updateCategory: async (id, data) => {
    clearClientCache('categories');
    const response = await API.put(`/categories/${id}`, data);
    return response.data;
  },
  deleteCategory: async (id) => {
    clearClientCache('categories');
    const response = await API.delete(`/categories/${id}`);
    return response.data;
  },
};

export const productService = {
  getProducts: async (params = {}) => {
    const response = await API.get('/products', { params });
    return response.data;
  },
  getProductById: async (id) => {
    const response = await API.get(`/products/${id}`);
    return response.data;
  },
  createProduct: async (data) => {
    const response = await API.post('/products', data);
    return response.data;
  },
  updateProduct: async (id, data) => {
    const response = await API.put(`/products/${id}`, data);
    return response.data;
  },
  deleteProduct: async (id) => {
    const response = await API.delete(`/products/${id}`);
    return response.data;
  },
};

export const cartService = {
  getCart: async () => {
    const response = await API.get('/cart');
    return response.data;
  },
  addToCart: async (productId, quantity = 1, productData = null) => {
    const response = await API.post('/cart/add', { productId, quantity, product: productData });
    return response.data;
  },
  syncCart: async (items = []) => {
    const response = await API.post('/cart/sync', { items });
    return response.data;
  },
  updateCartItem: async (productId, delta, quantity, productData = null) => {
    const response = await API.put('/cart/update', {
      productId,
      delta,
      quantity,
      product: productData,
      variantSku: productData?.variantSku || '',
      variantId: productData?.variantId || productData?.selectedVariant?._id || '',
      variantTitle: productData?.variantTitle || productData?.variation || '',
      // Never fall back to selectedVariant.attributes — that inflates unselected options into the cart
      selectedAttributes:
        productData?.selectedAttributes && Object.keys(productData.selectedAttributes).length
          ? productData.selectedAttributes
          : undefined,
      selectedVariants: productData?.selectedVariants,
      price: productData?.price,
      originalPrice: productData?.originalPrice,
      image: productData?.image || '',
      replaceLine: Boolean(productData?.replaceLine),
      previousVariantSku: productData?.previousVariantSku || '',
      previousSelectedAttributes: productData?.previousSelectedAttributes || undefined,
    });
    return response.data;
  },
  removeFromCart: async (productId, variant = null) => {
    const params = {};
    if (variant?.variantSku) params.variantSku = variant.variantSku;
    const attrs = variant?.selectedAttributes;
    if (attrs && typeof attrs === 'object' && Object.keys(attrs).length) {
      params.attrs = JSON.stringify(attrs);
    }
    const response = await API.delete(`/cart/remove/${productId}`, { params });
    return response.data;
  },
  clearCart: async () => {
    const response = await API.delete('/cart/clear');
    return response.data;
  },
};

export const wishlistService = {
  getWishlist: async () => {
    const response = await API.get('/wishlist');
    return response.data;
  },
  toggleWishlist: async (productId) => {
    const response = await API.post('/wishlist/toggle', { productId });
    return response.data;
  },
  syncWishlist: async (productIds) => {
    const response = await API.post('/wishlist/sync', { productIds });
    return response.data;
  },
};

export const addressService = {
  getAddresses: async () => {
    const response = await API.get('/user/addresses');
    return response.data;
  },
  addAddress: async (addressData) => {
    const response = await API.post('/user/addresses', addressData);
    return response.data;
  },
  updateAddress: async (addressId, addressData) => {
    const response = await API.put(`/user/addresses/${addressId}`, addressData);
    return response.data;
  },
  deleteAddress: async (addressId) => {
    const response = await API.delete(`/user/addresses/${addressId}`);
    return response.data;
  },
  setDefaultAddress: async (addressId) => {
    const response = await API.put(`/user/addresses/${addressId}/default`);
    return response.data;
  },
};

// Fast Client-Side Cache for User Orders
let userOrdersClientCache = { data: null, timestamp: 0 };

export const clearUserOrdersCache = () => {
  userOrdersClientCache = { data: null, timestamp: 0 };
  try {
    sessionStorage.removeItem('sathiseller_user_orders_cache');
  } catch (e) {}
};

export const getCachedUserOrders = () => {
  if (userOrdersClientCache.data) return userOrdersClientCache.data;
  try {
    const raw = sessionStorage.getItem('sathiseller_user_orders_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.orders)) {
        userOrdersClientCache = { data: parsed, timestamp: Date.now() };
        return parsed;
      }
    }
  } catch (e) {}
  return null;
};

export const orderService = {
  createRazorpayOrder: async (amount, orderId) => {
    const response = await API.post('/orders/razorpay/create-order', { amount, orderId });
    return response.data;
  },
  verifyRazorpayPayment: async (payload) => {
    const response = await API.post('/orders/razorpay/verify-payment', payload);
    return response.data;
  },
  placeOrder: async (orderData) => {
    clearUserOrdersCache();
    const response = await API.post('/orders', orderData);
    return response.data;
  },
  getOrders: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && userOrdersClientCache.data && (now - userOrdersClientCache.timestamp < 30000)) {
      return userOrdersClientCache.data;
    }
    if (forceRefresh) {
      clearUserOrdersCache();
    }
    const response = await API.get(forceRefresh ? '/orders?fresh=1' : '/orders');
    if (response.data && response.data.success) {
      userOrdersClientCache = { data: response.data, timestamp: now };
      try {
        sessionStorage.setItem('sathiseller_user_orders_cache', JSON.stringify(response.data));
      } catch (e) {}
    }
    return response.data;
  },
  getOrderById: async (id) => {
    const response = await API.get(`/orders/${id}`);
    return response.data;
  },
  getSellerNotifications: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = `/orders/seller/notifications${query ? `?${query}` : ''}`;
    const response = await API.get(url);
    return response.data;
  },
  markNotificationViewed: async (id) => {
    const response = await API.put(`/orders/seller/notifications/${id}/view`);
    return response.data;
  },
  acceptSellerOrder: async (id) => {
    const response = await API.put(`/orders/seller/notifications/${id}/accept`);
    return response.data;
  },
  rejectSellerOrder: async (id, payload) => {
    const body = typeof payload === 'string'
      ? { rejectionReason: payload }
      : (payload || {});
    const response = await API.put(`/orders/seller/notifications/${id}/reject`, body);
    return response.data;
  },
  updateSellerOrderStatus: async (id, status, payload = {}) => {
    const response = await API.put(`/orders/seller/notifications/${id}/status`, { status, ...payload });
    return response.data;
  },
  requestReturn: async (orderId, payload) => {
    clearUserOrdersCache();
    const response = await API.post(`/orders/${orderId}/return`, payload);
    return response.data;
  },
};

export const returnService = {
  // Customer
  requestItemReturn: async (payload) => {
    clearUserOrdersCache();
    const response = await API.post('/returns', payload);
    return response.data;
  },
  getMyReturns: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await API.get(`/returns/my-returns${query ? `?${query}` : ''}`);
    return response.data;
  },
  getReturnById: async (id) => {
    const response = await API.get(`/returns/${id}`);
    return response.data;
  },
  cancelReturn: async (id) => {
    const response = await API.put(`/returns/${id}/cancel`);
    return response.data;
  },

  // Seller
  getSellerReturns: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await API.get(`/returns/seller/returns${query ? `?${query}` : ''}`);
    return response.data;
  },
  sellerApproveReturn: async (id, action = 'APPROVE', rejectionReason = '') => {
    const response = await API.put(`/returns/${id}/seller-approve`, { action, rejectionReason });
    return response.data;
  },
  sellerReceiveReturn: async (id, payload = {}) => {
    const response = await API.put(`/returns/${id}/seller-receive`, payload);
    return response.data;
  },
  sellerVerifyReturn: async (id, payload) => {
    const response = await API.put(`/returns/${id}/seller-verify`, payload);
    return response.data;
  },

  // Captain
  getCaptainReturnJobs: async (filter = 'available') => {
    const response = await API.get(`/returns/captain/jobs?filter=${filter}`);
    return response.data;
  },
  captainAcceptReturnJob: async (id) => {
    const response = await API.put(`/returns/captain/${id}/accept`);
    return response.data;
  },
  captainUpdateReturnStatus: async (id, status, notes = '') => {
    const response = await API.put(`/returns/captain/${id}/status`, { status, notes });
    return response.data;
  },
  captainVerifyReturnOtp: async (id, otp, notes = '', proofUrl = '', checklist = null) => {
    const response = await API.post(`/returns/captain/${id}/verify-otp`, { otp, notes, proofUrl, checklist });
    return response.data;
  },
  captainFailInspection: async (id, failureReason = '', notes = '') => {
    const response = await API.put(`/returns/captain/${id}/fail-inspection`, { failureReason, notes });
    return response.data;
  },

  // Admin
  getAdminReturns: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await API.get(`/returns/admin/all${query ? `?${query}` : ''}`);
    return response.data;
  },
  adminApproveReturn: async (id, action = 'APPROVE', rejectionReason = '') => {
    const response = await API.put(`/returns/admin/${id}/approve`, { action, rejectionReason });
    return response.data;
  },
  adminAssignCaptain: async (id, captainId) => {
    const response = await API.put(`/returns/admin/${id}/assign-captain`, { captainId });
    return response.data;
  },
  adminVerifyReturn: async (id, payload) => {
    const response = await API.put(`/returns/admin/${id}/verify`, payload);
    return response.data;
  },
};


export const walletService = {
  getUserWallet: async () => {
    const response = await API.get('/wallet/user');
    return response.data;
  },
  getUserWalletTransactions: async (type = 'All') => {
    const response = await API.get(`/wallet/user/transactions?type=${encodeURIComponent(type)}`);
    return response.data;
  },
  getSellerWallet: async () => {
    const response = await API.get('/wallet/seller');
    return response.data;
  },
  requestWithdrawal: async (payload) => {
    const response = await API.post('/wallet/seller/withdraw', payload);
    return response.data;
  },
  getAdminSettlements: async () => {
    const response = await API.get('/wallet/admin/settlements');
    return response.data;
  },
  getAdminWithdrawals: async () => {
    const response = await API.get('/wallet/admin/withdrawals');
    return response.data;
  },
  updateWithdrawalStatus: async (id, status, adminRemark = '') => {
    const response = await API.put(`/wallet/admin/withdrawals/${id}/status`, { status, adminRemark });
    return response.data;
  },
  updateSellerCommission: async (sellerId, commissionPercentage) => {
    const response = await API.put(`/admin/sellers/${sellerId}/commission`, { commissionPercentage });
    return response.data;
  },
};

// Fast Client-Side In-Memory Cache for Instant UI Rendering
const adminClientCache = {
  sellers: { data: null, timestamp: 0 },
  captains: { data: null, timestamp: 0 },
  users: { data: null, timestamp: 0 },
};

export const clearAdminClientCache = (key) => {
  if (key && adminClientCache[key]) {
    adminClientCache[key] = { data: null, timestamp: 0 };
  } else {
    Object.keys(adminClientCache).forEach(k => {
      adminClientCache[k] = { data: null, timestamp: 0 };
    });
  }
};

// Fast Client-Side Cache for Captain Dashboard
let captainDashboardClientCache = {
  data: (() => {
    try {
      const saved = sessionStorage.getItem('sathiseller_captain_dashboard_cache');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })(),
  timestamp: 0,
};

export const clearCaptainDashboardClientCache = () => {
  captainDashboardClientCache = { data: null, timestamp: 0 };
  try {
    sessionStorage.removeItem('sathiseller_captain_dashboard_cache');
  } catch (e) {}
};

export const getCachedCaptainDashboard = () => {
  if (captainDashboardClientCache.data) return captainDashboardClientCache.data;
  try {
    const saved = sessionStorage.getItem('sathiseller_captain_dashboard_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      captainDashboardClientCache = { data: parsed, timestamp: Date.now() };
      return parsed;
    }
  } catch (e) {}
  return null;
};

export const captainService = {
  // Auth (existing)
  getAllCaptains: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && adminClientCache.captains.data && (now - adminClientCache.captains.timestamp < 30000)) {
      return adminClientCache.captains.data;
    }
    const response = await API.get(forceRefresh ? '/admin/captains?fresh=1' : '/admin/captains');
    if (response.data && response.data.success) {
      adminClientCache.captains = { data: response.data, timestamp: now };
    }
    return response.data;
  },
  toggleCaptainStatus: async (id, status) => {
    clearAdminClientCache('captains');
    clearCaptainDashboardClientCache();
    const response = await API.put(`/admin/captains/${id}/status`, { status });
    return response.data;
  },
  updateCaptainStatus: async (id, status) => {
    clearAdminClientCache('captains');
    clearCaptainDashboardClientCache();
    const response = await API.put(`/admin/captains/${id}/status`, { status });
    return response.data;
  },
  deleteCaptain: async (id) => {
    clearAdminClientCache('captains');
    clearCaptainDashboardClientCache();
    const response = await API.delete(`/admin/captains/${id}`);
    return response.data;
  },
  getAvailableCaptains: async () => {
    const response = await API.get('/admin/captains/available');
    return response.data;
  },

  // Profile & Account
  getProfile: async () => {
    const response = await API.get('/captain/profile');
    return response.data;
  },
  updateProfile: async (data) => {
    clearCaptainDashboardClientCache();
    const response = await API.put('/captain/profile', data);
    return response.data;
  },
  deleteAccount: async (reason = '', feedback = '') => {
    clearCaptainDashboardClientCache();
    const response = await API.delete('/captain/account', { data: { reason, feedback } });
    return response.data;
  },

  // Status & Location
  updateOnlineStatus: async (isOnline) => {
    clearCaptainDashboardClientCache();
    const response = await API.put('/captain/status', { isOnline });
    return response.data;
  },
  updateLocation: async (lat, lng) => {
    const response = await API.put('/captain/location', { lat, lng });
    return response.data;
  },

  // Dashboard
  getDashboardStats: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && captainDashboardClientCache.data && (now - captainDashboardClientCache.timestamp < 15000)) {
      return captainDashboardClientCache.data;
    }
    const response = await API.get('/captain/dashboard');
    if (response.data && response.data.success) {
      captainDashboardClientCache = { data: response.data, timestamp: now };
      try {
        sessionStorage.setItem('sathiseller_captain_dashboard_cache', JSON.stringify(response.data));
      } catch (e) {}
    }
    return response.data;
  },

  // Jobs
  getJobs: async (tab = 'deliveries') => {
    const response = await API.get(`/captain/jobs?tab=${tab}`);
    return response.data;
  },
  acceptJob: async (orderId) => {
    clearCaptainDashboardClientCache();
    const response = await API.put(`/captain/jobs/${orderId}/accept`);
    return response.data;
  },
  rejectJob: async (orderId) => {
    clearCaptainDashboardClientCache();
    const response = await API.put(`/captain/jobs/${orderId}/reject`);
    return response.data;
  },
  updateDeliveryStatus: async (orderId, status, payload = {}) => {
    clearCaptainDashboardClientCache();
    const response = await API.put(`/captain/jobs/${orderId}/status`, { status, ...payload });
    return response.data;
  },

  // Active Delivery
  getActiveDelivery: async () => {
    const response = await API.get('/captain/active-delivery');
    return response.data;
  },
  verifyOrderPickupOtp: async (orderId, otp) => {
    clearCaptainDashboardClientCache();
    const response = await API.post(`/captain/jobs/${orderId}/verify-pickup-otp`, { otp });
    return response.data;
  },
  verifyDeliveryOtp: async (orderId, otp) => {
    const response = await API.post(`/captain/jobs/${orderId}/verify-otp`, { otp });
    return response.data;
  },
  submitProofOfDelivery: async (orderId, proofUrl) => {
    const response = await API.post(`/captain/jobs/${orderId}/proof`, { proofUrl });
    return response.data;
  },

  // Wallet
  getWallet: async () => {
    const response = await API.get('/captain/wallet');
    return response.data;
  },
  getTransactions: async (type = 'All') => {
    const response = await API.get(`/captain/wallet/transactions?type=${type}`);
    return response.data;
  },
  requestWithdrawal: async (amount) => {
    const response = await API.post('/captain/wallet/withdraw', { amount });
    return response.data;
  },

  // Notifications
  getNotifications: async () => {
    const response = await API.get('/captain/notifications');
    return response.data;
  },
  markNotificationRead: async (id) => {
    const response = await API.put(`/captain/notifications/${id}/read`);
    return response.data;
  },
  markAllNotificationsRead: async () => {
    const response = await API.put('/captain/notifications/read-all');
    return response.data;
  },

  // COD Cash Collection & Settlements
  confirmCodCollection: async (orderId, notes = '') => {
    clearCaptainDashboardClientCache();
    const response = await API.post(`/captain/jobs/${orderId}/confirm-cod`, { notes });
    return response.data;
  },
  getCodCollections: async () => {
    const response = await API.get('/captain/cod-collections');
    return response.data;
  },
  requestCashSettlement: async (payload) => {
    clearCaptainDashboardClientCache();
    const response = await API.post('/captain/cash-settlements', payload);
    return response.data;
  },
  getCashSettlements: async () => {
    const response = await API.get('/captain/cash-settlements');
    return response.data;
  },

  // Service Areas
  getServiceAreas: async () => {
    const response = await API.get('/captain/service-areas');
    return response.data;
  },

  // Admin: Available Captains for assignment & Settlements
  getAvailableCaptains: async () => {
    const response = await API.get('/admin/captains/available');
    return response.data;
  },
  assignCaptainToOrder: async (orderId, captainId, captainEarnings = 0) => {
    const response = await API.put(`/admin/orders/${orderId}/assign-captain`, { captainId, captainEarnings });
    return response.data;
  },
  getAdminCaptainCashSettlements: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await API.get(`/admin/captain-cash-settlements${query ? `?${query}` : ''}`);
    return response.data;
  },
  processAdminCaptainCashSettlement: async (id, action, adminRemarks = '') => {
    const response = await API.put(`/admin/captain-cash-settlements/${id}`, { action, adminRemarks });
    return response.data;
  },
};

export const userService = {
  getProfile: async () => {
    try {
      const response = await API.get('/auth/user/profile');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  updateProfile: async (data) => {
    try {
      const response = await API.put('/auth/user/profile', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export const membershipService = {
  // ── Seller (user-facing) ──────────────────────────────────
  getSellerPlans: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && clientMemCache.sellerPlans.data && (now - clientMemCache.sellerPlans.timestamp < 60000)) {
      return clientMemCache.sellerPlans.data;
    }
    if (clientMemCache.sellerPlans.promise) {
      return clientMemCache.sellerPlans.promise;
    }

    clientMemCache.sellerPlans.promise = API.get(`/membership/seller/plans${forceRefresh ? '?fresh=true' : ''}`)
      .then((response) => {
        clientMemCache.sellerPlans.data = response.data;
        clientMemCache.sellerPlans.timestamp = Date.now();
        clientMemCache.sellerPlans.promise = null;
        return response.data;
      })
      .catch((err) => {
        clientMemCache.sellerPlans.promise = null;
        throw err;
      });

    return clientMemCache.sellerPlans.promise;
  },
  createRazorpayOrder: async (planId, userType = 'seller') => {
    const response = await API.post('/membership/razorpay/create-order', { planId, userType });
    return response.data;
  },
  getSellerMembership: async () => {
    const response = await API.get('/membership/seller/current');
    return response.data;
  },
  getSellerMembershipHistory: async () => {
    const response = await API.get('/membership/seller/history');
    return response.data;
  },
  purchaseSellerMembership: async (payload) => {
    const response = await API.post('/membership/seller/purchase', payload);
    return response.data;
  },
  renewSellerMembership: async (payload) => {
    const response = await API.post('/membership/seller/renew', payload);
    return response.data;
  },

  // ── Captain (user-facing) ─────────────────────────────────
  getCaptainPlans: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && clientMemCache.captainPlans.data && (now - clientMemCache.captainPlans.timestamp < 60000)) {
      return clientMemCache.captainPlans.data;
    }
    if (clientMemCache.captainPlans.promise) {
      return clientMemCache.captainPlans.promise;
    }

    clientMemCache.captainPlans.promise = API.get(`/membership/captain/plans${forceRefresh ? '?fresh=true' : ''}`)
      .then((response) => {
        clientMemCache.captainPlans.data = response.data;
        clientMemCache.captainPlans.timestamp = Date.now();
        clientMemCache.captainPlans.promise = null;
        return response.data;
      })
      .catch((err) => {
        clientMemCache.captainPlans.promise = null;
        throw err;
      });

    return clientMemCache.captainPlans.promise;
  },
  getCaptainMembership: async () => {
    const response = await API.get('/membership/captain/current');
    return response.data;
  },
  getCaptainMembershipHistory: async () => {
    const response = await API.get('/membership/captain/history');
    return response.data;
  },
  purchaseCaptainMembership: async (payload) => {
    const response = await API.post('/membership/captain/purchase', payload);
    return response.data;
  },
  renewCaptainMembership: async (payload) => {
    const response = await API.post('/membership/captain/renew', payload);
    return response.data;
  },

  // ── Admin: Seller Plans ───────────────────────────────────
  adminGetSellerPlans: async () => {
    const response = await API.get('/membership/admin/seller/plans');
    return response.data;
  },
  adminCreateSellerPlan: async (data) => {
    clearClientCache('sellerPlans');
    const response = await API.post('/membership/admin/seller/plans', data);
    return response.data;
  },
  adminUpdateSellerPlan: async (id, data) => {
    clearClientCache('sellerPlans');
    const response = await API.put(`/membership/admin/seller/plans/${id}`, data);
    return response.data;
  },
  adminToggleSellerPlan: async (id) => {
    clearClientCache('sellerPlans');
    const response = await API.put(`/membership/admin/seller/plans/${id}/toggle`);
    return response.data;
  },
  adminDeleteSellerPlan: async (id) => {
    clearClientCache('sellerPlans');
    const response = await API.delete(`/membership/admin/seller/plans/${id}`);
    return response.data;
  },

  // ── Admin: Captain Plans ──────────────────────────────────
  adminGetCaptainPlans: async () => {
    const response = await API.get('/membership/admin/captain/plans');
    return response.data;
  },
  adminCreateCaptainPlan: async (data) => {
    clearClientCache('captainPlans');
    const response = await API.post('/membership/admin/captain/plans', data);
    return response.data;
  },
  adminUpdateCaptainPlan: async (id, data) => {
    clearClientCache('captainPlans');
    const response = await API.put(`/membership/admin/captain/plans/${id}`, data);
    return response.data;
  },
  adminToggleCaptainPlan: async (id) => {
    clearClientCache('captainPlans');
    const response = await API.put(`/membership/admin/captain/plans/${id}/toggle`);
    return response.data;
  },
  adminDeleteCaptainPlan: async (id) => {
    clearClientCache('captainPlans');
    const response = await API.delete(`/membership/admin/captain/plans/${id}`);
    return response.data;
  },

  // ── Admin: Subscriptions ──────────────────────────────────
  adminGetSellerSubscriptions: async (params = {}) => {
    const response = await API.get('/membership/admin/seller/subscriptions', { params });
    return response.data;
  },
  adminGetCaptainSubscriptions: async (params = {}) => {
    const response = await API.get('/membership/admin/captain/subscriptions', { params });
    return response.data;
  },
  adminConfirmSellerPayment: async (id, adminNote = '') => {
    const response = await API.put(`/membership/admin/seller/subscriptions/${id}/confirm-payment`, { adminNote });
    return response.data;
  },
  adminConfirmCaptainPayment: async (id, adminNote = '') => {
    const response = await API.put(`/membership/admin/captain/subscriptions/${id}/confirm-payment`, { adminNote });
    return response.data;
  },

  // ── Admin: Stats ──────────────────────────────────────────
  adminGetSellerStats: async () => {
    const response = await API.get('/membership/admin/seller/stats');
    return response.data;
  },
  adminGetCaptainStats: async () => {
    const response = await API.get('/membership/admin/captain/stats');
    return response.data;
  },
  adminCheckExpiry: async () => {
    const response = await API.post('/membership/admin/check-expiry');
    return response.data;
  },
};

export const policyService = {
  getPolicies: async (params = {}) => {
    const response = await API.get('/policies', { params });
    return response.data;
  },
  getPolicy: async (target, type) => {
    const response = await API.get(`/policies/${target}/${type}`);
    return response.data;
  },
  savePolicy: async (data) => {
    const response = await API.post('/policies', data);
    return response.data;
  },
  deletePolicy: async (id) => {
    const response = await API.delete(`/policies/${id}`);
    return response.data;
  },
};

export const fcmService = {
  saveToken: async (token, platform = 'web') => {
    const response = await API.post('/fcm-tokens/save', { token, platform });
    return response.data;
  },
  saveMobileToken: async (token) => {
    const response = await API.post('/fcm-tokens/mobile/save', { token });
    return response.data;
  },
  removeToken: async (token, platform = 'web') => {
    const response = await API.delete('/fcm-tokens/remove', { data: { token, platform } });
    return response.data;
  },
  sendTestPush: async () => {
    const response = await API.post('/fcm-tokens/test');
    return response.data;
  },
};

export const sellerService = {
  getPublicSellers: async (params = {}) => {
    try {
      const response = await API.get('/sellers', { params });
      return response.data;
    } catch (err) {
      console.warn('Failed to fetch public sellers from API, returning local fallbacks:', err.message);
      return { success: false, sellers: [] };
    }
  },
  getSellerStore: async (id, params = {}) => {
    try {
      const response = await API.get(`/sellers/${id}`, { params });
      return response.data;
    } catch (err) {
      console.warn('Failed to fetch seller store from API:', err.message);
      return { success: false, seller: null, products: [] };
    }
  },
  deleteSeller: async (id) => {
    const response = await API.delete(`/admin/sellers/${id}`);
    return response.data;
  }
};

export const adminService = {
  getDashboardStats: async () => {
    const response = await API.get('/admin/dashboard/stats');
    return response.data;
  },
  getOrders: async () => {
    const response = await API.get('/admin/orders');
    return response.data;
  },
  getUsers: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && adminClientCache.users.data && (now - adminClientCache.users.timestamp < 30000)) {
      return adminClientCache.users.data;
    }
    const response = await API.get('/admin/users');
    if (response.data && response.data.success) {
      adminClientCache.users = { data: response.data, timestamp: now };
    }
    return response.data;
  },
  toggleUserBlock: async (id, isBlocked, reason = '') => {
    clearAdminClientCache('users');
    const response = await API.put(`/admin/users/${id}/block`, { isBlocked, reason });
    return response.data;
  },
  getSellers: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && adminClientCache.sellers.data && (now - adminClientCache.sellers.timestamp < 30000)) {
      return adminClientCache.sellers.data;
    }
    const response = await API.get(`/admin/sellers${forceRefresh ? '?fresh=true' : ''}`);
    if (response.data && response.data.success) {
      adminClientCache.sellers = { data: response.data, timestamp: now };
    }
    return response.data;
  },
  toggleSellerStatus: async (id, status) => {
    clearAdminClientCache('sellers');
    const response = await API.put(`/admin/sellers/${id}/status`, { status });
    return response.data;
  },
  updateSellerCommission: async (id, commissionPercentage) => {
    clearAdminClientCache('sellers');
    const response = await API.put(`/admin/sellers/${id}/commission`, { commissionPercentage });
    return response.data;
  },
  updateSellerDetails: async (id, details) => {
    clearAdminClientCache('sellers');
    const response = await API.put(`/admin/sellers/${id}/details`, details);
    return response.data;
  },
  deleteSeller: async (id) => {
    clearAdminClientCache('sellers');
    const response = await API.delete(`/admin/sellers/${id}`);
    return response.data;
  },
  getCaptains: async (forceRefresh = false) => {
    return captainService.getAllCaptains(forceRefresh);
  },
  toggleCaptainStatus: async (id, status) => {
    return captainService.toggleCaptainStatus(id, status);
  },
  updateCaptainDetails: async (id, details) => {
    const response = await API.put(`/admin/captains/${id}/details`, details);
    return response.data;
  },
  deleteCaptain: async (id) => {
    return captainService.deleteCaptain(id);
  },
  assignCaptainToOrder: async (orderId, captainId, captainEarnings = 0) => {
    const response = await API.put(`/admin/orders/${orderId}/assign-captain`, { captainId, captainEarnings });
    return response.data;
  },
  getAvailableCaptains: async () => {
    const response = await API.get('/admin/captains/available');
    return response.data;
  },
  updateOrderStatus: async (orderId, payload) => {
    const response = await API.put(`/admin/orders/${orderId}/status`, payload);
    return response.data;
  },
  getUserOrders: async (userId) => {
    const response = await API.get(`/admin/users/${userId}/orders`);
    return response.data;
  },
  updateReturnStatus: async (orderId, payload) => {
    const response = await API.put(`/admin/orders/${orderId}/return-status`, payload);
    return response.data;
  },
  getProfile: async () => {
    return authService.getAdminProfile();
  },
  updateProfile: async (payload) => {
    return authService.updateAdminProfile(payload);
  },
};

export const profileEditRequestService = {
  submitEditRequest: async (payload) => {
    const response = await API.post('/profile-edit-requests/submit', payload);
    return response.data;
  },
  getMyPendingEditRequest: async () => {
    const response = await API.get('/profile-edit-requests/my-pending');
    return response.data;
  },
  getAdminEditRequests: async (params = {}) => {
    const response = await API.get('/profile-edit-requests/admin', { params });
    return response.data;
  },
  getAdminEditRequestById: async (id) => {
    const response = await API.get(`/profile-edit-requests/admin/${id}`);
    return response.data;
  },
  approveEditRequest: async (id) => {
    const response = await API.put(`/profile-edit-requests/admin/${id}/approve`);
    return response.data;
  },
  rejectEditRequest: async (id, adminNote = '') => {
    const response = await API.put(`/profile-edit-requests/admin/${id}/reject`, { adminNote });
    return response.data;
  },
};

export const sellerRegistrationFeeService = {
  // Public & Seller Methods
  getPublicFeeConfig: async () => {
    const response = await API.get('/seller-registration-fee/config');
    return response.data;
  },
  initiateOrder: async (payload) => {
    const response = await API.post('/seller-registration-fee/initiate-order', payload);
    return response.data;
  },
  verifyPayment: async (payload) => {
    const response = await API.post('/seller-registration-fee/verify-payment', payload);
    return response.data;
  },
  retryOrder: async (payload) => {
    const response = await API.post('/seller-registration-fee/retry-order', payload);
    return response.data;
  },

  // Admin Management Methods
  adminGetConfig: async () => {
    const response = await API.get('/seller-registration-fee/admin');
    return response.data;
  },
  adminUpdateConfig: async (payload) => {
    const response = await API.put('/seller-registration-fee/admin', payload);
    return response.data;
  },
  adminGetPayments: async (params = {}) => {
    const response = await API.get('/seller-registration-fee/admin/payments', { params });
    return response.data;
  },
  adminGetPaymentById: async (id) => {
    const response = await API.get(`/seller-registration-fee/admin/payments/${id}`);
    return response.data;
  },
};

export const captainRegistrationFeeService = {
  // Public & Captain Methods
  getPublicFeeConfig: async () => {
    const response = await API.get('/captain-registration-fee/config');
    return response.data;
  },
  initiateOrder: async (payload) => {
    const response = await API.post('/captain-registration-fee/initiate-order', payload);
    return response.data;
  },
  verifyPayment: async (payload) => {
    const response = await API.post('/captain-registration-fee/verify-payment', payload);
    return response.data;
  },
  retryOrder: async (payload) => {
    const response = await API.post('/captain-registration-fee/retry-order', payload);
    return response.data;
  },

  // Admin Management Methods
  adminGetConfig: async () => {
    const response = await API.get('/captain-registration-fee/admin');
    return response.data;
  },
  adminUpdateConfig: async (payload) => {
    const response = await API.put('/captain-registration-fee/admin', payload);
    return response.data;
  },
  adminGetPayments: async (params = {}) => {
    const response = await API.get('/captain-registration-fee/admin/payments', { params });
    return response.data;
  },
  adminGetPaymentById: async (id) => {
    const response = await API.get(`/captain-registration-fee/admin/payments/${id}`);
    return response.data;
  },
};

export { default as commissionService } from './commissionService';

// Referral & Earn Service
export const referralService = {
  // Public — validate referral code and get referrer display name
  validate: async (code, role = 'seller') => {
    const res = await API.get('/referral/validate', {
      params: { code: String(code || '').trim(), role },
    });
    return res.data;
  },

  // Seller
  getSellerCode: async () => {
    const res = await API.get('/referral/seller/code');
    return res.data;
  },
  getSellerReferrals: async (params = {}) => {
    const res = await API.get('/referral/seller/my', { params });
    return res.data;
  },

  // Captain
  getCaptainCode: async () => {
    const res = await API.get('/referral/captain/code');
    return res.data;
  },
  getCaptainReferrals: async (params = {}) => {
    const res = await API.get('/referral/captain/my', { params });
    return res.data;
  },

  // Admin
  getSettings: async () => {
    const res = await API.get('/referral/admin/settings');
    return res.data;
  },
  updateSettings: async (data) => {
    const res = await API.put('/referral/admin/settings', data);
    return res.data;
  },
  getStats: async () => {
    const res = await API.get('/referral/admin/stats');
    return res.data;
  },
  getAllReferrals: async (params = {}) => {
    const res = await API.get('/referral/admin/all', { params });
    return res.data;
  },
  updateReferralStatus: async (id, action, reason = '') => {
    const res = await API.put(`/referral/admin/${id}/approve`, { action, reason });
    return res.data;
  },
  creditReward: async (id) => {
    const res = await API.post(`/referral/admin/${id}/credit`);
    return res.data;
  },
};

export const adminTransportService = {
  getAllBookings: async (params = {}) => {
    const res = await API.get('/transport/bookings/admin/all', { params });
    return res.data;
  },
  assignCaptain: async (bookingId, captainId, captainEarnings = 0) => {
    const res = await API.put(`/transport/bookings/admin/${bookingId}/assign-captain`, { captainId, captainEarnings });
    return res.data;
  },
  cancelBooking: async (bookingId, reason = '') => {
    const res = await API.put(`/transport/bookings/admin/${bookingId}/cancel`, { reason });
    return res.data;
  },
};

export const vehicleService = {
  getAllVehiclesAdmin: async () => {
    const res = await API.get('/transport/vehicles/admin/all');
    return res.data;
  },
  getActiveVehicles: async () => {
    const res = await API.get('/transport/vehicles');
    return res.data;
  },
  getVehicleById: async (id) => {
    const res = await API.get(`/transport/vehicles/${id}`);
    return res.data;
  },
  createVehicle: async (payload) => {
    const res = await API.post('/transport/vehicles', payload);
    return res.data;
  },
  updateVehicle: async (id, payload) => {
    const res = await API.put(`/transport/vehicles/${id}`, payload);
    return res.data;
  },
  deleteVehicle: async (id) => {
    const res = await API.delete(`/transport/vehicles/${id}`);
    return res.data;
  },
  toggleStatus: async (id, isActive) => {
    const res = await API.put(`/transport/vehicles/${id}`, { isActive });
    return res.data;
  },
};









