import express from 'express';
import {
  getSupportSettings,
  updateSupportSettings,
} from '../controllers/supportController.js';

const router = express.Router();

router.get('/', getSupportSettings);
router.put('/', updateSupportSettings);

export default router;
