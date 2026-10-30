import API from './api';
import { mockFaqs } from '../modules/admin/mock/adminMockData';

export const faqService = {
  // Get public FAQs (always live from server with fallback)
  getPublicFaqs: async () => {
    try {
      const response = await API.get('/faqs');
      if (response.data && response.data.success && Array.isArray(response.data.faqs)) {
        return response.data;
      }
      return { success: true, faqs: mockFaqs };
    } catch (error) {
      console.warn('Using default FAQs fallback:', error);
      return { success: true, faqs: mockFaqs };
    }
  },

  // Get Admin FAQs
  getAdminFaqs: async () => {
    try {
      const response = await API.get('/faqs/admin');
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch admin FAQs from server:', error);
      return { success: true, faqs: mockFaqs };
    }
  },

  // Create FAQ
  createFaq: async (faqData) => {
    try {
      const response = await API.post('/faqs', faqData);
      cachedFaqsList = null;
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Update FAQ
  updateFaq: async (id, faqData) => {
    try {
      const response = await API.put(`/faqs/${id}`, faqData);
      cachedFaqsList = null;
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Delete FAQ
  deleteFaq: async (id) => {
    try {
      const response = await API.delete(`/faqs/${id}`);
      cachedFaqsList = null;
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },
};

export default faqService;
