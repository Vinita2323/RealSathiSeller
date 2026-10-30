import express from 'express';

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Sathi Seller Backend API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

export default router;
