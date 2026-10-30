import VehicleType from '../models/VehicleType.model.js';

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/transport/vehicles
// Public — no auth required
// Returns all active vehicle types sorted by sortOrder
// ──────────────────────────────────────────────────────────────────────────────
export const getActiveVehicles = async (req, res, next) => {
  try {
    const vehicles = await VehicleType.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/transport/vehicles/:id
// Public — no auth required
// Returns a single vehicle type by ID (for fare estimate re-validation)
// ──────────────────────────────────────────────────────────────────────────────
export const getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await VehicleType.findOne({
      _id: req.params.id,
      isActive: true,
    }).select('-__v');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle type not found or is currently unavailable',
      });
    }

    res.status(200).json({ success: true, vehicle });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN: GET /api/transport/vehicles/admin/all or /api/pricing/admin/vehicles
// Protected (admin, super_admin)
// Returns all vehicle types (active and inactive)
// ──────────────────────────────────────────────────────────────────────────────
export const getAllVehiclesAdmin = async (req, res, next) => {
  try {
    const vehicles = await VehicleType.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN: POST /api/pricing/admin/vehicles
// Protected (admin, super_admin)
// Creates a new vehicle type with custom pricing
// ──────────────────────────────────────────────────────────────────────────────
export const createVehicleType = async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description,
      capacityKg,
      dimensions,
      suitableFor,
      vehicleCategory,
      imageUrl,
      speedKmH,
      icon,
      baseFare,
      perKmFare,
      minimumFare,
      platformFee,
      isActive,
      sortOrder,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Vehicle name is required' });
    }

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await VehicleType.findOne({ slug: finalSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Vehicle type with slug '${finalSlug}' already exists`,
      });
    }

    const newVehicle = await VehicleType.create({
      name: name.trim(),
      slug: finalSlug,
      description: (description || '').trim(),
      capacityKg: Number(capacityKg || 50),
      dimensions: (dimensions || '').trim(),
      suitableFor: (suitableFor || '').trim(),
      vehicleCategory: vehicleCategory || '3_wheeler',
      imageUrl: (imageUrl || '').trim(),
      speedKmH: Number(speedKmH || 30),
      icon: icon || 'truck',
      baseFare: Number(baseFare || 40),
      perKmFare: Number(perKmFare || 10),
      minimumFare: Number(minimumFare || 60),
      platformFee: Number(platformFee || 10),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      sortOrder: Number(sortOrder || 0),
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle type created successfully',
      vehicle: newVehicle,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN: PUT /api/pricing/admin/vehicles/:id
// Protected (admin, super_admin)
// Updates vehicle type pricing and details
// ──────────────────────────────────────────────────────────────────────────────
export const updateVehiclePricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      capacityKg,
      dimensions,
      suitableFor,
      vehicleCategory,
      imageUrl,
      speedKmH,
      icon,
      baseFare,
      perKmFare,
      minimumFare,
      platformFee,
      isActive,
      sortOrder,
    } = req.body;

    const vehicle = await VehicleType.findById(id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle type not found' });
    }

    if (name !== undefined) vehicle.name = name.trim();
    if (slug !== undefined) vehicle.slug = slug.trim().toLowerCase();
    if (description !== undefined) vehicle.description = description.trim();
    if (capacityKg !== undefined) vehicle.capacityKg = Number(capacityKg);
    if (dimensions !== undefined) vehicle.dimensions = dimensions.trim();
    if (suitableFor !== undefined) vehicle.suitableFor = suitableFor.trim();
    if (vehicleCategory !== undefined) vehicle.vehicleCategory = vehicleCategory;
    if (imageUrl !== undefined) vehicle.imageUrl = imageUrl.trim();
    if (speedKmH !== undefined) vehicle.speedKmH = Number(speedKmH);
    if (icon !== undefined) vehicle.icon = icon;
    if (baseFare !== undefined) vehicle.baseFare = Number(baseFare);
    if (perKmFare !== undefined) vehicle.perKmFare = Number(perKmFare);
    if (minimumFare !== undefined) vehicle.minimumFare = Number(minimumFare);
    if (platformFee !== undefined) vehicle.platformFee = Number(platformFee);
    if (isActive !== undefined) vehicle.isActive = Boolean(isActive);
    if (sortOrder !== undefined) vehicle.sortOrder = Number(sortOrder);

    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Vehicle pricing updated successfully',
      vehicle,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN: DELETE /api/pricing/admin/vehicles/:id
// Protected (admin, super_admin)
// Deletes a vehicle type
// ──────────────────────────────────────────────────────────────────────────────
export const deleteVehicleType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vehicle = await VehicleType.findByIdAndDelete(id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle type not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Vehicle type deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
