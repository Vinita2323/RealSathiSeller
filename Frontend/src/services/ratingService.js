import API from './api';

export const ratingService = {
  // Submit a 1-5 star rating & optional review/feedback for a completed ride
  submitRating: async ({ rideId, rating, review = '', feedbackTags = [] }) => {
    try {
      const response = await API.post('/ratings', {
        rideId,
        rating,
        review,
        feedbackTags,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Get existing rating status for a ride
  getRideRatingStatus: async (rideId) => {
    try {
      const response = await API.get(`/ratings/ride/${rideId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },

  // Get detailed rating breakdown & review statistics for a Captain or User
  getRatingBreakdown: async (type, id) => {
    try {
      const response = await API.get(`/ratings/stats/${type}/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message || error;
    }
  },
};

export default ratingService;
