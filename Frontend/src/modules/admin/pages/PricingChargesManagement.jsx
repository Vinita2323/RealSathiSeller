import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  Sparkles,
  Edit3,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  History,
  Calculator,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Zap,
  Moon,
  Info,
  Layers,
  MapPin,
  X,
  Loader2,
  Copy,
  Save,
  Sliders,
  CloudRain,
  SlidersHorizontal,
  TrendingUp,
  Tag,
  Bike,
  Weight,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import pricingService from '../../../services/pricingService';

export const PricingChargesManagement = ({ initialTab = 'delivery' }) => {
  // Top-Level Tab: 'delivery'
  const [activeTab, setActiveTab] = useState('delivery');

  // Sync tab if parent prop changes
  useEffect(() => {
    setActiveTab('delivery');
  }, [initialTab]);

  // ── Data States ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [transportActive, setTransportActive] = useState(null);
  const [transportList, setTransportList] = useState([]);
  const [deliveryActive, setDeliveryActive] = useState(null);
  const [deliveryList, setDeliveryList] = useState([]);
  const [vehiclesList, setVehiclesList] = useState([]);

  // Vehicle Editing State
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [vehicleDraft, setVehicleDraft] = useState({});
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);

  // Vehicle Add / Edit Modal
  const [vehicleModal, setVehicleModal] = useState({
    open: false,
    mode: 'add', // 'add' | 'edit'
    data: {
      name: '',
      slug: '',
      description: '',
      capacityKg: 500,
      icon: 'truck',
      baseFare: 50,
      perKmFare: 15,
      minimumFare: 80,
      platformFee: 10,
      isActive: true,
      sortOrder: 0,
    },
  });

  // Direct In-Place Edit Mode for Active Global Rates
  const [isEditingActiveTransport, setIsEditingActiveTransport] = useState(false);
  const [activeTransportDraft, setActiveTransportDraft] = useState(null);
  const [isSavingActiveTransport, setIsSavingActiveTransport] = useState(false);

  const [isEditingActiveDelivery, setIsEditingActiveDelivery] = useState(false);
  const [activeDeliveryDraft, setActiveDeliveryDraft] = useState(null);
  const [isSavingActiveDelivery, setIsSavingActiveDelivery] = useState(false);

  // Toast / Feedback State
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
  };

  // ── Modals State ───────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [submittingModal, setSubmittingModal] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // History Modal
  const [historyModal, setHistoryModal] = useState({ open: false, title: '', history: [] });

  // Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: '', id: '', name: '' });

  // ── Form State (Transport Modal) ──────────────────────────────────────────
  const [transportForm, setTransportForm] = useState({
    configName: '',
    description: '',
    baseFare: '50',
    perKmFare: '15',
    minimumFare: '60',
    waitingChargePerMin: '2',
    additionalStopCharge: '30',
    platformFee: '10',
    nightPeakEnabled: false,
    nightPeakMultiplier: '1.25',
    nightPeakFlat: '0',
    nightPeakStart: '22:00',
    nightPeakEnd: '06:00',
    nightPeakDescription: 'Late Night / Rush Hour Transport Surcharge',
    isActive: false,
    reason: '',
  });

  // ── Form State (Delivery Modal) ───────────────────────────────────────────
  const [deliveryForm, setDeliveryForm] = useState({
    configName: '',
    description: '',
    baseDeliveryFee: '40',
    perKmDeliveryCharge: '5',
    minimumDeliveryFee: '40',
    freeDeliveryThreshold: '500',
    isFreeDeliveryEnabled: true,
    extraDistanceCharge: '10',
    thresholdDistanceKm: '5',
    peakSurgeEnabled: false,
    peakSurgeAmount: '20',
    peakSurgeMultiplier: '1.0',
    peakSurgeDescription: 'Peak / Bad Weather Delivery Surge',
    isActive: false,
    reason: '',
  });

  // ── Simulator States ───────────────────────────────────────────────────────
  // Transport Simulator
  const [selectedSimVehicleId, setSelectedSimVehicleId] = useState('');
  const [simDist, setSimDist] = useState(8.5);
  const [simStops, setSimStops] = useState(1);
  const [simWait, setSimWait] = useState(15);
  const [simNight, setSimNight] = useState(false);

  // Delivery Simulator
  const [simCart, setSimCart] = useState(350);
  const [simDelivDist, setSimDelivDist] = useState(6.2);
  const [simSurge, setSimSurge] = useState(false);

  // ── Fetch Master Data ──────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await pricingService.getAdminPricingOverview();
      if (res && res.success) {
        setTransportActive(res.transport?.active || null);
        setTransportList(res.transport?.list || []);
        setDeliveryActive(res.delivery?.active || null);
        setDeliveryList(res.delivery?.list || []);

        const vehicles = res.vehicles || [];
        setVehiclesList(vehicles);
        if (vehicles.length > 0 && !selectedSimVehicleId) {
          setSelectedSimVehicleId(vehicles[0]._id);
        }

        if (res.transport?.active) {
          initActiveTransportDraft(res.transport.active);
        }
        if (res.delivery?.active) {
          initActiveDeliveryDraft(res.delivery.active);
        }
      }
    } catch (err) {
      console.error('Failed to load pricing configurations:', err);
      showFeedback('error', err?.response?.data?.message || 'Failed to load pricing data.');
    } finally {
      setLoading(false);
    }
  };

  const initActiveTransportDraft = (cfg) => {
    setActiveTransportDraft({
      baseFare: cfg.baseFare ?? 50,
      perKmFare: cfg.perKmFare ?? 15,
      minimumFare: cfg.minimumFare ?? 60,
      waitingChargePerMin: cfg.waitingChargePerMin ?? 2,
      additionalStopCharge: cfg.additionalStopCharge ?? 30,
      platformFee: cfg.platformFee ?? 10,
      nightPeakEnabled: Boolean(cfg.nightPeakPricing?.enabled),
      nightPeakMultiplier: cfg.nightPeakPricing?.surgeMultiplier ?? 1.25,
      nightPeakFlat: cfg.nightPeakPricing?.surgeFlat ?? 0,
      nightPeakStart: cfg.nightPeakPricing?.startHour || '22:00',
      nightPeakEnd: cfg.nightPeakPricing?.endHour || '06:00',
      returnToPickup: Boolean(cfg.returnToPickup),
    });
  };

  const initActiveDeliveryDraft = (cfg) => {
    setActiveDeliveryDraft({
      baseDeliveryFee: cfg.baseDeliveryFee ?? 40,
      perKmDeliveryCharge: cfg.perKmDeliveryCharge ?? 5,
      minimumDeliveryFee: cfg.minimumDeliveryFee ?? 40,
      freeDeliveryThreshold: cfg.freeDeliveryThreshold ?? 500,
      isFreeDeliveryEnabled: cfg.isFreeDeliveryEnabled !== undefined ? Boolean(cfg.isFreeDeliveryEnabled) : true,
      codCharge: cfg.codCharge ?? 9,
      isCodChargeEnabled: cfg.isCodChargeEnabled !== undefined ? Boolean(cfg.isCodChargeEnabled) : true,
      extraDistanceCharge: cfg.extraDistanceCharge ?? 10,
      thresholdDistanceKm: cfg.thresholdDistanceKm ?? 5,
      peakSurgeEnabled: Boolean(cfg.peakSurge?.enabled),
      peakSurgeAmount: cfg.peakSurge?.surgeAmount ?? 20,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Vehicle Pricing Handlers ──────────────────────────────────────────────
  const handleStartEditVehicle = (vehicle) => {
    setEditingVehicleId(vehicle._id);
    setVehicleDraft({
      baseFare: vehicle.baseFare ?? 50,
      perKmFare: vehicle.perKmFare ?? 15,
      minimumFare: vehicle.minimumFare ?? 80,
      platformFee: vehicle.platformFee ?? 10,
      capacityKg: vehicle.capacityKg ?? 500,
      isActive: vehicle.isActive !== undefined ? vehicle.isActive : true,
    });
  };

  const handleSaveVehicleDirect = async (vehicleId) => {
    try {
      setIsSavingVehicle(true);
      const res = await pricingService.updateVehiclePricing(vehicleId, {
        baseFare: Number(vehicleDraft.baseFare),
        perKmFare: Number(vehicleDraft.perKmFare),
        minimumFare: Number(vehicleDraft.minimumFare),
        platformFee: Number(vehicleDraft.platformFee),
        capacityKg: Number(vehicleDraft.capacityKg),
        isActive: Boolean(vehicleDraft.isActive),
      });
      if (res && res.success) {
        showFeedback('success', 'Vehicle pricing updated successfully!');
        setEditingVehicleId(null);
        await fetchData();
      }
    } catch (err) {
      showFeedback('error', err?.response?.data?.message || 'Failed to update vehicle pricing.');
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleToggleVehicleActive = async (vehicle) => {
    try {
      const res = await pricingService.updateVehiclePricing(vehicle._id, {
        isActive: !vehicle.isActive,
      });
      if (res && res.success) {
        showFeedback('success', `${vehicle.name} status updated!`);
        await fetchData();
      }
    } catch (err) {
      showFeedback('error', err?.response?.data?.message || 'Failed to toggle vehicle status.');
    }
  };

  const handleSaveVehicleModal = async (e) => {
    e.preventDefault();
    const d = vehicleModal.data;
    if (!d.name.trim()) {
      showFeedback('error', 'Vehicle name is required.');
      return;
    }

    try {
      setIsSavingVehicle(true);
      if (vehicleModal.mode === 'add') {
        const res = await pricingService.createVehicleType({
          name: d.name.trim(),
          description: d.description.trim(),
          capacityKg: Number(d.capacityKg || 500),
          icon: d.icon || 'truck',
          baseFare: Number(d.baseFare || 50),
          perKmFare: Number(d.perKmFare || 15),
          minimumFare: Number(d.minimumFare || 80),
          platformFee: Number(d.platformFee || 10),
          isActive: Boolean(d.isActive),
        });
        if (res && res.success) {
          showFeedback('success', `Vehicle type "${d.name}" created!`);
          setVehicleModal({ open: false, mode: 'add', data: {} });
          await fetchData();
        }
      } else {
        const res = await pricingService.updateVehiclePricing(d._id, {
          name: d.name.trim(),
          description: d.description.trim(),
          capacityKg: Number(d.capacityKg || 500),
          icon: d.icon || 'truck',
          baseFare: Number(d.baseFare || 50),
          perKmFare: Number(d.perKmFare || 15),
          minimumFare: Number(d.minimumFare || 80),
          platformFee: Number(d.platformFee || 10),
          isActive: Boolean(d.isActive),
        });
        if (res && res.success) {
          showFeedback('success', `Vehicle type "${d.name}" updated!`);
          setVehicleModal({ open: false, mode: 'add', data: {} });
          await fetchData();
        }
      }
    } catch (err) {
      showFeedback('error', err?.response?.data?.message || 'Failed to save vehicle type.');
    } finally {
      setIsSavingVehicle(false);
    }
  };

  // ── Save Direct In-Place Active Rates ─────────────────────────────────────
  const handleSaveActiveTransportDirect = async () => {
    if (!transportActive || !activeTransportDraft) return;
    try {
      setIsSavingActiveTransport(true);
      const payload = {
        configName: transportActive.configName || 'Standard Transport Pricing',
        description: transportActive.description || 'Active transport pricing rate card',
        baseFare: Number(activeTransportDraft.baseFare),
        perKmFare: Number(activeTransportDraft.perKmFare),
        minimumFare: Number(activeTransportDraft.minimumFare),
        waitingChargePerMin: Number(activeTransportDraft.waitingChargePerMin),
        additionalStopCharge: Number(activeTransportDraft.additionalStopCharge),
        platformFee: Number(activeTransportDraft.platformFee),
        nightPeakPricing: {
          enabled: Boolean(activeTransportDraft.nightPeakEnabled),
          surgeMultiplier: Number(activeTransportDraft.nightPeakMultiplier || 1.25),
          surgeFlat: Number(activeTransportDraft.nightPeakFlat || 0),
          startHour: activeTransportDraft.nightPeakStart || '22:00',
          endHour: activeTransportDraft.nightPeakEnd || '06:00',
          description: transportActive.nightPeakPricing?.description || 'Night / Peak hours surcharge',
        },
        isActive: true,
        returnToPickup: Boolean(activeTransportDraft.returnToPickup),
        reason: 'Direct quick update from Admin Pricing Dashboard',
      };

      const res = await pricingService.updateTransportPricing(transportActive._id, payload);
      if (res && res.success) {
        showFeedback('success', 'Active transport surcharge rates updated successfully!');
        setIsEditingActiveTransport(false);
        await fetchData();
      }
    } catch (err) {
      showFeedback('error', err?.response?.data?.message || 'Failed to update transport pricing.');
    } finally {
      setIsSavingActiveTransport(false);
    }
  };

  const handleSaveActiveDeliveryDirect = async () => {
    if (!deliveryActive || !activeDeliveryDraft) return;
    try {
      setIsSavingActiveDelivery(true);
      const payload = {
        configName: deliveryActive.configName || 'Standard Delivery Pricing',
        description: deliveryActive.description || 'Active delivery rate schedule',
        baseDeliveryFee: Number(activeDeliveryDraft.baseDeliveryFee),
        perKmDeliveryCharge: Number(activeDeliveryDraft.perKmDeliveryCharge),
        minimumDeliveryFee: Number(activeDeliveryDraft.minimumDeliveryFee),
        freeDeliveryThreshold: Number(activeDeliveryDraft.freeDeliveryThreshold),
        isFreeDeliveryEnabled: Boolean(activeDeliveryDraft.isFreeDeliveryEnabled),
        codCharge: Number(activeDeliveryDraft.codCharge ?? 9),
        isCodChargeEnabled: Boolean(activeDeliveryDraft.isCodChargeEnabled ?? true),
        extraDistanceCharge: Number(activeDeliveryDraft.extraDistanceCharge),
        thresholdDistanceKm: Number(activeDeliveryDraft.thresholdDistanceKm),
        peakSurge: {
          enabled: Boolean(activeDeliveryDraft.peakSurgeEnabled),
          surgeAmount: Number(activeDeliveryDraft.peakSurgeAmount || 0),
          surgeMultiplier: Number(deliveryActive.peakSurge?.surgeMultiplier || 1.0),
          description: deliveryActive.peakSurge?.description || 'Peak / Bad Weather Delivery Surge',
        },
        isActive: true,
        reason: 'Direct quick update from Admin Pricing Dashboard',
      };

      const res = await pricingService.updateDeliveryPricing(deliveryActive._id, payload);
      if (res && res.success) {
        showFeedback('success', 'Active delivery rates updated successfully!');
        setIsEditingActiveDelivery(false);
        await fetchData();
      }
    } catch (err) {
      showFeedback('error', err?.response?.data?.message || 'Failed to update delivery pricing.');
    } finally {
      setIsSavingActiveDelivery(false);
    }
  };

  // ── Simulator Computations ───────────────────────────────────────────────
  const selectedVehicleObj = vehiclesList.find((v) => v._id === selectedSimVehicleId) || vehiclesList[0] || null;

  const computeTransportSimulation = () => {
    const v = selectedVehicleObj;
    const globalPricing = transportActive || {};

    const baseFare = Number(v?.baseFare ?? globalPricing.baseFare ?? 50);
    const perKmFare = Number(v?.perKmFare ?? globalPricing.perKmFare ?? 15);
    const minimumFare = Number(v?.minimumFare ?? globalPricing.minimumFare ?? 60);
    const platformFee = Number(v?.platformFee ?? globalPricing.platformFee ?? 10);
    const waitingChargePerMin = Number(globalPricing.waitingChargePerMin ?? 2);
    const additionalStopCharge = Number(globalPricing.additionalStopCharge ?? 30);

    const isNightEnabled = Boolean(globalPricing.nightPeakPricing?.enabled);
    const surgeMultiplier = Number(globalPricing.nightPeakPricing?.surgeMultiplier ?? 1.25);
    const surgeFlat = Number(globalPricing.nightPeakPricing?.surgeFlat ?? 0);

    const distCharge = Math.round(simDist * perKmFare * 100) / 100;
    const waitCharge = Math.round(simWait * waitingChargePerMin * 100) / 100;
    const stopCharge = Math.round(simStops * additionalStopCharge * 100) / 100;

    let nightSurge = 0;
    if (simNight && isNightEnabled) {
      nightSurge = Math.round(((baseFare + distCharge) * (surgeMultiplier - 1) + surgeFlat) * 100) / 100;
    }

    const raw = baseFare + distCharge + waitCharge + stopCharge + nightSurge;
    const capped = Math.max(raw, minimumFare);
    const total = Math.round((capped + platformFee) * 100) / 100;

    return {
      vehicleName: v?.name || 'Standard Vehicle',
      baseFare,
      perKmFare,
      distCharge,
      waitCharge,
      stopCharge,
      nightSurge,
      raw,
      minimumFare,
      platformFee,
      total,
    };
  };

  const activeDeliveryData = isEditingActiveDelivery && activeDeliveryDraft ? activeDeliveryDraft : deliveryActive;
  const computeDeliverySimulation = () => {
    const p = activeDeliveryData || {
      baseDeliveryFee: 40,
      perKmDeliveryCharge: 5,
      minimumDeliveryFee: 40,
      freeDeliveryThreshold: 500,
      isFreeDeliveryEnabled: true,
      extraDistanceCharge: 10,
      thresholdDistanceKm: 5,
      peakSurge: { enabled: false, surgeAmount: 20, surgeMultiplier: 1.0 },
    };

    const baseDeliveryFee = Number(p.baseDeliveryFee ?? 40);
    const thresholdDistanceKm = Number(p.thresholdDistanceKm ?? 5);
    const extraDistanceCharge = Number(p.extraDistanceCharge ?? 10);
    const freeDeliveryThreshold = Number(p.freeDeliveryThreshold ?? 500);
    const isFreeEnabled = p.isFreeDeliveryEnabled !== undefined ? Boolean(p.isFreeDeliveryEnabled) : true;
    const minimumDeliveryFee = Number(p.minimumDeliveryFee ?? 40);
    const isSurgeEnabled = p.peakSurgeEnabled !== undefined ? p.peakSurgeEnabled : Boolean(p.peakSurge?.enabled);
    const surgeAmount = Number(p.peakSurgeAmount ?? p.peakSurge?.surgeAmount ?? 20);

    const isFree = simCart > 0 && isFreeEnabled && simCart >= freeDeliveryThreshold;

    let extraDistCharge = 0;
    if (simDelivDist > thresholdDistanceKm) {
      extraDistCharge = Math.round((simDelivDist - thresholdDistanceKm) * extraDistanceCharge * 100) / 100;
    }

    let surgeFee = 0;
    if (simSurge && isSurgeEnabled) {
      surgeFee = surgeAmount;
    }

    const calculatedRaw = baseDeliveryFee + extraDistCharge + surgeFee;
    const finalFee = isFree ? 0 : Math.max(calculatedRaw, minimumDeliveryFee);

    return {
      baseDeliveryFee,
      isFree,
      thresholdDistanceKm,
      extraDistCharge,
      surgeFee,
      minimumDeliveryFee,
      finalFee: Math.round(finalFee * 100) / 100,
    };
  };

  const simTransportResult = computeTransportSimulation();
  const simDeliveryResult = computeDeliverySimulation();

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans select-none text-slate-800">
      {/* ── Top Header & Tab Navigation ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#002625] text-[#ff5500] flex items-center justify-center shadow-sm shrink-0">
            <DollarSign size={26} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight m-0">
                Delivery Charges & Rates
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Delivery Pricing
              </span>
            </div>
            <p className="text-sm text-slate-500 m-0 mt-1 font-normal">
              Manage order delivery fees, free delivery threshold, extra distance rates, and surge charges.
            </p>
          </div>
        </div>

        {/* Tab Selector & Quick Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-white text-slate-900 shadow-sm border-none">
              <Package size={17} className="text-[#ff5500]" />
              <span>Delivery Charges</span>
            </div>
          </div>

          <button
            onClick={() => {
              setHistoryModal({
                open: true,
                title: activeTab === 'transport' ? 'Transport Pricing Audit Log' : 'Delivery Pricing Audit Log',
                history: activeTab === 'transport' ? (transportActive?.history || []) : (deliveryActive?.history || []),
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer transition-all shadow-2xs"
            title="View update audit trail"
          >
            <History size={16} className="text-slate-500" />
            <span className="hidden sm:inline">Audit Log</span>
          </button>
        </div>
      </div>

      {/* ── Toast Alert Banner ────────────────────────────────────────────── */}
      {feedback.text && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm font-medium shadow-2xs animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', text: '' })}
            className="text-slate-400 hover:text-slate-700 p-1 border-none bg-transparent cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <Loader2 size={36} className="text-[#ff5500] animate-spin mb-3" />
          <p className="text-base font-semibold text-slate-700 m-0">Loading vehicle pricing & rates...</p>
        </div>
      ) : activeTab === 'transport' ? (
        /* ====================================================================== */
        /* TAB 1: TRANSPORT CHARGES (PER-VEHICLE RATES)                           */
        /* ====================================================================== */
        <div className="space-y-6">
          {/* SECTION 1: PER-VEHICLE FLEET PRICING MATRIX */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 bg-gradient-to-r from-slate-50/70 to-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                    Live Vehicle Fleet Pricing
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    • {vehiclesList.length} Vehicle Categories Configured
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 m-0 tracking-tight">
                  Vehicle-Specific Transport Rates
                </h2>
                <p className="text-sm text-slate-500 m-0 mt-1 font-normal">
                  Set unique Base Fares, Per KM Distance Charges, Minimum Fares, and Platform Fees for each vehicle type.
                </p>
              </div>

              <button
                onClick={() =>
                  setVehicleModal({
                    open: true,
                    mode: 'add',
                    data: {
                      name: '',
                      slug: '',
                      description: '',
                      capacityKg: 500,
                      icon: 'truck',
                      baseFare: 60,
                      perKmFare: 14,
                      minimumFare: 150,
                      platformFee: 15,
                      isActive: true,
                      sortOrder: vehiclesList.length + 1,
                    },
                  })
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#002625] hover:bg-[#003836] text-white text-sm font-medium border-none cursor-pointer shadow-2xs transition-all self-start sm:self-auto"
              >
                <Plus size={16} className="text-[#ff5500]" />
                <span>Add Vehicle Type</span>
              </button>
            </div>

            {/* Vehicle Cards Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {vehiclesList.map((vehicle) => {
                const isEditing = editingVehicleId === vehicle._id;
                return (
                  <div
                    key={vehicle._id}
                    className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                      vehicle.isActive
                        ? 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Card Top: Icon, Name & Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-800 shrink-0">
                            {vehicle.icon === 'bike' ? <Bike size={22} /> : <Truck size={22} />}
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 m-0">{vehicle.name}</h3>
                            <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-normal">
                              <Weight size={12} className="text-slate-400" />
                              Up to {vehicle.capacityKg} kg
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleVehicleActive(vehicle)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium cursor-pointer transition-colors ${
                            vehicle.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                          title={vehicle.isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {vehicle.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      {/* Pricing Fields */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        {/* Per KM Rate */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-normal text-slate-500">Per KM Rate:</span>
                          {isEditing ? (
                            <div className="relative w-24">
                              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={vehicleDraft.perKmFare}
                                onChange={(e) => setVehicleDraft({ ...vehicleDraft, perKmFare: e.target.value })}
                                className="w-full pl-6 pr-2 py-1 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-semibold text-slate-900 outline-none bg-white tabular-nums"
                              />
                            </div>
                          ) : (
                            <span className="text-base font-semibold text-emerald-700 tabular-nums">
                              ₹{vehicle.perKmFare} <span className="text-xs font-normal text-slate-500">/ km</span>
                            </span>
                          )}
                        </div>

                        {/* Base Fare */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-normal text-slate-500">Base Fare:</span>
                          {isEditing ? (
                            <div className="relative w-24">
                              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={vehicleDraft.baseFare}
                                onChange={(e) => setVehicleDraft({ ...vehicleDraft, baseFare: e.target.value })}
                                className="w-full pl-6 pr-2 py-1 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-semibold text-slate-900 outline-none bg-white tabular-nums"
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-slate-800 tabular-nums">
                              ₹{vehicle.baseFare}
                            </span>
                          )}
                        </div>

                        {/* Minimum Fare */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-normal text-slate-500">Min Fare Floor:</span>
                          {isEditing ? (
                            <div className="relative w-24">
                              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={vehicleDraft.minimumFare}
                                onChange={(e) => setVehicleDraft({ ...vehicleDraft, minimumFare: e.target.value })}
                                className="w-full pl-6 pr-2 py-1 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-semibold text-slate-900 outline-none bg-white tabular-nums"
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-slate-800 tabular-nums">
                              ₹{vehicle.minimumFare}
                            </span>
                          )}
                        </div>

                        {/* Platform Fee */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-normal text-slate-500">Platform Fee:</span>
                          {isEditing ? (
                            <div className="relative w-24">
                              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={vehicleDraft.platformFee}
                                onChange={(e) => setVehicleDraft({ ...vehicleDraft, platformFee: e.target.value })}
                                className="w-full pl-6 pr-2 py-1 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-semibold text-slate-900 outline-none bg-white tabular-nums"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-600 tabular-nums">
                              ₹{vehicle.platformFee ?? 10}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setEditingVehicleId(null)}
                            className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveVehicleDirect(vehicle._id)}
                            disabled={isSavingVehicle}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium border-none cursor-pointer flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50"
                          >
                            {isSavingVehicle ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            <span>Save</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEditVehicle(vehicle)}
                            className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-medium border-none cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Edit3 size={13} className="text-[#ff5500]" />
                            <span>Edit Rates</span>
                          </button>
                          <button
                            onClick={() =>
                              setVehicleModal({
                                open: true,
                                mode: 'edit',
                                data: { ...vehicle },
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg border-none bg-transparent cursor-pointer"
                            title="Full Vehicle Settings"
                          >
                            <SlidersHorizontal size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: GLOBAL SURCHARGES & ADD-ONS (WAITING, STOPS, NIGHT PEAK) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 bg-gradient-to-r from-slate-50/70 to-white">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 m-0">
                  Global Add-on Charges & Night Surge
                </h3>
                <p className="text-sm text-slate-500 m-0 mt-0.5 font-normal">
                  These universal rules (driver idle waiting fee, multi-drop stop charge, night surge) apply across all vehicle rides.
                </p>
                <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={!isEditingActiveTransport}
                    checked={Boolean(isEditingActiveTransport ? activeTransportDraft?.returnToPickup : transportActive?.returnToPickup)}
                    onChange={(e) => setActiveTransportDraft((prev) => ({ ...prev, returnToPickup: e.target.checked }))}
                  />
                  <span>
                    Require a return-to-pickup route after delivery. This does not create a second booking or a second payout.
                    <span className="block text-xs text-slate-500">Currently {transportActive?.returnToPickup ? 'on' : 'off'} for new bookings.</span>
                  </span>
                </label>
              </div>

              {isEditingActiveTransport ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      initActiveTransportDraft(transportActive);
                      setIsEditingActiveTransport(false);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveActiveTransportDirect}
                    disabled={isSavingActiveTransport}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium border-none cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isSavingActiveTransport ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Global Add-ons</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    initActiveTransportDraft(transportActive);
                    setIsEditingActiveTransport(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#002625] hover:bg-[#003836] text-white text-sm font-medium border-none cursor-pointer shadow-2xs"
                >
                  <Edit3 size={15} className="text-[#ff5500]" />
                  <span>Edit Add-ons</span>
                </button>
              )}
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Waiting Charge */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm border-b border-slate-200/60 pb-2">
                  <Clock size={16} className="text-[#ff5500]" />
                  <span>Driver Waiting Charge</span>
                </div>
                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">Charge per Idle Minute</label>
                  {isEditingActiveTransport ? (
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-medium text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={activeTransportDraft?.waitingChargePerMin ?? 2}
                        onChange={(e) =>
                          setActiveTransportDraft({ ...activeTransportDraft, waitingChargePerMin: e.target.value })
                        }
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                      />
                    </div>
                  ) : (
                    <div className="text-2xl font-semibold text-slate-800 tabular-nums">
                      <span className="text-[#ff5500] text-lg font-medium">₹</span>
                      <span>{transportActive?.waitingChargePerMin ?? 2}</span>
                      <span className="text-sm font-normal text-slate-500 ml-1">/ min</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-Drop Stop Charge */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm border-b border-slate-200/60 pb-2">
                  <MapPin size={16} className="text-[#ff5500]" />
                  <span>Additional Stop Surcharge</span>
                </div>
                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">Charge per Extra Stop</label>
                  {isEditingActiveTransport ? (
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-medium text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={activeTransportDraft?.additionalStopCharge ?? 30}
                        onChange={(e) =>
                          setActiveTransportDraft({ ...activeTransportDraft, additionalStopCharge: e.target.value })
                        }
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                      />
                    </div>
                  ) : (
                    <div className="text-2xl font-semibold text-slate-800 tabular-nums">
                      <span className="text-[#ff5500] text-lg font-medium">₹</span>
                      <span>{transportActive?.additionalStopCharge ?? 30}</span>
                      <span className="text-sm font-normal text-slate-500 ml-1">/ stop</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Night Surge */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                    <Moon size={16} className="text-indigo-600" />
                    <span>Night Surge</span>
                  </div>
                  {isEditingActiveTransport ? (
                    <input
                      type="checkbox"
                      checked={activeTransportDraft?.nightPeakEnabled}
                      onChange={(e) =>
                        setActiveTransportDraft({ ...activeTransportDraft, nightPeakEnabled: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#ff5500] cursor-pointer"
                    />
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {transportActive?.nightPeakPricing?.enabled ? 'Active' : 'Disabled'}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-normal text-slate-500 block">Surge Rule</span>
                  <div className="text-base font-semibold text-slate-800 mt-1">
                    {transportActive?.nightPeakPricing?.enabled
                      ? `${transportActive.nightPeakPricing.surgeMultiplier}x (${transportActive.nightPeakPricing.startHour} - ${transportActive.nightPeakPricing.endHour})`
                      : 'Flat Standard 24h Rates'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: LIVE TRANSPORT SIMULATOR (WITH VEHICLE SELECTION) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#ff5500] flex items-center justify-center">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 m-0">
                    Live Fare Calculator (By Vehicle Type)
                  </h3>
                  <p className="text-xs text-slate-400 m-0 font-normal">
                    Select a vehicle and adjust trip parameters to test exact customer fare outcomes in real-time.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSimDist(8.5);
                  setSimStops(1);
                  setSimWait(15);
                  setSimNight(false);
                }}
                className="text-xs text-slate-400 hover:text-slate-700 font-medium flex items-center gap-1 bg-transparent border-none cursor-pointer"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>

            {/* Vehicle Selection Tabs for Simulator */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-2">Select Vehicle to Simulate:</label>
              <div className="flex flex-wrap gap-2.5">
                {vehiclesList.map((v) => (
                  <button
                    key={v._id}
                    type="button"
                    onClick={() => setSelectedSimVehicleId(v._id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                      selectedSimVehicleId === v._id
                        ? 'bg-[#002625] text-white border-[#002625] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {v.icon === 'bike' ? <Bike size={16} /> : <Truck size={16} />}
                    <span>{v.name}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                        selectedSimVehicleId === v._id ? 'bg-[#ff5500] text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      ₹{v.perKmFare}/km
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders & Inputs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <div className="flex justify-between text-sm font-medium text-slate-700 mb-1.5">
                    <span>Trip Distance (KM)</span>
                    <span className="text-[#ff5500] font-semibold">{simDist} km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={simDist}
                    onChange={(e) => setSimDist(parseFloat(e.target.value))}
                    className="w-full accent-[#ff5500] cursor-pointer"
                  />
                  <div className="flex gap-2 mt-2">
                    {[5, 10, 20, 35, 50].map((km) => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setSimDist(km)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                          simDist === km
                            ? 'bg-[#002625] text-white border-[#002625]'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {km}km
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">Additional Stops</label>
                    <select
                      value={simStops}
                      onChange={(e) => setSimStops(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#ff5500]"
                    >
                      <option value="0">0 (Direct Route)</option>
                      <option value="1">1 Stop (+₹{transportActive?.additionalStopCharge || 30})</option>
                      <option value="2">2 Stops (+₹{(transportActive?.additionalStopCharge || 30) * 2})</option>
                      <option value="3">3 Stops (+₹{(transportActive?.additionalStopCharge || 30) * 3})</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">Waiting Time (Mins)</label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={simWait}
                      onChange={(e) => setSimWait(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#ff5500]"
                    />
                  </div>
                </div>

                {/* Night Peak Switch */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Moon size={17} className={simNight ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-sm font-medium text-slate-800">Simulate Night Surge</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={simNight}
                    onChange={(e) => setSimNight(e.target.checked)}
                    className="w-4 h-4 accent-[#ff5500] cursor-pointer"
                  />
                </div>
              </div>

              {/* Receipt Output Box */}
              <div className="lg:col-span-5 bg-slate-900 text-white p-5 rounded-2xl space-y-3 border border-slate-800 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-normal text-slate-400 block">Simulated Vehicle</span>
                    <span className="text-sm font-semibold text-emerald-400">{simTransportResult.vehicleName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-normal text-slate-400 block">Total Estimated Fare</span>
                    <div className="text-2xl font-bold text-[#ff5500] tabular-nums">
                      ₹{simTransportResult.total.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-1 font-normal">
                  <div className="flex justify-between">
                    <span>Base Fare:</span>
                    <span className="text-white font-medium">₹{simTransportResult.baseFare.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance ({simDist} km @ ₹{simTransportResult.perKmFare}/km):</span>
                    <span className="text-white font-medium">₹{simTransportResult.distCharge.toFixed(2)}</span>
                  </div>
                  {simTransportResult.waitCharge > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Waiting ({simWait} min):</span>
                      <span className="font-medium">+₹{simTransportResult.waitCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {simTransportResult.stopCharge > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Stops ({simStops} extra):</span>
                      <span className="font-medium">+₹{simTransportResult.stopCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {simTransportResult.nightSurge > 0 && (
                    <div className="flex justify-between text-indigo-400">
                      <span>Night Surge:</span>
                      <span className="font-medium">+₹{simTransportResult.nightSurge.toFixed(2)}</span>
                    </div>
                  )}
                  {simTransportResult.platformFee > 0 && (
                    <div className="flex justify-between">
                      <span>Platform Booking Fee:</span>
                      <span className="text-white font-medium">₹{simTransportResult.platformFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800 text-[11px]">
                    <span>Minimum Fare Floor:</span>
                    <span>₹{simTransportResult.minimumFare.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ====================================================================== */
        /* TAB 2: DELIVERY CHARGES                                                */
        /* ====================================================================== */
        <div className="space-y-6">
          {/* Active Live Delivery Rates Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 bg-gradient-to-r from-slate-50/70 to-white">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                    Live Active Delivery Rate Schedule
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    • Last edited by {deliveryActive?.updatedBy || 'Admin'}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 m-0 tracking-tight">
                  {deliveryActive?.configName || 'Standard E-Commerce Delivery Pricing'}
                </h2>
                <p className="text-sm text-slate-500 m-0 mt-1 font-normal">
                  {deliveryActive?.description || 'Applied automatically to customer cart, checkout, orders, and courier dispatches.'}
                </p>
              </div>

              {/* Edit Mode Buttons */}
              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                {isEditingActiveDelivery ? (
                  <>
                    <button
                      onClick={() => {
                        initActiveDeliveryDraft(deliveryActive);
                        setIsEditingActiveDelivery(false);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveActiveDeliveryDirect}
                      disabled={isSavingActiveDelivery}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium border-none cursor-pointer shadow-sm transition-all disabled:opacity-50"
                    >
                      {isSavingActiveDelivery ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      <span>Save Rates</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      initActiveDeliveryDraft(deliveryActive);
                      setIsEditingActiveDelivery(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#002625] hover:bg-[#003836] text-white text-sm font-medium border-none cursor-pointer shadow-2xs transition-all"
                  >
                    <Edit3 size={15} className="text-[#ff5500]" />
                    <span>Edit Active Rates</span>
                  </button>
                )}
              </div>
            </div>

            {/* Rates Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Group 1: Base Delivery Rates */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Package size={17} className="text-[#ff5500]" />
                    Standard Delivery Fees
                  </span>
                  <span className="text-xs text-slate-400 font-normal">Order shipping</span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-normal text-slate-500 block mb-1">Base Delivery Fee</label>
                    {isEditingActiveDelivery ? (
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-medium text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={activeDeliveryDraft?.baseDeliveryFee ?? 40}
                          onChange={(e) =>
                            setActiveDeliveryDraft({ ...activeDeliveryDraft, baseDeliveryFee: e.target.value })
                          }
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                        />
                      </div>
                    ) : (
                      <div className="text-2xl font-semibold text-slate-800 flex items-baseline gap-1 tabular-nums">
                        <span className="text-[#ff5500] text-lg font-medium">₹</span>
                        <span>{deliveryActive?.baseDeliveryFee ?? 40}</span>
                        <span className="text-xs font-normal text-slate-400 ml-1.5">(standard fee)</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-normal text-slate-500 block mb-1">Minimum Delivery Fee</label>
                    {isEditingActiveDelivery ? (
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-medium text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={activeDeliveryDraft?.minimumDeliveryFee ?? 40}
                          onChange={(e) =>
                            setActiveDeliveryDraft({ ...activeDeliveryDraft, minimumDeliveryFee: e.target.value })
                          }
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                        />
                      </div>
                    ) : (
                      <div className="text-xl font-semibold text-slate-700 flex items-baseline gap-1 tabular-nums">
                        <span className="text-[#ff5500] text-base font-medium">₹</span>
                        <span>{deliveryActive?.minimumDeliveryFee ?? 40}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-normal text-slate-500 block mb-1">Cash on Delivery (COD) Extra Fee</label>
                    {isEditingActiveDelivery ? (
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-medium text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={activeDeliveryDraft?.codCharge ?? 9}
                          onChange={(e) =>
                            setActiveDeliveryDraft({ ...activeDeliveryDraft, codCharge: e.target.value })
                          }
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                        />
                      </div>
                    ) : (
                      <div className="text-xl font-semibold text-orange-600 flex items-baseline gap-1 tabular-nums">
                        <span className="text-orange-600 text-base font-medium">₹</span>
                        <span>{deliveryActive?.codCharge ?? 9}</span>
                        <span className="text-xs font-normal text-slate-400 ml-1.5">(on COD checkout)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Group 2: Free Delivery & Radius */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Tag size={17} className="text-emerald-600" />
                    Free Shipping & Radius
                  </span>
                  {isEditingActiveDelivery ? (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeDeliveryDraft?.isFreeDeliveryEnabled}
                        onChange={(e) =>
                          setActiveDeliveryDraft({ ...activeDeliveryDraft, isFreeDeliveryEnabled: e.target.checked })
                        }
                        className="w-4 h-4 accent-emerald-600 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-emerald-800">Free Shipping</span>
                    </label>
                  ) : deliveryActive?.isFreeDeliveryEnabled ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      Enabled
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                      Disabled
                    </span>
                  )}
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-normal text-slate-500 block mb-1">
                      Free Delivery Above Cart Value
                    </label>
                    {isEditingActiveDelivery ? (
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-medium text-emerald-600">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="25"
                          value={activeDeliveryDraft?.freeDeliveryThreshold ?? 500}
                          onChange={(e) =>
                            setActiveDeliveryDraft({ ...activeDeliveryDraft, freeDeliveryThreshold: e.target.value })
                          }
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-600 text-sm font-medium text-emerald-700 outline-none bg-white tabular-nums"
                        />
                      </div>
                    ) : (
                      <div className="text-2xl font-semibold text-emerald-600 flex items-baseline gap-1 tabular-nums">
                        <span className="text-emerald-600 text-lg font-medium">₹</span>
                        <span>{deliveryActive?.freeDeliveryThreshold ?? 500}</span>
                        <span className="text-xs font-normal text-slate-400 ml-1.5">(orders &ge; this get free shipping)</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-normal text-slate-500 block mb-1">Standard Radius</label>
                      {isEditingActiveDelivery ? (
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={activeDeliveryDraft?.thresholdDistanceKm ?? 5}
                          onChange={(e) =>
                            setActiveDeliveryDraft({ ...activeDeliveryDraft, thresholdDistanceKm: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                        />
                      ) : (
                        <div className="text-base font-semibold text-slate-800 tabular-nums">
                          {deliveryActive?.thresholdDistanceKm ?? 5} km
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-normal text-slate-500 block mb-1">Extra KM Surcharge</label>
                      {isEditingActiveDelivery ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={activeDeliveryDraft?.extraDistanceCharge ?? 10}
                          onChange={(e) =>
                            setActiveDeliveryDraft({ ...activeDeliveryDraft, extraDistanceCharge: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                        />
                      ) : (
                        <div className="text-base font-semibold text-slate-800 tabular-nums">
                          +₹{deliveryActive?.extraDistanceCharge ?? 10}/km
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: Rain & Peak Surge */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <CloudRain size={17} className="text-blue-600" />
                    Rain & Peak Surge
                  </span>
                  {isEditingActiveDelivery ? (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeDeliveryDraft?.peakSurgeEnabled}
                        onChange={(e) =>
                          setActiveDeliveryDraft({ ...activeDeliveryDraft, peakSurgeEnabled: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#ff5500] cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        {activeDeliveryDraft?.peakSurgeEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  ) : deliveryActive?.peakSurge?.enabled ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                      Active
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                      Disabled
                    </span>
                  )}
                </div>

                <div className="space-y-3.5">
                  {isEditingActiveDelivery ? (
                    activeDeliveryDraft?.peakSurgeEnabled ? (
                      <div>
                        <label className="text-xs font-normal text-slate-500 block mb-1">
                          Rain Surcharge Flat Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={activeDeliveryDraft?.peakSurgeAmount ?? 20}
                          onChange={(e) =>
                            setActiveDeliveryDraft({ ...activeDeliveryDraft, peakSurgeAmount: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-[#ff5500] text-sm font-medium text-slate-900 outline-none bg-white tabular-nums"
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-3 m-0 font-normal">
                        Rain surcharge is currently disabled. Check the box above to enable surge fees during bad weather.
                      </p>
                    )
                  ) : deliveryActive?.peakSurge?.enabled ? (
                    <div>
                      <span className="text-xs font-normal text-slate-500 block">Flat Surge Fee</span>
                      <div className="text-xl font-semibold text-amber-700 flex items-center gap-1.5 mt-0.5">
                        <Zap size={18} className="text-amber-500" />
                        <span>+₹{deliveryActive.peakSurge.surgeAmount || 20}</span>
                      </div>
                      <span className="text-xs text-slate-400 mt-1 block font-normal">
                        {deliveryActive.peakSurge.description || 'Rain / bad weather surcharge'}
                      </span>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-sm text-slate-400 m-0 font-normal">No active bad weather / rain surcharge</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dual Columns: Delivery Calculator & Saved Presets */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Quick Delivery Fee Calculator (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#ff5500] flex items-center justify-center">
                    <Calculator size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 m-0">Delivery Fee Calculator</h3>
                    <p className="text-xs text-slate-400 m-0 font-normal">Simulate order shipping charges</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSimCart(350);
                    setSimDelivDist(6.2);
                    setSimSurge(false);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-700 font-medium flex items-center gap-1 bg-transparent border-none cursor-pointer"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>

              {/* Sliders & Inputs */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm font-medium text-slate-700 mb-1.5">
                    <span>Order Cart Value</span>
                    <span className="text-emerald-700 font-semibold">₹{simCart}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1500"
                    step="25"
                    value={simCart}
                    onChange={(e) => setSimCart(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex gap-2 mt-2">
                    {[150, 300, 500, 800, 1200].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSimCart(val)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                          simCart === val
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-medium text-slate-700 mb-1.5">
                    <span>Delivery Distance</span>
                    <span className="text-[#ff5500] font-semibold">{simDelivDist} km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="0.5"
                    value={simDelivDist}
                    onChange={(e) => setSimDelivDist(parseFloat(e.target.value))}
                    className="w-full accent-[#ff5500] cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1 font-normal">
                    <span>1 km</span>
                    <span>Radius included: {activeDeliveryData?.thresholdDistanceKm || 5}km</span>
                    <span>25 km</span>
                  </div>
                </div>

                {/* Rain Surge Switch */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <CloudRain size={17} className={simSurge ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-sm font-medium text-slate-800">Simulate Rain Surge</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={simSurge}
                    onChange={(e) => setSimSurge(e.target.checked)}
                    className="w-4 h-4 accent-[#ff5500] cursor-pointer"
                  />
                </div>
              </div>

              {/* Receipt Summary Box */}
              <div className="bg-slate-900 text-white p-4.5 rounded-xl space-y-2.5 border border-slate-800">
                <div className="flex items-baseline justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-sm font-normal text-slate-300">Customer Delivery Fee</span>
                  <div className="text-2xl font-bold tabular-nums">
                    {simDeliveryResult.finalFee === 0 ? (
                      <span className="text-emerald-400">FREE DELIVERY</span>
                    ) : (
                      <span className="text-[#ff5500]">₹{simDeliveryResult.finalFee.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-1 font-normal">
                  <div className="flex justify-between">
                    <span>Base Delivery Fee:</span>
                    <span className="text-white font-medium">₹{simDeliveryResult.baseDeliveryFee.toFixed(2)}</span>
                  </div>
                  {simDeliveryResult.extraDistCharge > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Extra Distance ({simDelivDist - simDeliveryResult.thresholdDistanceKm} km):</span>
                      <span className="font-medium">+₹{simDeliveryResult.extraDistCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {simDeliveryResult.surgeFee > 0 && (
                    <div className="flex justify-between text-blue-400">
                      <span>Rain Surge:</span>
                      <span className="font-medium">+₹{simDeliveryResult.surgeFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-400 font-medium pt-1.5 border-t border-slate-800">
                    <span>Free Shipping Status:</span>
                    <span>{simDeliveryResult.isFree ? 'QUALIFIED (100% Free)' : `Cart ₹${simCart} / ₹${activeDeliveryData?.freeDeliveryThreshold || 500}`}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Saved Delivery Rate Presets (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 m-0">Saved Rate Presets</h3>
                    <p className="text-xs text-slate-400 m-0 font-normal">
                      {deliveryList.length} template{deliveryList.length !== 1 ? 's' : ''} available
                    </p>
                  </div>
                </div>
              </div>

              {/* Presets List */}
              <div className="space-y-3">
                {deliveryList.map((cfg) => {
                  const isActive = cfg.isActive;
                  return (
                    <div
                      key={cfg._id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900">{cfg.configName}</span>
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium text-xs">
                              <Check size={12} className="stroke-[2.5]" /> Active Live
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-normal text-xs">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 font-normal">
                          <span>Base: ₹{cfg.baseDeliveryFee}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium">Free &ge; ₹{cfg.freeDeliveryThreshold}</span>
                          <span>•</span>
                          <span>Radius: {cfg.thresholdDistanceKm}km</span>
                          <span>•</span>
                          <span>Extra: +₹{cfg.extraDistanceCharge}/km</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {!isActive && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await pricingService.activateDeliveryPricing(cfg._id);
                                if (res && res.success) {
                                  showFeedback('success', 'Delivery preset activated!');
                                  await fetchData();
                                }
                              } catch (err) {
                                showFeedback('error', 'Failed to activate preset.');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs border-none cursor-pointer transition-colors shadow-2xs"
                            title="Make this active"
                          >
                            Activate
                          </button>
                        )}
                        {!isActive && (
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                open: true,
                                type: 'delivery',
                                id: cfg._id,
                                name: cfg.configName,
                              })
                            }
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border-none bg-transparent cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* ADD / EDIT VEHICLE TYPE MODAL                                           */}
      {/* ====================================================================== */}
      {vehicleModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn my-6">
            <div className="bg-[#002625] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#003836] text-[#ff5500] flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white m-0">
                    {vehicleModal.mode === 'add' ? 'Add New Vehicle Category' : 'Edit Vehicle Category'}
                  </h3>
                  <p className="text-xs text-teal-300 m-0 font-normal">
                    Configure rates, payload capacity, and fees for this vehicle type
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVehicleModal({ open: false, mode: 'add', data: {} })}
                className="text-slate-400 hover:text-white p-1 rounded-lg border-none bg-transparent cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicleModal} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-800 block mb-1">
                    Vehicle Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vehicleModal.data.name || ''}
                    onChange={(e) =>
                      setVehicleModal({
                        ...vehicleModal,
                        data: { ...vehicleModal.data, name: e.target.value },
                      })
                    }
                    placeholder="e.g. Tata Ace / 3 Wheeler / E-Rickshaw"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#ff5500] text-sm font-medium text-slate-800 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-800 block mb-1">Icon Type</label>
                  <select
                    value={vehicleModal.data.icon || 'truck'}
                    onChange={(e) =>
                      setVehicleModal({
                        ...vehicleModal,
                        data: { ...vehicleModal.data, icon: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 outline-none bg-white"
                  >
                    <option value="truck">🚚 Truck / Cargo Auto</option>
                    <option value="bike">🏍️ Motorcycle / Scooter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-800 block mb-1">Max Capacity (kg)</label>
                  <input
                    type="number"
                    min="1"
                    value={vehicleModal.data.capacityKg || 500}
                    onChange={(e) =>
                      setVehicleModal({
                        ...vehicleModal,
                        data: { ...vehicleModal.data, capacityKg: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-800 block mb-1">Per KM Rate (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={vehicleModal.data.perKmFare || 15}
                    onChange={(e) =>
                      setVehicleModal({
                        ...vehicleModal,
                        data: { ...vehicleModal.data, perKmFare: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 outline-none tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-800 block mb-1">Base Fare (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={vehicleModal.data.baseFare || 50}
                    onChange={(e) =>
                      setVehicleModal({
                        ...vehicleModal,
                        data: { ...vehicleModal.data, baseFare: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 outline-none tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-800 block mb-1">Minimum Fare Floor (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={vehicleModal.data.minimumFare || 80}
                    onChange={(e) =>
                      setVehicleModal({
                        ...vehicleModal,
                        data: { ...vehicleModal.data, minimumFare: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-800 block mb-1">Platform Booking Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={vehicleModal.data.platformFee || 10}
                    onChange={(e) =>
                      setVehicleModal({
                        ...vehicleModal,
                        data: { ...vehicleModal.data, platformFee: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 outline-none tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-800 block mb-1">Description</label>
                <input
                  type="text"
                  value={vehicleModal.data.description || ''}
                  onChange={(e) =>
                    setVehicleModal({
                      ...vehicleModal,
                      data: { ...vehicleModal.data, description: e.target.value },
                    })
                  }
                  placeholder="e.g. Suitable for small furniture & medium parcels"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="modalVehicleActive"
                  checked={vehicleModal.data.isActive}
                  onChange={(e) =>
                    setVehicleModal({
                      ...vehicleModal,
                      data: { ...vehicleModal.data, isActive: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="modalVehicleActive" className="text-xs font-medium text-slate-800 cursor-pointer">
                  Vehicle is active and available for customer bookings
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVehicleModal({ open: false, mode: 'add', data: {} })}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingVehicle}
                  className="px-6 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff661a] text-white text-sm font-medium border-none cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingVehicle && <Loader2 size={16} className="animate-spin" />}
                  <span>{vehicleModal.mode === 'add' ? 'Create Vehicle Type' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* AUDIT HISTORY MODAL                                                     */}
      {/* ====================================================================== */}
      {historyModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="bg-[#002625] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <History size={20} className="text-[#ff5500]" />
                <h3 className="text-base font-semibold text-white m-0">{historyModal.title}</h3>
              </div>
              <button
                onClick={() => setHistoryModal({ open: false, title: '', history: [] })}
                className="text-slate-400 hover:text-white p-1 rounded-lg border-none bg-transparent cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3">
              {historyModal.history.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8 m-0 font-normal">No past audit revisions found.</p>
              ) : (
                historyModal.history.map((h, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800">{h.changedBy || 'Admin'}</span>
                      <span className="text-slate-400 font-mono font-normal">
                        {h.changedAt ? new Date(h.changedAt).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 m-0 font-normal">{h.reason || 'Configuration updated'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                               */}
      {/* ====================================================================== */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-6 text-center space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 m-0 mb-1">Delete Configuration?</h3>
              <p className="text-sm text-slate-500 m-0 font-normal">
                Are you sure you want to delete <strong>&ldquo;{deleteConfirm.name}&rdquo;</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => setDeleteConfirm({ open: false, type: '', id: '', name: '' })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirm.type === 'delivery') {
                    await pricingService.deleteDeliveryPricing(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'vehicle') {
                    await pricingService.deleteVehicleType(deleteConfirm.id);
                  }
                  setDeleteConfirm({ open: false, type: '', id: '', name: '' });
                  showFeedback('success', 'Item deleted successfully.');
                  await fetchData();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium border-none cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingChargesManagement;
