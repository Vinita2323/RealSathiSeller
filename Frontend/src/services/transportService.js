import API from './api';

export const transportService = {
  // Get all active vehicle types and pricing
  getVehicles: async () => {
    try {
      const response = await API.get('/transport/vehicles');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get dynamic fare estimate based on location and vehicle
  getFareEstimate: async (bookingData) => {
    try {
      const response = await API.post('/transport/bookings/fare-estimate', bookingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Create a new transport booking (Direct / Cash on Delivery)
  createBooking: async (bookingData) => {
    try {
      const response = await API.post('/transport/bookings', bookingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Create a Razorpay payment order for online payment
  createPaymentOrder: async (bookingData) => {
    try {
      const response = await API.post('/transport/bookings/create-payment-order', bookingData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Verify Razorpay payment and confirm transport booking
  verifyPayment: async (paymentData) => {
    try {
      const response = await API.post('/transport/bookings/verify-payment', paymentData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get user's past bookings
  getUserBookings: async (params = {}) => {
    try {
      const response = await API.get('/transport/bookings', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get the current active booking
  getActiveBooking: async () => {
    try {
      const response = await API.get('/transport/bookings/active');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get specific booking details
  getBookingDetails: async (bookingId) => {
    try {
      const response = await API.get(`/transport/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Cancel a pending booking
  cancelBooking: async (bookingId, reason = '') => {
    try {
      const response = await API.put(`/transport/bookings/${bookingId}/cancel`, { reason });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // ── Captain Transport APIs ────────────────────────────────────────────────
  captainGetRequests: async () => {
    try {
      const response = await API.get('/captain/transport/requests');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainAcceptRequest: async (bookingId) => {
    try {
      const response = await API.put(`/captain/transport/requests/${bookingId}/accept`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainRejectRequest: async (bookingId) => {
    try {
      const response = await API.put(`/captain/transport/requests/${bookingId}/reject`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainGetActiveRide: async () => {
    try {
      const response = await API.get('/captain/transport/active');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainUpdateStatus: async (bookingId, status) => {
    try {
      const response = await API.put(`/captain/transport/active/${bookingId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainVerifyPickupOtp: async (bookingId, otp) => {
    try {
      const response = await API.post(`/captain/transport/active/${bookingId}/verify-pickup-otp`, { otp });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainVerifyDropOtp: async (bookingId, otp, proofUrl = '') => {
    try {
      const response = await API.post(`/captain/transport/active/${bookingId}/verify-drop-otp`, { otp, proofUrl });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainSubmitProof: async (bookingId, proofUrl) => {
    try {
      const response = await API.post(`/captain/transport/active/${bookingId}/proof`, { proofUrl });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  uploadTransportPhoto: async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await API.post('/upload?folder=transport', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainUploadPickupPhotos: async (bookingId, photos) => {
    try {
      const response = await API.post(`/captain/transport/active/${bookingId}/pickup-photos`, { photos });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainUploadDropPhotos: async (bookingId, photos) => {
    try {
      const response = await API.post(`/captain/transport/active/${bookingId}/drop-photos`, { photos });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainUpdateLocation: async (bookingId, location) => {
    try {
      const response = await API.post(`/captain/transport/active/${bookingId}/location`, location);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  captainCompleteReturn: async (bookingId) => {
    try {
      const response = await API.post(`/captain/transport/active/${bookingId}/return/complete`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};
