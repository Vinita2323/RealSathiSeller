import API from './api';

export const superAdminService = {
  // Authentication
  login: async (credentials) => {
    const response = await API.post('/auth/super-admin/login', credentials);
    return response.data;
  },
  getProfile: async () => {
    const response = await API.get('/auth/super-admin/me');
    return response.data;
  },

  // Financial Dashboard Live Metrics
  getDashboardMetrics: async () => {
    const response = await API.get('/super-admin/dashboard/metrics');
    return response.data;
  },

  // Central Ledger Transactions
  getTransactions: async (params = {}) => {
    const response = await API.get('/super-admin/transactions', { params });
    return response.data;
  },

  // Payout Management
  getPayouts: async (params = {}) => {
    const response = await API.get('/super-admin/payouts', { params });
    return response.data;
  },
  getPayoutById: async (id) => {
    const response = await API.get(`/super-admin/payouts/${id}`);
    return response.data;
  },
  approvePayout: async (id, payload = {}) => {
    const response = await API.put(`/super-admin/payouts/${id}/approve`, payload);
    return response.data;
  },
  rejectPayout: async (id, payload) => {
    const response = await API.put(`/super-admin/payouts/${id}/reject`, payload);
    return response.data;
  },
  processPayout: async (id, payload) => {
    const response = await API.put(`/super-admin/payouts/${id}/process`, payload);
    return response.data;
  },

  // Settlements
  getSellerSettlements: async (params = {}) => {
    const response = await API.get('/super-admin/settlements/sellers', { params });
    return response.data;
  },
  getCaptainSettlements: async (params = {}) => {
    const response = await API.get('/super-admin/settlements/captains', { params });
    return response.data;
  },

  // Commission Management
  getCommissions: async () => {
    const response = await API.get('/super-admin/commissions');
    return response.data;
  },
  updateSellerCommission: async (sellerId, payload) => {
    const response = await API.put(`/super-admin/sellers/${sellerId}/commission`, payload);
    return response.data;
  },

  // Financial Adjustments
  getFinancialAdjustments: async () => {
    const response = await API.get('/super-admin/financial-adjustments');
    return response.data;
  },
  createFinancialAdjustment: async (payload) => {
    const response = await API.post('/super-admin/financial-adjustments', payload);
    return response.data;
  },

  // Refunds
  getRefunds: async () => {
    const response = await API.get('/super-admin/refunds');
    return response.data;
  },
  processRefund: async (id, payload) => {
    const response = await API.put(`/super-admin/refunds/${id}/process`, payload);
    return response.data;
  },

  // Reports
  getReports: async (params = {}) => {
    const response = await API.get('/super-admin/reports', { params });
    return response.data;
  },

  // Audit Logs
  getAuditLogs: async (params = {}) => {
    const response = await API.get('/super-admin/audit-logs', { params });
    return response.data;
  },
};
