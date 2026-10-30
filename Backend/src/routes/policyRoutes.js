import express from 'express';
import {
  getPolicies,
  getPolicyByTargetAndType,
  saveOrUpdatePolicy,
  deletePolicy,
} from '../controllers/policyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes for all users, sellers, captains to view policies
router.get('/', getPolicies);
router.get('/:target/:type', getPolicyByTargetAndType);

// Admin management routes to create / edit / update policies
router.post('/', protect('admin'), saveOrUpdatePolicy);
router.put('/', protect('admin'), saveOrUpdatePolicy);
router.delete('/:id', protect('admin'), deletePolicy);

export default router;
