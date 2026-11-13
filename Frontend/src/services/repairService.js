import axios from 'axios';
import { getBaseApiUrl } from './api';
import { bannerService } from './authService';

/**
 * Repair & Services API client.
 * Uses its own axios instance so it never interferes with the shared API interceptors;
 * each call picks the token of the role that is using it.
 */
const TOKEN_KEYS = {
  user: ['sathiseller_user_token'],
  captain: ['sathiseller_captain_token'],
  admin: ['sathiseller_admin_token', 'sathiseller_super_admin_token'],
  technician: ['sathiseller_technician_token'],
};

const repairApi = axios.create({
  baseURL: `${getBaseApiUrl()}/repair`,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const readToken = (role) => {
  for (const key of TOKEN_KEYS[role] || []) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }
  return null;
};

const call = async (role, method, url, data) => {
  const token = readToken(role);
  const res = await repairApi.request({
    method,
    url,
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data;
};

export const repairErrorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.response?.data?.message || err?.message || fallback;

export const repairService = {
  // Public / customer
  getCatalog: () => call('user', 'get', '/catalog'),
  createBooking: (payload) => call('user', 'post', '/bookings', payload),
  getMyBookings: () => call('user', 'get', '/bookings'),
  getMyBooking: (id) => call('user', 'get', `/bookings/${id}`),
  respondToQuotation: (id, action, note = '') => call('user', 'put', `/bookings/${id}/quotation`, { action, note }),
  cancelMyBooking: (id, reason = '') => call('user', 'put', `/bookings/${id}/cancel`, { reason }),
  uploadPhoto: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await bannerService.uploadImage(fd, 'misc');
    return res?.imageUrl || res?.filePath || '';
  },

  // Captain (rider)
  captain: {
    getPending: () => call('captain', 'get', '/captain/pending'),
    getJobs: (tab = 'pickups') => call('captain', 'get', `/captain/jobs?tab=${tab}`),
    accept: (id) => call('captain', 'put', `/captain/jobs/${id}/accept`),
    reject: (id, reason = '') => call('captain', 'put', `/captain/jobs/${id}/reject`, { reason }),
    startRide: (id) => call('captain', 'put', `/captain/jobs/${id}/start-ride`),
    reached: (id) => call('captain', 'put', `/captain/jobs/${id}/reached`),
    verifyPickupOtp: (id, otp) => call('captain', 'post', `/captain/jobs/${id}/verify-pickup-otp`, { otp }),
    handover: (id) => call('captain', 'put', `/captain/jobs/${id}/handover`),
    collect: (id) => call('captain', 'put', `/captain/jobs/${id}/collect`),
    verifyDeliveryOtp: (id, otp, paymentMethod = 'CASH') =>
      call('captain', 'post', `/captain/jobs/${id}/verify-delivery-otp`, { otp, paymentMethod }),
  },

  // Technician
  technician: {
    login: async (phone, password) => {
      const res = await repairApi.post('/technician/login', { phone, password });
      return res.data;
    },
    me: () => call('technician', 'get', '/technician/me'),
    getJobs: (tab = 'active') => call('technician', 'get', `/technician/jobs?tab=${tab}`),
    getJob: (id) => call('technician', 'get', `/technician/jobs/${id}`),
    submitQuotation: (id, payload) => call('technician', 'put', `/technician/jobs/${id}/quotation`, payload),
    startRepair: (id) => call('technician', 'put', `/technician/jobs/${id}/start-repair`),
    complete: (id, repairNotes = '') => call('technician', 'put', `/technician/jobs/${id}/complete`, { repairNotes }),
  },

  // Admin
  admin: {
    getNewRequests: () => call('admin', 'get', '/admin/new-requests'),
    listBookings: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      return call('admin', 'get', `/admin/bookings${qs ? `?${qs}` : ''}`);
    },
    getBooking: (id) => call('admin', 'get', `/admin/bookings/${id}`),
    assignPickup: (id, captainId) => call('admin', 'put', `/admin/bookings/${id}/assign-pickup`, { captainId }),
    assignDelivery: (id, captainId) => call('admin', 'put', `/admin/bookings/${id}/assign-delivery`, { captainId }),
    assignCenter: (id, centerId) => call('admin', 'put', `/admin/bookings/${id}/assign-center`, { centerId }),
    assignTechnician: (id, technicianId) => call('admin', 'put', `/admin/bookings/${id}/assign-technician`, { technicianId }),
    cancel: (id, reason = '') => call('admin', 'put', `/admin/bookings/${id}/cancel`, { reason }),
    listRiders: () => call('admin', 'get', '/admin/riders'),

    listDrivers: () => call('admin', 'get', '/admin/drivers'),
    createDriver: (data) => call('admin', 'post', '/admin/drivers', data),
    updateDriver: (id, data) => call('admin', 'put', `/admin/drivers/${id}`, data),
    deleteDriver: (id) => call('admin', 'delete', `/admin/drivers/${id}`),

    listTechnicians: () => call('admin', 'get', '/admin/technicians'),
    createTechnician: (data) => call('admin', 'post', '/admin/technicians', data),
    updateTechnician: (id, data) => call('admin', 'put', `/admin/technicians/${id}`, data),
    deleteTechnician: (id) => call('admin', 'delete', `/admin/technicians/${id}`),

    listCenters: () => call('admin', 'get', '/admin/centers'),
    createCenter: (data) => call('admin', 'post', '/admin/centers', data),
    updateCenter: (id, data) => call('admin', 'put', `/admin/centers/${id}`, data),
    deleteCenter: (id) => call('admin', 'delete', `/admin/centers/${id}`),

    listCategories: () => call('admin', 'get', '/admin/categories'),
    createCategory: (data) => call('admin', 'post', '/admin/categories', data),
    updateCategory: (id, data) => call('admin', 'put', `/admin/categories/${id}`, data),
    deleteCategory: (id) => call('admin', 'delete', `/admin/categories/${id}`),

    getContent: () => call('admin', 'get', '/admin/content'),
    updateContent: (hero) => call('admin', 'put', '/admin/content', { hero }),

    getReportSummary: () => call('admin', 'get', '/admin/reports/summary'),
  },
};

// Shared status presentation used by customer / captain / admin / technician screens
export const REPAIR_STATUS_LABELS = {
  REQUESTED: 'Booking Requested',
  PICKUP_ASSIGNED: 'Pickup Rider Assigned',
  PICKUP_ACCEPTED: 'Pickup Accepted',
  PICKUP_STARTED: 'Rider On The Way',
  REACHED_CUSTOMER: 'Rider Reached You',
  PICKED_UP: 'Picked Up',
  AT_REPAIR_CENTER: 'At Repair Center',
  DIAGNOSING: 'Diagnosis In Progress',
  QUOTATION_SENT: 'Quotation Ready',
  QUOTATION_APPROVED: 'Quotation Approved',
  QUOTATION_REJECTED: 'Quotation Rejected',
  IN_REPAIR: 'Repair In Progress',
  REPAIR_COMPLETED: 'Repair Completed',
  DELIVERY_ASSIGNED: 'Delivery Rider Assigned',
  DELIVERY_ACCEPTED: 'Delivery Rider Accepted',
  OUT_FOR_DELIVERY: 'Out For Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const REPAIR_STATUS_TONE = {
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  QUOTATION_REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  QUOTATION_SENT: 'bg-amber-50 text-amber-700 border-amber-200',
};
export const repairStatusTone = (status) =>
  REPAIR_STATUS_TONE[status] || 'bg-orange-50 text-[#ea580c] border-orange-200';

// Used until the admin-managed content loads (and if it fails to load)
export const DEFAULT_REPAIR_HERO = {
  enabled: true,
  title: 'We pick up. We repair. We deliver.',
  subtitle: 'Free doorstep pickup. Pay only after you approve the quotation.',
  features: ['Doorstep pickup', 'Approve quotation', 'OTP delivery'],
};

export const FINAL_REPAIR_STATUSES = ['DELIVERED', 'CANCELLED'];

export default repairService;
