import API from './api';

let pricingCache = {
  data: null,
  timestamp: 0,
};

export const pricingService = {
  // ── Admin: Master Overview ──────────────────────────────────────────────────
  getAdminPricingOverview: async () => {
    const response = await API.get('/pricing/admin');
    return response.data;
  },

  // ── Admin: Vehicle Fleet Pricing (Per-Vehicle Rates) ────────────────────────
  getAllVehicles: async () => {
    const response = await API.get('/pricing/admin/vehicles');
    return response.data;
  },

  updateVehiclePricing: async (id, payload) => {
    const response = await API.put(`/pricing/admin/vehicles/${id}`, payload);
    pricingCache.timestamp = 0;
    return response.data;
  },

  createVehicleType: async (payload) => {
    const response = await API.post('/pricing/admin/vehicles', payload);
    pricingCache.timestamp = 0;
    return response.data;
  },

  deleteVehicleType: async (id) => {
    const response = await API.delete(`/pricing/admin/vehicles/${id}`);
    pricingCache.timestamp = 0;
    return response.data;
  },

  // ── Admin: Transport Pricing ────────────────────────────────────────────────
  getTransportPricing: async () => {
    const response = await API.get('/pricing/admin/transport');
    return response.data;
  },

  createTransportPricing: async (payload) => {
    const response = await API.post('/pricing/admin/transport', payload);
    pricingCache.timestamp = 0; // invalidate cache
    return response.data;
  },

  updateTransportPricing: async (id, payload) => {
    const response = await API.put(`/pricing/admin/transport/${id}`, payload);
    pricingCache.timestamp = 0;
    return response.data;
  },

  activateTransportPricing: async (id) => {
    const response = await API.patch(`/pricing/admin/transport/${id}/activate`);
    pricingCache.timestamp = 0;
    return response.data;
  },

  deleteTransportPricing: async (id) => {
    const response = await API.delete(`/pricing/admin/transport/${id}`);
    pricingCache.timestamp = 0;
    return response.data;
  },

  // ── Admin: Delivery Pricing ─────────────────────────────────────────────────
  getDeliveryPricing: async () => {
    const response = await API.get('/pricing/admin/delivery');
    return response.data;
  },

  createDeliveryPricing: async (payload) => {
    const response = await API.post('/pricing/admin/delivery', payload);
    pricingCache.timestamp = 0;
    return response.data;
  },

  updateDeliveryPricing: async (id, payload) => {
    const response = await API.put(`/pricing/admin/delivery/${id}`, payload);
    pricingCache.timestamp = 0;
    return response.data;
  },

  activateDeliveryPricing: async (id) => {
    const response = await API.patch(`/pricing/admin/delivery/${id}/activate`);
    pricingCache.timestamp = 0;
    return response.data;
  },

  deleteDeliveryPricing: async (id) => {
    const response = await API.delete(`/pricing/admin/delivery/${id}`);
    pricingCache.timestamp = 0;
    return response.data;
  },

  // ── Public / Client Endpoints ───────────────────────────────────────────────
  getActivePricing: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && pricingCache.data && (now - pricingCache.timestamp < 60000)) {
      return pricingCache.data;
    }
    try {
      const response = await API.get('/pricing/active');
      if (response.data?.success) {
        pricingCache = {
          data: response.data,
          timestamp: now,
        };
      }
      return response.data;
    } catch (err) {
      if (pricingCache.data) return pricingCache.data;
      throw err;
    }
  },

  // Simulators / Calculators
  calculateTransportFare: async (payload) => {
    const response = await API.post('/pricing/calculate-transport', payload);
    return response.data;
  },

  calculateDeliveryFee: async (payload) => {
    const response = await API.post('/pricing/calculate-delivery', payload);
    return response.data;
  },
};

export default pricingService;
