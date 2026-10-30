import express from 'express';
import {
  getPublicFaqs,
  getAdminFaqs,
  createFaq,
  updateFaq,
  deleteFaq
} from '../controllers/faqController.js';

const router = express.Router();

// Public routes
router.get('/', getPublicFaqs);

// Admin routes
router.get('/admin', getAdminFaqs);
router.post('/', createFaq);
router.put('/:id', updateFaq);
router.delete('/:id', deleteFaq);

export default router;
