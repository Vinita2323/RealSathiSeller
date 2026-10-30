import TransportPricing from '../models/TransportPricing.model.js';
import DeliveryPricing from '../models/DeliveryPricing.model.js';
import CommissionSettings from '../models/CommissionSettings.model.js';
import VehicleType from '../models/VehicleType.model.js';
import { calculateFare } from '../utils/fareCalculator.js';

// ==============================================================================
// Helper: Sync Delivery Pricing to CommissionSettings
// ==============================================================================
const syncCommissionDeliverySettings = async (deliveryConfig, updatedBy = 'Admin') => {
  try {
    if (!deliveryConfig) return;
    const commSettings = await CommissionSettings.getOrCreateActiveSettings();
    if (commSettings) {
      commSettings.deliveryCharge = Number(deliveryConfig.baseDeliveryFee ?? 40);
      commSettings.freeDeliveryMinOrder = Number(deliveryConfig.freeDeliveryThreshold ?? 500);
      commSettings.isFreeDeliveryEnabled = Boolean(deliveryConfig.isFreeDeliveryEnabled ?? true);
      if (deliveryConfig.codCharge !== undefined) {
        commSettings.codCharge = Number(deliveryConfig.codCharge);
      }
      if (deliveryConfig.isCodChargeEnabled !== undefined) {
        commSettings.isCodChargeEnabled = Boolean(deliveryConfig.isCodChargeEnabled);
      }
      commSettings.updatedBy = updatedBy;
      await commSettings.save();
    }
  } catch (err) {
    console.warn('[PricingController] Could not sync delivery settings to CommissionSettings:', err.message);
  }
};

