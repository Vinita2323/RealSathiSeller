import API from './api';

let deliverySettingsCache = {
  data: {
    deliveryCharge: 40,
    freeDeliveryMinOrder: 500,
    isFreeDeliveryEnabled: true,
    codCharge: 9,
    isCodChargeEnabled: true,
  },
  timestamp: 0,
};

export const commissionService = {
  // Get active commission & delivery settings (Admin)
  getAdminCommissionSettings: async () => {
    const response = await API.get('/admin/commission-settings');
    return response.data;
  },

  // Update commission & delivery settings (Admin)
  updateAdminCommissionSettings: async (payload) => {
    const response = await API.put('/admin/commission-settings', payload);
    if (response.data?.settings) {
      deliverySettingsCache = {
        data: {
          deliveryCharge: response.data.settings.deliveryCharge ?? 40,
          freeDeliveryMinOrder: response.data.settings.freeDeliveryMinOrder ?? 500,
          isFreeDeliveryEnabled: response.data.settings.isFreeDeliveryEnabled ?? true,
          codCharge: response.data.settings.codCharge ?? 9,
          isCodChargeEnabled: response.data.settings.isCodChargeEnabled ?? true,
        },
        timestamp: Date.now(),
      };
    }
    return response.data;
  },

  // Get current rates (Public / User / Seller / Captain)
  getCurrentRates: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && deliverySettingsCache.timestamp && (now - deliverySettingsCache.timestamp < 2000)) {
      return { success: true, ...deliverySettingsCache.data };
    }
    try {
      const response = await API.get('/commission-settings/current');
      if (response.data) {
        deliverySettingsCache = {
          data: {
            deliveryCharge: response.data.deliveryCharge ?? 40,
            freeDeliveryMinOrder: response.data.freeDeliveryMinOrder ?? 500,
            isFreeDeliveryEnabled: response.data.isFreeDeliveryEnabled ?? true,
            codCharge: response.data.codCharge ?? 9,
            isCodChargeEnabled: response.data.isCodChargeEnabled ?? true,
          },
          timestamp: now,
        };
      }
      return response.data;
    } catch (err) {
      return { success: true, ...deliverySettingsCache.data };
    }
  },

  // Get commission transaction reports with multi-filters (Admin)
  getAdminCommissionReports: async (params = {}) => {
    const response = await API.get('/admin/commission-reports', { params });
    return response.data;
  },
};

export default commissionService;
