import API from './api';

export const productReviewService = {
  // Submit a new review or update existing review for a product in an order
  submitReview: async ({ productId, orderId, rating, review = '', images = [], feedbackTags = [] }) => {
    try {
      const response = await API.post('/reviews', {
        productId,
        orderId,
        rating,
        review,
        images,
        feedbackTags,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Get public reviews and rating statistics / star distribution for a product
  getProductReviews: async (productId, page = 1, limit = 10) => {
    try {
      const response = await API.get(`/reviews/product/${productId}?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Get review status for all items in an order (returns map: { [productId]: reviewDoc })
  getOrderReviewStatus: async (orderId) => {
    try {
      const response = await API.get(`/reviews/order/${orderId}/status`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Get all reviews written by current user
  getUserReviews: async () => {
    try {
      const response = await API.get('/reviews/user');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Update an existing review
  updateReview: async (reviewId, { rating, review, images, feedbackTags }) => {
    try {
      const response = await API.put(`/reviews/${reviewId}`, {
        rating,
        review,
        images,
        feedbackTags,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Delete an existing review
  deleteReview: async (reviewId) => {
    try {
      const response = await API.delete(`/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Upload review photo
  uploadPhoto: async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await API.post('/upload?folder=reviews', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data?.imageUrl || response.data?.url || '';
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },
};

export default productReviewService;