// ==============================================================================
// ADMIN: Get All Pricing Configurations (Both Transport and Delivery)
// ==============================================================================
export const getAllPricingConfigs = async (req, res, next) => {
  try {
    const [activeTransport, allTransport, activeDelivery, allDelivery, allVehicles] = await Promise.all([
      TransportPricing.getActiveConfig(),
      TransportPricing.find().sort({ isActive: -1, updatedAt: -1 }).lean(),
      DeliveryPricing.getActiveConfig(),
      DeliveryPricing.find().sort({ isActive: -1, updatedAt: -1 }).lean(),
      VehicleType.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    ]);

    res.status(200).json({
      success: true,
      transport: {
        active: activeTransport,
        list: allTransport,
        totalCount: allTransport.length,
      },
      delivery: {
        active: activeDelivery,
        list: allDelivery,
        totalCount: allDelivery.length,
      },
      vehicles: allVehicles,
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// TRANSPORT PRICING CONTROLLERS
// ==============================================================================

// @desc    Get Transport Pricing List & Active Config
// @route   GET /api/admin/pricing/transport
export const getTransportPricing = async (req, res, next) => {
  try {
    const [active, list] = await Promise.all([
      TransportPricing.getActiveConfig(),
      TransportPricing.find().sort({ isActive: -1, updatedAt: -1 }).lean(),
    ]);

    res.status(200).json({
      success: true,
      active,
      list,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create New Transport Pricing Configuration
// @route   POST /api/admin/pricing/transport
export const createTransportPricing = async (req, res, next) => {
  try {
    const {
      configName,
      description,
      baseFare,
      perKmFare,
      minimumFare,
      waitingChargePerMin,
      additionalStopCharge,
      platformFee = 10,
      nightPeakPricing,
      isActive = false,
      reason,
    } = req.body;

    const adminIdentifier = req.user?.email || req.user?.name || 'Admin';

    // Validate non-negative numbers
    if (baseFare === undefined || Number(baseFare) < 0) {
      return res.status(400).json({ success: false, message: 'Base fare must be a non-negative number.' });
    }
    if (perKmFare === undefined || Number(perKmFare) < 0) {
      return res.status(400).json({ success: false, message: 'Per KM charge must be a non-negative number.' });
    }
    if (minimumFare === undefined || Number(minimumFare) < 0) {
      return res.status(400).json({ success: false, message: 'Minimum fare must be a non-negative number.' });
    }
    if (waitingChargePerMin === undefined || Number(waitingChargePerMin) < 0) {
      return res.status(400).json({ success: false, message: 'Waiting charge per minute must be a non-negative number.' });
    }
    if (additionalStopCharge === undefined || Number(additionalStopCharge) < 0) {
      return res.status(400).json({ success: false, message: 'Additional stop charge must be a non-negative number.' });
    }
    if (platformFee !== undefined && Number(platformFee) < 0) {
      return res.status(400).json({ success: false, message: 'Platform fee cannot be negative.' });
    }

    // If marked active, deactivate all existing transport configurations
    if (Boolean(isActive)) {
      await TransportPricing.updateMany({}, { $set: { isActive: false } });
    }

    const newConfig = new TransportPricing({
      configName: configName?.trim() || 'Custom Transport Pricing',
      description: description?.trim() || '',
      baseFare: Number(baseFare),
      perKmFare: Number(perKmFare),
      minimumFare: Number(minimumFare),
      waitingChargePerMin: Number(waitingChargePerMin),
      additionalStopCharge: Number(additionalStopCharge),
      platformFee: Number(platformFee),
      nightPeakPricing: {
        enabled: Boolean(nightPeakPricing?.enabled),
        surgeMultiplier: Number(nightPeakPricing?.surgeMultiplier || 1.25),
        surgeFlat: Number(nightPeakPricing?.surgeFlat || 0),
        startHour: nightPeakPricing?.startHour || '22:00',
        endHour: nightPeakPricing?.endHour || '06:00',
        description: nightPeakPricing?.description || 'Night / Peak hours surcharge',
      },
      isActive: Boolean(isActive),
      updatedBy: adminIdentifier,
      history: [
        {
          baseFare: Number(baseFare),
          perKmFare: Number(perKmFare),
          minimumFare: Number(minimumFare),
          waitingChargePerMin: Number(waitingChargePerMin),
          additionalStopCharge: Number(additionalStopCharge),
          platformFee: Number(platformFee),
          nightPeakPricing: {
            enabled: Boolean(nightPeakPricing?.enabled),
            surgeMultiplier: Number(nightPeakPricing?.surgeMultiplier || 1.25),
            surgeFlat: Number(nightPeakPricing?.surgeFlat || 0),
            startHour: nightPeakPricing?.startHour || '22:00',
            endHour: nightPeakPricing?.endHour || '06:00',
            description: nightPeakPricing?.description || 'Night / Peak hours surcharge',
          },
          isActive: Boolean(isActive),
          changedBy: adminIdentifier,
          changedAt: new Date(),
          reason: reason?.trim() || 'Created new transport pricing schedule',
        },
      ],
    });

    await newConfig.save();

    res.status(201).json({
      success: true,
      message: 'Transport pricing configuration created successfully.',
      config: newConfig,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Existing Transport Pricing Configuration
// @route   PUT /api/admin/pricing/transport/:id
export const updateTransportPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      configName,
      description,
      baseFare,
      perKmFare,
      minimumFare,
      waitingChargePerMin,
      additionalStopCharge,
      platformFee,
      nightPeakPricing,
      returnToPickup,
      isActive,
      reason,
    } = req.body;

    const adminIdentifier = req.user?.email || req.user?.name || 'Admin';

    const config = await TransportPricing.findById(id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Transport pricing configuration not found.' });
    }

    if (baseFare !== undefined) {
      if (Number(baseFare) < 0) return res.status(400).json({ success: false, message: 'Base fare cannot be negative.' });
      config.baseFare = Number(baseFare);
    }
    if (perKmFare !== undefined) {
      if (Number(perKmFare) < 0) return res.status(400).json({ success: false, message: 'Per KM charge cannot be negative.' });
      config.perKmFare = Number(perKmFare);
    }
    if (minimumFare !== undefined) {
      if (Number(minimumFare) < 0) return res.status(400).json({ success: false, message: 'Minimum fare cannot be negative.' });
      config.minimumFare = Number(minimumFare);
    }
    if (waitingChargePerMin !== undefined) {
      if (Number(waitingChargePerMin) < 0) return res.status(400).json({ success: false, message: 'Waiting charge per minute cannot be negative.' });
      config.waitingChargePerMin = Number(waitingChargePerMin);
    }
    if (additionalStopCharge !== undefined) {
      if (Number(additionalStopCharge) < 0) return res.status(400).json({ success: false, message: 'Additional stop charge cannot be negative.' });
      config.additionalStopCharge = Number(additionalStopCharge);
    }
    if (platformFee !== undefined) {
      if (Number(platformFee) < 0) return res.status(400).json({ success: false, message: 'Platform fee cannot be negative.' });
      config.platformFee = Number(platformFee);
    }
    if (returnToPickup !== undefined) {
      config.returnToPickup = Boolean(returnToPickup);
    }

    if (configName !== undefined) config.configName = configName.trim();
    if (description !== undefined) config.description = description.trim();

    if (nightPeakPricing !== undefined) {
      config.nightPeakPricing = {
        enabled: Boolean(nightPeakPricing.enabled),
        surgeMultiplier: Number(nightPeakPricing.surgeMultiplier ?? config.nightPeakPricing.surgeMultiplier ?? 1.25),
        surgeFlat: Number(nightPeakPricing.surgeFlat ?? config.nightPeakPricing.surgeFlat ?? 0),
        startHour: nightPeakPricing.startHour || config.nightPeakPricing.startHour || '22:00',
        endHour: nightPeakPricing.endHour || config.nightPeakPricing.endHour || '06:00',
        description: nightPeakPricing.description || config.nightPeakPricing.description || 'Night / Peak hours surcharge',
      };
    }

    if (isActive !== undefined && Boolean(isActive) !== config.isActive) {
      if (Boolean(isActive)) {
        await TransportPricing.updateMany({ _id: { $ne: id } }, { $set: { isActive: false } });
        config.isActive = true;
      } else {
        // If deactivating, ensure at least one config stays active
        const otherConfigs = await TransportPricing.countDocuments({ _id: { $ne: id } });
        if (otherConfigs === 0) {
          return res.status(400).json({ success: false, message: 'Cannot deactivate the only transport pricing configuration. Create another active configuration first.' });
        }
        config.isActive = false;
      }
    }

    config.updatedBy = adminIdentifier;

    config.history.unshift({
      baseFare: config.baseFare,
      perKmFare: config.perKmFare,
      minimumFare: config.minimumFare,
      waitingChargePerMin: config.waitingChargePerMin,
      additionalStopCharge: config.additionalStopCharge,
      platformFee: config.platformFee,
      nightPeakPricing: config.nightPeakPricing,
      isActive: config.isActive,
      changedBy: adminIdentifier,
      changedAt: new Date(),
      reason: reason?.trim() || 'Admin updated transport pricing configuration',
    });

    if (config.history.length > 50) config.history = config.history.slice(0, 50);

    await config.save();

    res.status(200).json({
      success: true,
      message: 'Transport pricing configuration updated successfully.',
      config,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate a Transport Pricing Configuration
// @route   PATCH /api/admin/pricing/transport/:id/activate
export const activateTransportPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminIdentifier = req.user?.email || req.user?.name || 'Admin';

    const config = await TransportPricing.findById(id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Transport pricing configuration not found.' });
    }

    // Set all others to inactive
    await TransportPricing.updateMany({ _id: { $ne: id } }, { $set: { isActive: false } });

    config.isActive = true;
    config.updatedBy = adminIdentifier;
    config.history.unshift({
      baseFare: config.baseFare,
      perKmFare: config.perKmFare,
      minimumFare: config.minimumFare,
      waitingChargePerMin: config.waitingChargePerMin,
      additionalStopCharge: config.additionalStopCharge,
      platformFee: config.platformFee,
      nightPeakPricing: config.nightPeakPricing,
      isActive: true,
      changedBy: adminIdentifier,
      changedAt: new Date(),
      reason: `Activated as primary transport pricing matrix by ${adminIdentifier}`,
    });

    await config.save();

    res.status(200).json({
      success: true,
      message: `"${config.configName}" is now the active transport pricing configuration.`,
      config,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Transport Pricing Configuration
// @route   DELETE /api/admin/pricing/transport/:id
export const deleteTransportPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = await TransportPricing.findById(id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Transport pricing configuration not found.' });
    }

    if (config.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active transport pricing configuration. Please activate another configuration before deleting this one.',
      });
    }

    await TransportPricing.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Transport pricing configuration deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// DELIVERY PRICING CONTROLLERS
// ==============================================================================

// @desc    Get Delivery Pricing List & Active Config
// @route   GET /api/admin/pricing/delivery
export const getDeliveryPricing = async (req, res, next) => {
  try {
    const [active, list] = await Promise.all([
      DeliveryPricing.getActiveConfig(),
      DeliveryPricing.find().sort({ isActive: -1, updatedAt: -1 }).lean(),
    ]);

    res.status(200).json({
      success: true,
      active,
      list,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create New Delivery Pricing Configuration
// @route   POST /api/admin/pricing/delivery
export const createDeliveryPricing = async (req, res, next) => {
  try {
    const {
      configName,
      description,
      baseDeliveryFee,
      perKmDeliveryCharge,
      minimumDeliveryFee,
      freeDeliveryThreshold,
      isFreeDeliveryEnabled = true,
      extraDistanceCharge,
      thresholdDistanceKm = 5,
      peakSurge,
      isActive = false,
      reason,
    } = req.body;

    const adminIdentifier = req.user?.email || req.user?.name || 'Admin';

    // Validate non-negative numbers
    if (baseDeliveryFee === undefined || Number(baseDeliveryFee) < 0) {
      return res.status(400).json({ success: false, message: 'Base delivery fee must be a non-negative number.' });
    }
    if (perKmDeliveryCharge === undefined || Number(perKmDeliveryCharge) < 0) {
      return res.status(400).json({ success: false, message: 'Per KM delivery charge must be a non-negative number.' });
    }
    if (minimumDeliveryFee === undefined || Number(minimumDeliveryFee) < 0) {
      return res.status(400).json({ success: false, message: 'Minimum delivery fee must be a non-negative number.' });
    }
    if (freeDeliveryThreshold === undefined || Number(freeDeliveryThreshold) < 0) {
      return res.status(400).json({ success: false, message: 'Free delivery threshold must be a non-negative number.' });
    }
    if (extraDistanceCharge === undefined || Number(extraDistanceCharge) < 0) {
      return res.status(400).json({ success: false, message: 'Extra distance charge must be a non-negative number.' });
    }
    if (thresholdDistanceKm === undefined || Number(thresholdDistanceKm) < 0) {
      return res.status(400).json({ success: false, message: 'Threshold distance must be a non-negative number.' });
    }

    if (Boolean(isActive)) {
      await DeliveryPricing.updateMany({}, { $set: { isActive: false } });
    }

    const newConfig = new DeliveryPricing({
      configName: configName?.trim() || 'Custom Delivery Pricing',
      description: description?.trim() || '',
      baseDeliveryFee: Number(baseDeliveryFee),
      perKmDeliveryCharge: Number(perKmDeliveryCharge),
      minimumDeliveryFee: Number(minimumDeliveryFee),
      freeDeliveryThreshold: Number(freeDeliveryThreshold),
      isFreeDeliveryEnabled: Boolean(isFreeDeliveryEnabled),
      extraDistanceCharge: Number(extraDistanceCharge),
      thresholdDistanceKm: Number(thresholdDistanceKm),
      peakSurge: {
        enabled: Boolean(peakSurge?.enabled),
        surgeAmount: Number(peakSurge?.surgeAmount || 0),
        surgeMultiplier: Number(peakSurge?.surgeMultiplier || 1.0),
        description: peakSurge?.description || 'Peak / Bad Weather Delivery Surge',
      },
      isActive: Boolean(isActive),
      updatedBy: adminIdentifier,
      history: [
        {
          baseDeliveryFee: Number(baseDeliveryFee),
          perKmDeliveryCharge: Number(perKmDeliveryCharge),
          minimumDeliveryFee: Number(minimumDeliveryFee),
          freeDeliveryThreshold: Number(freeDeliveryThreshold),
          isFreeDeliveryEnabled: Boolean(isFreeDeliveryEnabled),
          extraDistanceCharge: Number(extraDistanceCharge),
          thresholdDistanceKm: Number(thresholdDistanceKm),
          peakSurge: {
            enabled: Boolean(peakSurge?.enabled),
            surgeAmount: Number(peakSurge?.surgeAmount || 0),
            surgeMultiplier: Number(peakSurge?.surgeMultiplier || 1.0),
            description: peakSurge?.description || 'Peak / Bad Weather Delivery Surge',
          },
          isActive: Boolean(isActive),
          changedBy: adminIdentifier,
          changedAt: new Date(),
          reason: reason?.trim() || 'Created new delivery pricing schedule',
        },
      ],
    });

    await newConfig.save();

    if (newConfig.isActive) {
      await syncCommissionDeliverySettings(newConfig, adminIdentifier);
    }

    res.status(201).json({
      success: true,
      message: 'Delivery pricing configuration created successfully.',
      config: newConfig,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Existing Delivery Pricing Configuration
// @route   PUT /api/admin/pricing/delivery/:id
export const updateDeliveryPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      configName,
      description,
      baseDeliveryFee,
      perKmDeliveryCharge,
      minimumDeliveryFee,
      freeDeliveryThreshold,
      isFreeDeliveryEnabled,
      codCharge,
      isCodChargeEnabled,
      extraDistanceCharge,
      thresholdDistanceKm,
      peakSurge,
      isActive,
      reason,
    } = req.body;

    const adminIdentifier = req.user?.email || req.user?.name || 'Admin';

    const config = await DeliveryPricing.findById(id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Delivery pricing configuration not found.' });
    }

    if (baseDeliveryFee !== undefined) {
      if (Number(baseDeliveryFee) < 0) return res.status(400).json({ success: false, message: 'Base delivery fee cannot be negative.' });
      config.baseDeliveryFee = Number(baseDeliveryFee);
    }
    if (perKmDeliveryCharge !== undefined) {
      if (Number(perKmDeliveryCharge) < 0) return res.status(400).json({ success: false, message: 'Per KM delivery charge cannot be negative.' });
      config.perKmDeliveryCharge = Number(perKmDeliveryCharge);
    }
    if (minimumDeliveryFee !== undefined) {
      if (Number(minimumDeliveryFee) < 0) return res.status(400).json({ success: false, message: 'Minimum delivery fee cannot be negative.' });
      config.minimumDeliveryFee = Number(minimumDeliveryFee);
    }
    if (freeDeliveryThreshold !== undefined) {
      if (Number(freeDeliveryThreshold) < 0) return res.status(400).json({ success: false, message: 'Free delivery threshold cannot be negative.' });
      config.freeDeliveryThreshold = Number(freeDeliveryThreshold);
    }
    if (codCharge !== undefined && codCharge !== null && !isNaN(Number(codCharge))) {
      const codVal = Number(codCharge);
      if (codVal < 0) return res.status(400).json({ success: false, message: 'COD charge cannot be negative.' });
      config.codCharge = codVal;
    }
    if (isCodChargeEnabled !== undefined) {
      config.isCodChargeEnabled = Boolean(isCodChargeEnabled);
    }
    if (extraDistanceCharge !== undefined) {
      if (Number(extraDistanceCharge) < 0) return res.status(400).json({ success: false, message: 'Extra distance charge cannot be negative.' });
      config.extraDistanceCharge = Number(extraDistanceCharge);
    }
    if (thresholdDistanceKm !== undefined) {
      if (Number(thresholdDistanceKm) < 0) return res.status(400).json({ success: false, message: 'Threshold distance cannot be negative.' });
      config.thresholdDistanceKm = Number(thresholdDistanceKm);
    }

    if (isFreeDeliveryEnabled !== undefined) {
      config.isFreeDeliveryEnabled = Boolean(isFreeDeliveryEnabled);
    }

    if (configName !== undefined) config.configName = configName.trim();
    if (description !== undefined) config.description = description.trim();

    if (peakSurge !== undefined) {
      config.peakSurge = {
        enabled: Boolean(peakSurge.enabled),
        surgeAmount: Number(peakSurge.surgeAmount ?? config.peakSurge.surgeAmount ?? 0),
        surgeMultiplier: Number(peakSurge.surgeMultiplier ?? config.peakSurge.surgeMultiplier ?? 1.0),
        description: peakSurge.description || config.peakSurge.description || 'Peak / Bad Weather Delivery Surge',
      };
    }

    if (isActive !== undefined && Boolean(isActive) !== config.isActive) {
      if (Boolean(isActive)) {
        await DeliveryPricing.updateMany({ _id: { $ne: id } }, { $set: { isActive: false } });
        config.isActive = true;
      } else {
        const otherConfigs = await DeliveryPricing.countDocuments({ _id: { $ne: id } });
        if (otherConfigs === 0) {
          return res.status(400).json({ success: false, message: 'Cannot deactivate the only delivery pricing configuration. Create another active configuration first.' });
        }
        config.isActive = false;
      }
    }

    config.updatedBy = adminIdentifier;

    config.history.unshift({
      baseDeliveryFee: config.baseDeliveryFee,
      perKmDeliveryCharge: config.perKmDeliveryCharge,
      minimumDeliveryFee: config.minimumDeliveryFee,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      isFreeDeliveryEnabled: config.isFreeDeliveryEnabled,
      codCharge: config.codCharge,
      isCodChargeEnabled: config.isCodChargeEnabled,
      extraDistanceCharge: config.extraDistanceCharge,
      thresholdDistanceKm: config.thresholdDistanceKm,
      peakSurge: config.peakSurge,
      isActive: config.isActive,
      changedBy: adminIdentifier,
      changedAt: new Date(),
      reason: reason?.trim() || 'Admin updated delivery pricing configuration',
    });

    if (config.history.length > 50) config.history = config.history.slice(0, 50);

    await config.save();

    if (config.isActive) {
      await syncCommissionDeliverySettings(config, adminIdentifier);
    }

    res.status(200).json({
      success: true,
      message: 'Delivery pricing configuration updated successfully.',
      config,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate a Delivery Pricing Configuration
// @route   PATCH /api/admin/pricing/delivery/:id/activate
export const activateDeliveryPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminIdentifier = req.user?.email || req.user?.name || 'Admin';

    const config = await DeliveryPricing.findById(id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Delivery pricing configuration not found.' });
    }

    await DeliveryPricing.updateMany({ _id: { $ne: id } }, { $set: { isActive: false } });

    config.isActive = true;
    config.updatedBy = adminIdentifier;
    config.history.unshift({
      baseDeliveryFee: config.baseDeliveryFee,
      perKmDeliveryCharge: config.perKmDeliveryCharge,
      minimumDeliveryFee: config.minimumDeliveryFee,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      isFreeDeliveryEnabled: config.isFreeDeliveryEnabled,
      extraDistanceCharge: config.extraDistanceCharge,
      thresholdDistanceKm: config.thresholdDistanceKm,
      peakSurge: config.peakSurge,
      isActive: true,
      changedBy: adminIdentifier,
      changedAt: new Date(),
      reason: `Activated as primary delivery pricing card by ${adminIdentifier}`,
    });

    await config.save();
    await syncCommissionDeliverySettings(config, adminIdentifier);

    res.status(200).json({
      success: true,
      message: `"${config.configName}" is now the active delivery pricing configuration.`,
      config,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Delivery Pricing Configuration
// @route   DELETE /api/admin/pricing/delivery/:id
export const deleteDeliveryPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = await DeliveryPricing.findById(id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Delivery pricing configuration not found.' });
    }

    if (config.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active delivery pricing configuration. Please activate another configuration before deleting this one.',
      });
    }

    await DeliveryPricing.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Delivery pricing configuration deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// PUBLIC / CLIENT APIS & SIMULATORS
// ==============================================================================

// @desc    Get Active Pricing for App/Frontend
// @route   GET /api/pricing/active
export const getActivePublicPricing = async (req, res, next) => {
  try {
    const [transport, delivery] = await Promise.all([
      TransportPricing.getActiveConfig(),
      DeliveryPricing.getActiveConfig(),
    ]);

    res.status(200).json({
      success: true,
      transport: {
        id: transport._id,
        configName: transport.configName,
        baseFare: transport.baseFare,
        perKmFare: transport.perKmFare,
        minimumFare: transport.minimumFare,
        waitingChargePerMin: transport.waitingChargePerMin,
        additionalStopCharge: transport.additionalStopCharge,
        platformFee: transport.platformFee,
        nightPeakPricing: transport.nightPeakPricing,
        isActive: transport.isActive,
      },
      delivery: {
        id: delivery._id,
        configName: delivery.configName,
        baseDeliveryFee: delivery.baseDeliveryFee,
        perKmDeliveryCharge: delivery.perKmDeliveryCharge,
        minimumDeliveryFee: delivery.minimumDeliveryFee,
        freeDeliveryThreshold: delivery.freeDeliveryThreshold,
        isFreeDeliveryEnabled: delivery.isFreeDeliveryEnabled,
        extraDistanceCharge: delivery.extraDistanceCharge,
        thresholdDistanceKm: delivery.thresholdDistanceKm,
        peakSurge: delivery.peakSurge,
        isActive: delivery.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate Dynamic Transport Fare Simulator / Estimate
// @route   POST /api/pricing/calculate-transport
export const calculateTransportFareEstimate = async (req, res, next) => {
  try {
    const {
      distanceKm = 5.0,
      stopsCount = 0,
      waitingMinutes = 0,
      isNightPeak = false,
      vehicleTypeId,
    } = req.body;

    const transportPricing = await TransportPricing.getActiveConfig();
    let vehicle = null;
    if (vehicleTypeId) {
      vehicle = await VehicleType.findById(vehicleTypeId).lean();
    }

    const dist = Math.max(0.1, Number(distanceKm));
    const stops = Math.max(0, Number(stopsCount));
    const wait = Math.max(0, Number(waitingMinutes));

    // Calculate fare using centralized active pricing
    const baseFare = vehicle?.baseFare ?? transportPricing.baseFare;
    const perKmFare = vehicle?.perKmFare ?? transportPricing.perKmFare;
    const minimumFare = vehicle?.minimumFare ?? transportPricing.minimumFare;
    const platformFee = vehicle?.platformFee ?? transportPricing.platformFee ?? 0;

    const distanceCharge = Math.round(dist * perKmFare * 100) / 100;
    const waitingCharge = Math.round(wait * transportPricing.waitingChargePerMin * 100) / 100;
    const stopsCharge = Math.round(stops * transportPricing.additionalStopCharge * 100) / 100;

    let nightSurge = 0;
    if (isNightPeak && transportPricing.nightPeakPricing?.enabled) {
      const multiplier = transportPricing.nightPeakPricing.surgeMultiplier || 1.0;
      const flat = transportPricing.nightPeakPricing.surgeFlat || 0;
      nightSurge = Math.round(((baseFare + distanceCharge) * (multiplier - 1) + flat) * 100) / 100;
    }

    const rawFare = baseFare + distanceCharge + waitingCharge + stopsCharge + nightSurge;
    const cappedFare = Math.max(rawFare, minimumFare);
    const totalFare = Math.round((cappedFare + platformFee) * 100) / 100;

    res.status(200).json({
      success: true,
      pricingPlan: transportPricing.configName,
      breakdown: {
        distanceKm: dist,
        baseFare,
        perKmFare,
        distanceCharge,
        waitingMinutes: wait,
        waitingChargeRate: transportPricing.waitingChargePerMin,
        waitingCharge,
        stopsCount: stops,
        stopChargeRate: transportPricing.additionalStopCharge,
        stopsCharge,
        nightPeakEnabled: Boolean(isNightPeak && transportPricing.nightPeakPricing?.enabled),
        nightSurge,
        minimumFare,
        platformFee,
        rawFare: Math.round(rawFare * 100) / 100,
        totalFare,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate Dynamic Delivery Fee Simulator / Estimate
// @route   POST /api/pricing/calculate-delivery
export const calculateDeliveryFeeEstimate = async (req, res, next) => {
  try {
    const {
      cartTotal = 0,
      distanceKm = 2.0,
      isPeakSurge = false,
    } = req.body;

    const deliveryPricing = await DeliveryPricing.getActiveConfig();
    const safeCart = Math.max(0, Number(cartTotal));
    const dist = Math.max(0, Number(distanceKm));

    const isFree = safeCart > 0 && deliveryPricing.isFreeDeliveryEnabled && safeCart >= deliveryPricing.freeDeliveryThreshold;

    let baseFee = deliveryPricing.baseDeliveryFee;
    let extraDistanceFee = 0;
    if (dist > deliveryPricing.thresholdDistanceKm) {
      const extraKm = dist - deliveryPricing.thresholdDistanceKm;
      extraDistanceFee = Math.round(extraKm * deliveryPricing.extraDistanceCharge * 100) / 100;
    }

    let surgeFee = 0;
    if (isPeakSurge && deliveryPricing.peakSurge?.enabled) {
      const mult = deliveryPricing.peakSurge.surgeMultiplier || 1.0;
      const flat = deliveryPricing.peakSurge.surgeAmount || 0;
      surgeFee = Math.round((baseFee * (mult - 1) + flat) * 100) / 100;
    }

    const calculatedRaw = baseFee + extraDistanceFee + surgeFee;
    const finalFee = isFree ? 0 : Math.max(calculatedRaw, deliveryPricing.minimumDeliveryFee);

    res.status(200).json({
      success: true,
      pricingPlan: deliveryPricing.configName,
      isFreeDelivery: isFree,
      breakdown: {
        cartTotal: safeCart,
        distanceKm: dist,
        baseDeliveryFee: baseFee,
        thresholdDistanceKm: deliveryPricing.thresholdDistanceKm,
        extraDistanceFee,
        isPeakSurgeActive: Boolean(isPeakSurge && deliveryPricing.peakSurge?.enabled),
        surgeFee,
        freeDeliveryThreshold: deliveryPricing.freeDeliveryThreshold,
        isFreeDeliveryEnabled: deliveryPricing.isFreeDeliveryEnabled,
        minimumDeliveryFee: deliveryPricing.minimumDeliveryFee,
        calculatedDeliveryFee: Math.round(finalFee * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};
