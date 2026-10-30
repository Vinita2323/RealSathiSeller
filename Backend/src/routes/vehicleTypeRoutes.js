import express from 'express';
import {
  getActiveVehicles,
  getVehicleById,
  getAllVehiclesAdmin,
  createVehicleType,
  updateVehiclePricing,
  deleteVehicleType,
} from '../controllers/vehicleTypeController.js';

const router = express.Router();

// GET /api/transport/vehicles        — list all active vehicle types (public)
router.get('/', getActiveVehicles);

// GET /api/transport/vehicles/admin/all — list all vehicle types including inactive
router.get('/admin/all', getAllVehiclesAdmin);

// POST /api/transport/vehicles       — create new vehicle type
router.post('/', createVehicleType);

// GET /api/transport/vehicles/:id    — get single vehicle type (public)
router.get('/:id', getVehicleById);

// PUT /api/transport/vehicles/:id    — update vehicle type
router.put('/:id', updateVehiclePricing);

// DELETE /api/transport/vehicles/:id — delete vehicle type
router.delete('/:id', deleteVehicleType);

export default router;
