import React, { useState, useEffect } from 'react';
import {
  Percent, DollarSign, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw,
  Search, Filter, Calendar, ArrowUpRight, ShieldCheck, History,
  FileText, ExternalLink, Eye, X, Edit3, Sparkles, Check, ToggleLeft, ToggleRight, Loader2,
  Truck, Store, ShoppingBag, TrendingUp, Info, HelpCircle, ChevronRight, CheckCircle2
} from 'lucide-react';
import commissionService from '../../../services/commissionService';

export const CommissionManagement = () => {
  // ── Settings State ──────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Edit States for Seller & Captain
  const [editingSeller, setEditingSeller] = useState(false);
  const [sellerRateInput, setSellerRateInput] = useState('10');
  const [sellerError, setSellerError] = useState('');

  const [editingCaptain, setEditingCaptain] = useState(false);
  const [captainRateInput, setCaptainRateInput] = useState('5');
  const [captainError, setCaptainError] = useState('');

  // Edit States for Customer Delivery Charges, Free Delivery & COD Fee
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryChargeInput, setDeliveryChargeInput] = useState('40');
  const [freeDeliveryMinInput, setFreeDeliveryMinInput] = useState('500');
  const [isFreeDeliveryEnabled, setIsFreeDeliveryEnabled] = useState(true);
  const [codChargeInput, setCodChargeInput] = useState('9');
  const [isCodChargeEnabled, setIsCodChargeEnabled] = useState(true);
  const [deliveryError, setDeliveryError] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // ── Reporting & Transactions State ──────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalVolume: 0,
    totalSellerCommission: 0,
    totalCaptainCommission: 0,
    totalSellerEarnings: 0,
    totalCaptainEarnings: 0,
  });
  const [loadingReports, setLoadingReports] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });

  // Filters State
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchSeller, setSearchSeller] = useState('');
  const [searchCaptain, setSearchCaptain] = useState('');
  const [commissionTypeFilter, setCommissionTypeFilter] = useState('ALL'); // 'ALL' | 'SELLER' | 'CAPTAIN'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Report Modal
  const [selectedReport, setSelectedReport] = useState(null);

  // ── Fetch Settings ──────────────────────────────────────────────────────────
  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await commissionService.getAdminCommissionSettings();
      if (res && res.success && res.settings) {
        setSettings(res.settings);
        setSellerRateInput(String(res.settings.sellerCommission ?? 10));
        setCaptainRateInput(String(res.settings.captainCommission ?? 5));
        setDeliveryChargeInput(String(res.settings.deliveryCharge ?? 40));
        setFreeDeliveryMinInput(String(res.settings.freeDeliveryMinOrder ?? 500));
        setIsFreeDeliveryEnabled(res.settings.isFreeDeliveryEnabled !== undefined ? Boolean(res.settings.isFreeDeliveryEnabled) : true);
        setCodChargeInput(String(res.settings.codCharge ?? 9));
        setIsCodChargeEnabled(res.settings.isCodChargeEnabled !== undefined ? Boolean(res.settings.isCodChargeEnabled) : true);
      }
    } catch (err) {
      console.error('Failed to fetch commission settings:', err);
      showFeedback('error', err?.response?.data?.message || 'Failed to load commission settings.');
    } finally {
      setLoadingSettings(false);
    }
  };

  // ── Fetch Commission Reports ────────────────────────────────────────────────
  const fetchReports = async (page = 1) => {
    try {
      setLoadingReports(true);
      const params = {
        page,
        limit: pagination.limit,
        orderId: searchOrderId.trim() || undefined,
        seller: searchSeller.trim() || undefined,
        captain: searchCaptain.trim() || undefined,
        commissionType: commissionTypeFilter !== 'ALL' ? commissionTypeFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const res = await commissionService.getAdminCommissionReports(params);
      if (res && res.success) {
        setReports(res.reports || []);
        if (res.stats) setStats(res.stats);
        if (res.pagination) {
          setPagination({
            page: res.pagination.page,
            limit: res.pagination.limit,
            totalCount: res.pagination.totalCount,
            totalPages: res.pagination.totalPages,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch commission reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchReports(1);
  }, []);

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
  };

  // ── Save Commission Rates ───────────────────────────────────────────────────
  const handleSaveRates = async (targetRole) => {
    let sVal = targetRole === 'seller' ? parseFloat(sellerRateInput) : Number(settings?.sellerCommission ?? 10);
    let cVal = targetRole === 'captain' ? parseFloat(captainRateInput) : Number(settings?.captainCommission ?? 5);

    // Validation
    if (targetRole === 'seller') {
      if (isNaN(sVal) || sVal < 0 || sVal > 100) {
        setSellerError('Seller commission must be a valid percentage between 0 and 100.');
        return;
      }
      setSellerError('');
    }

    if (targetRole === 'captain') {
      if (isNaN(cVal) || cVal < 0 || cVal > 100) {
        setCaptainError('Captain commission must be a valid percentage between 0 and 100.');
        return;
      }
      setCaptainError('');
    }

    setSavingSettings(true);
    try {
      const payload = {
        sellerCommission: sVal,
        captainCommission: cVal,
        isActive: settings?.isActive !== undefined ? settings.isActive : true,
        reason: `Admin updated ${targetRole.toUpperCase()} commission to ${targetRole === 'seller' ? sVal : cVal}%`,
      };

      const res = await commissionService.updateAdminCommissionSettings(payload);
      if (res && res.success) {
        setSettings(res.settings);
        showFeedback('success', `${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)} commission updated to ${targetRole === 'seller' ? sVal : cVal}% successfully!`);
        if (targetRole === 'seller') setEditingSeller(false);
        if (targetRole === 'captain') setEditingCaptain(false);
        fetchReports(1);
      }
    } catch (err) {
      showFeedback('error', err?.response?.data?.message || 'Failed to update commission settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveDeliverySettings = async () => {
    const chargeVal = parseFloat(deliveryChargeInput);
    const minVal = parseFloat(freeDeliveryMinInput);
    const codVal = parseFloat(codChargeInput);

    if (isNaN(chargeVal) || chargeVal < 0) {
      setDeliveryError('Standard delivery charge must be a valid non-negative number.');
      return;
    }
    if (isNaN(minVal) || minVal < 0) {
      setDeliveryError('Free delivery minimum order amount must be a valid non-negative number.');
      return;
    }
    if (isNaN(codVal) || codVal < 0) {
      setDeliveryError('Cash on Delivery (COD) handling fee must be a valid non-negative number.');
      return;
    }
    setDeliveryError('');
    setSavingSettings(true);
    try {
      const payload = {
        deliveryCharge: chargeVal,
        freeDeliveryMinOrder: minVal,
        isFreeDeliveryEnabled: Boolean(isFreeDeliveryEnabled),
        codCharge: codVal,
        isCodChargeEnabled: Boolean(isCodChargeEnabled),
        reason: `Admin updated delivery & COD settings: Fee ₹${chargeVal}, Free above ₹${minVal}, COD Extra ₹${codVal} (${isCodChargeEnabled ? 'Enabled' : 'Disabled'})`,
      };
      const res = await commissionService.updateAdminCommissionSettings(payload);
      if (res && res.success) {
        setSettings(res.settings);
        showFeedback('success', 'Customer delivery & Cash on Delivery (COD) settings saved successfully! Changes take effect immediately.');
        setEditingDelivery(false);
      }
    } catch (err) {
      showFeedback('error', err?.response?.data?.message || 'Failed to update delivery settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApplyFilters = (e) => {
    e?.preventDefault();
    fetchReports(1);
  };

  const handleResetFilters = () => {
    setSearchOrderId('');
    setSearchSeller('');
    setSearchCaptain('');
    setCommissionTypeFilter('ALL');
    setStartDate('');
    setEndDate('');
    setTimeout(() => fetchReports(1), 50);
  };

  const currentSellerRate = Number(settings?.sellerCommission ?? 10);
  const currentCaptainRate = Number(settings?.captainCommission ?? 5);
  const currentDeliveryCharge = Number(settings?.deliveryCharge ?? 40);
  const currentFreeDeliveryMinOrder = Number(settings?.freeDeliveryMinOrder ?? 500);
  const currentIsFreeDeliveryEnabled = settings?.isFreeDeliveryEnabled !== undefined ? Boolean(settings.isFreeDeliveryEnabled) : true;
  const currentCodCharge = Number(settings?.codCharge ?? 9);
  const currentIsCodChargeEnabled = settings?.isCodChargeEnabled !== undefined ? Boolean(settings.isCodChargeEnabled) : true;

  return (
    <div className="space-y-6 font-sans max-w-7xl mx-auto pb-12">
      
      {/* ── Top Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-100 text-[#ff5500] rounded-xl font-bold">
              <Percent size={22} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Commission Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Configure dynamic platform commissions for Sellers and Captains. Rate updates apply immediately to new orders without altering historical transactions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <History size={15} />
            Audit History
          </button>
          <button
            onClick={() => { fetchSettings(); fetchReports(pagination.page); }}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw size={15} className={loadingSettings || loadingReports ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Toast Feedback Alert ────────────────────────────────────────────── */}
      {feedback.text && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-semibold animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', text: '' })}
            className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Commission Configuration Cards Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. SELLER COMMISSION CARD */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#ff5500] flex items-center justify-center font-bold">
                  <Store size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0">Seller Commission</h3>
                  <span className="text-[11px] font-semibold text-slate-400">Commission Type: Percentage (%)</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                settings?.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {settings?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Current Value Display / Edit Form */}
            {!editingSeller ? (
              <div className="pt-2 space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Rate</span>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-black text-[#ff5500] tracking-tight">
                    {loadingSettings ? '...' : `${currentSellerRate}%`}
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">per completed order</span>
                </div>
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  New Seller Commission (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={sellerRateInput}
                    onChange={(e) => {
                      setSellerRateInput(e.target.value);
                      setSellerError('');
                    }}
                    placeholder="e.g. 10"
                    className="w-full px-4 py-2.5 border-2 border-[#ff5500] rounded-xl outline-none text-lg font-black text-slate-900 focus:ring-2 focus:ring-[#ff5500]/20"
                    autoFocus
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-base">
                    %
                  </span>
                </div>
                {sellerError && (
                  <p className="text-xs font-semibold text-rose-600 m-0">{sellerError}</p>
                )}
                <p className="text-[11px] text-slate-400 m-0">Enter value between 0% and 100%.</p>
              </div>
            )}
          </div>

          {/* Footer & Actions */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Last Updated:</span>
              <span className="font-semibold text-slate-600">
                {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Default'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!editingSeller ? (
                <button
                  onClick={() => {
                    setSellerRateInput(String(currentSellerRate));
                    setEditingSeller(true);
                  }}
                  className="w-full py-2.5 bg-[#002625] hover:bg-[#003836] text-white font-black text-xs rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Edit3 size={14} />
                  Edit Commission
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingSeller(false);
                      setSellerError('');
                      setSellerRateInput(String(currentSellerRate));
                    }}
                    disabled={savingSettings}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl border-none cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveRates('seller')}
                    disabled={savingSettings}
                    className="flex-1 py-2.5 bg-[#ff5500] hover:bg-[#e64d00] text-white font-black text-xs rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Save Rate
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. CAPTAIN COMMISSION CARD */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0">Captain Commission</h3>
                  <span className="text-[11px] font-semibold text-slate-400">Commission Type: Percentage (%)</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                settings?.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {settings?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Current Value Display / Edit Form */}
            {!editingCaptain ? (
              <div className="pt-2 space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Rate</span>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-black text-emerald-600 tracking-tight">
                    {loadingSettings ? '...' : `${currentCaptainRate}%`}
                  </h2>
                  <span className="text-xs font-semibold text-slate-500">per completed delivery/ride</span>
                </div>
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  New Captain Commission (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={captainRateInput}
                    onChange={(e) => {
                      setCaptainRateInput(e.target.value);
                      setCaptainError('');
                    }}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-2.5 border-2 border-emerald-600 rounded-xl outline-none text-lg font-black text-slate-900 focus:ring-2 focus:ring-emerald-600/20"
                    autoFocus
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-base">
                    %
                  </span>
                </div>
                {captainError && (
                  <p className="text-xs font-semibold text-rose-600 m-0">{captainError}</p>
                )}
                <p className="text-[11px] text-slate-400 m-0">Enter value between 0% and 100%.</p>
              </div>
            )}
          </div>

          {/* Footer & Actions */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Last Updated:</span>
              <span className="font-semibold text-slate-600">
                {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Default'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!editingCaptain ? (
                <button
                  onClick={() => {
                    setCaptainRateInput(String(currentCaptainRate));
                    setEditingCaptain(true);
                  }}
                  className="w-full py-2.5 bg-[#002625] hover:bg-[#003836] text-white font-black text-xs rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Edit3 size={14} />
                  Edit Commission
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingCaptain(false);
                      setCaptainError('');
                      setCaptainRateInput(String(currentCaptainRate));
                    }}
                    disabled={savingSettings}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl border-none cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveRates('captain')}
                    disabled={savingSettings}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Save Rate
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3. LIVE CALCULATION SIMULATOR CARD */}
        <div className="bg-gradient-to-br from-[#002625] to-[#043d3a] rounded-2xl p-6 text-white shadow-md flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-white/10 text-[#ff9966] flex items-center justify-center font-bold">
                <Sparkles size={16} />
              </span>
              <div>
                <h3 className="text-base font-black text-white m-0">Live Rate Simulator</h3>
                <span className="text-[11px] text-teal-200/80 font-normal">Example calculation for ₹1,000 Order</span>
              </div>
            </div>

            <div className="bg-white/10 p-3.5 rounded-xl border border-white/10 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-200">
                <span>Base Transaction Amount:</span>
                <span className="font-bold text-white text-sm">₹1,000.00</span>
              </div>
              <div className="border-t border-white/10 pt-2 space-y-1.5">
                <div className="flex justify-between items-center text-[#ff9966]">
                  <span>Seller Platform Cut ({currentSellerRate}%):</span>
                  <span className="font-bold">₹{((1000 * currentSellerRate) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-300">
                  <span>Seller Net Payout:</span>
                  <span className="font-bold">₹{(1000 - (1000 * currentSellerRate) / 100).toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t border-white/10 pt-2 space-y-1.5">
                <div className="flex justify-between items-center text-amber-300">
                  <span>Captain Platform Cut ({currentCaptainRate}%):</span>
                  <span className="font-bold">₹{((1000 * currentCaptainRate) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-teal-300">
                  <span>Captain Net Payout:</span>
                  <span className="font-bold">₹{(1000 - (1000 * currentCaptainRate) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-teal-200/70 font-normal italic">
            * All commission rate calculations are enforced and frozen server-side upon order completion.
          </div>
        </div>

      </div>

      {/* ── Customer Delivery & Free Shipping Rules ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-[#ff5500] flex items-center justify-center font-bold">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 m-0">Customer Delivery & Order Surcharges Configuration</h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Manage customer delivery charges, free delivery thresholds, and extra Cash on Delivery (COD) handling fees.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!editingDelivery ? (
              <button
                onClick={() => {
                  setDeliveryChargeInput(String(currentDeliveryCharge));
                  setFreeDeliveryMinInput(String(currentFreeDeliveryMinOrder));
                  setIsFreeDeliveryEnabled(currentIsFreeDeliveryEnabled);
                  setCodChargeInput(String(currentCodCharge));
                  setIsCodChargeEnabled(currentIsCodChargeEnabled);
                  setEditingDelivery(true);
                }}
                className="px-4 py-2 bg-[#002625] hover:bg-[#003836] text-white font-black text-xs rounded-xl border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Edit3 size={14} />
                Edit Charges & Rules
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingDelivery(false);
                    setDeliveryError('');
                    setDeliveryChargeInput(String(currentDeliveryCharge));
                    setFreeDeliveryMinInput(String(currentFreeDeliveryMinOrder));
                    setIsFreeDeliveryEnabled(currentIsFreeDeliveryEnabled);
                    setCodChargeInput(String(currentCodCharge));
                    setIsCodChargeEnabled(currentIsCodChargeEnabled);
                  }}
                  disabled={savingSettings}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl border-none cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDeliverySettings}
                  disabled={savingSettings}
                  className="px-4 py-2 bg-[#ff5500] hover:bg-[#e64d00] text-white font-black text-xs rounded-xl border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save All Charges
                </button>
              </div>
            )}
          </div>
        </div>

        {deliveryError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
            ⚠️ {deliveryError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Standard Delivery Fee */}
          <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Standard Delivery Charge</span>
              <p className="text-xs text-slate-500 mt-0.5 m-0">Charged on orders below the free delivery minimum.</p>
            </div>

            {!editingDelivery ? (
              <div className="pt-1">
                <h3 className="text-3xl font-black text-slate-900 m-0">₹{loadingSettings ? '...' : currentDeliveryCharge.toFixed(2)}</h3>
                <span className="text-[11px] font-medium text-slate-400">Fixed rate per delivery</span>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">Standard Delivery Fee (₹)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={deliveryChargeInput}
                    onChange={(e) => {
                      setDeliveryChargeInput(e.target.value);
                      setDeliveryError('');
                    }}
                    placeholder="40"
                    className="w-full pl-8 pr-3 py-2 border-2 border-[#ff5500] rounded-xl outline-none text-base font-black text-slate-900 focus:ring-2 focus:ring-[#ff5500]/20 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Free Delivery Threshold */}
          <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Free Delivery Threshold</span>
                <p className="text-xs text-slate-500 mt-0.5 m-0">Orders at or above this get 100% Free Shipping.</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${
                (editingDelivery ? isFreeDeliveryEnabled : currentIsFreeDeliveryEnabled)
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {(editingDelivery ? isFreeDeliveryEnabled : currentIsFreeDeliveryEnabled) ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {!editingDelivery ? (
              <div className="pt-1">
                <h3 className="text-3xl font-black text-emerald-600 m-0">₹{loadingSettings ? '...' : currentFreeDeliveryMinOrder.toFixed(2)}</h3>
                <span className="text-[11px] font-medium text-slate-400">Free delivery for cart ≥ ₹{currentFreeDeliveryMinOrder}</span>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Min Order Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={freeDeliveryMinInput}
                      onChange={(e) => {
                        setFreeDeliveryMinInput(e.target.value);
                        setDeliveryError('');
                      }}
                      placeholder="500"
                      className="w-full pl-8 pr-3 py-2 border-2 border-emerald-500 rounded-xl outline-none text-base font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/20 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsFreeDeliveryEnabled(!isFreeDeliveryEnabled)}>
                  <input
                    type="checkbox"
                    checked={isFreeDeliveryEnabled}
                    onChange={(e) => setIsFreeDeliveryEnabled(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Enable Free Delivery</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Cash on Delivery (COD) Extra Fee */}
          <div className="p-5 rounded-2xl bg-orange-50/60 border border-orange-200 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#ea580c]">Cash on Delivery (COD) Charge</span>
                <p className="text-xs text-slate-500 mt-0.5 m-0">Extra handling fee added when customer selects COD at checkout.</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${
                (editingDelivery ? isCodChargeEnabled : currentIsCodChargeEnabled)
                  ? 'bg-orange-100 text-[#ea580c] border-orange-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {(editingDelivery ? isCodChargeEnabled : currentIsCodChargeEnabled) ? 'Active' : 'Disabled'}
              </span>
            </div>

            {!editingDelivery ? (
              <div className="pt-1">
                <h3 className="text-3xl font-black text-[#ea580c] m-0">₹{loadingSettings ? '...' : currentCodCharge.toFixed(2)}</h3>
                <span className="text-[11px] font-medium text-slate-500">
                  {currentIsCodChargeEnabled ? `Added only on COD payment (+₹${currentCodCharge})` : 'COD fee disabled'}
                </span>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">COD Extra Fee (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={codChargeInput}
                      onChange={(e) => {
                        setCodChargeInput(e.target.value);
                        setDeliveryError('');
                      }}
                      placeholder="9"
                      className="w-full pl-8 pr-3 py-2 border-2 border-[#ea580c] rounded-xl outline-none text-base font-black text-slate-900 focus:ring-2 focus:ring-[#ea580c]/20 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsCodChargeEnabled(!isCodChargeEnabled)}>
                  <input
                    type="checkbox"
                    checked={isCodChargeEnabled}
                    onChange={(e) => setIsCodChargeEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#ea580c] rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Enable COD Extra Fee</span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Live Customer Summary Rule */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10.5px] font-black uppercase tracking-wider text-orange-400">Live Customer Cart Rules</span>
              <p className="text-[11px] text-slate-300 mt-0.5 m-0">Applied automatically in real-time across user Cart & Checkout.</p>
            </div>

            <div className="bg-white/10 p-3 rounded-xl space-y-1.5 text-xs border border-white/10">
              <div className="flex justify-between items-center text-slate-300">
                <span>Cart &lt; ₹{editingDelivery ? (freeDeliveryMinInput || '500') : currentFreeDeliveryMinOrder}:</span>
                <span className="font-bold text-amber-300">+₹{editingDelivery ? (deliveryChargeInput || '40') : currentDeliveryCharge} Delivery</span>
              </div>
              <div className="flex justify-between items-center text-emerald-300 border-t border-white/10 pt-1">
                <span>Cart &ge; ₹{editingDelivery ? (freeDeliveryMinInput || '500') : currentFreeDeliveryMinOrder}:</span>
                <span className="font-extrabold text-emerald-400">FREE Delivery (₹0)</span>
              </div>
              <div className="flex justify-between items-center text-orange-300 border-t border-white/10 pt-1">
                <span>Payment = COD:</span>
                <span className="font-extrabold text-[#ff9966]">
                  {editingDelivery
                    ? (isCodChargeEnabled ? `+₹${codChargeInput || '9'} Extra` : '₹0 Extra')
                    : (currentIsCodChargeEnabled ? `+₹${currentCodCharge} Extra` : '₹0 Extra')}
                </span>
              </div>
            </div>

            <span className="text-[10px] text-slate-400">
              * Saved changes apply immediately to user checkout and backend order validations.
            </span>
          </div>
        </div>
      </div>

      {/* ── Summary Aggregate Badges ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Total Volume</span>
          <p className="text-lg font-black text-slate-900 m-0">₹{stats.totalVolume.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-400">Filtered orders</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[10.5px] font-black uppercase text-[#ff5500] tracking-wider">Seller Comm.</span>
          <p className="text-lg font-black text-[#ff5500] m-0">₹{stats.totalSellerCommission.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-400">Platform revenue</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[10.5px] font-black uppercase text-emerald-600 tracking-wider">Captain Comm.</span>
          <p className="text-lg font-black text-emerald-600 m-0">₹{stats.totalCaptainCommission.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-400">Platform revenue</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[10.5px] font-black uppercase text-blue-600 tracking-wider">Seller Earnings</span>
          <p className="text-lg font-black text-blue-600 m-0">₹{stats.totalSellerEarnings.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-400">Net store revenue</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[10.5px] font-black uppercase text-teal-600 tracking-wider">Captain Earnings</span>
          <p className="text-lg font-black text-teal-600 m-0">₹{stats.totalCaptainEarnings.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-400">Net rider payouts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-[10.5px] font-black uppercase text-purple-600 tracking-wider">Orders Audited</span>
          <p className="text-lg font-black text-purple-600 m-0">{stats.totalTransactions}</p>
          <span className="text-[10px] text-slate-400">Total matched rows</span>
        </div>
      </div>

      {/* ── Commission Reports & Transactions Section ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        
        {/* Filter Toolbar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 m-0">Commission Transaction Reports</h3>
              <p className="text-xs text-slate-500 font-normal m-0 mt-0.5">
                Audit historical commission cuts and net earnings across all orders and rides.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-[#ff5500] hover:bg-[#e64d00] text-white font-black text-xs rounded-xl border-none cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Filter size={13} />
                Filter Data
              </button>
            </div>
          </div>

          {/* Filter Inputs Grid */}
          <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            
            {/* Search by Order ID */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Order ID..."
                value={searchOrderId}
                onChange={(e) => setSearchOrderId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
              />
            </div>

            {/* Filter by Seller */}
            <div className="relative">
              <Store size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter Seller Name..."
                value={searchSeller}
                onChange={(e) => setSearchSeller(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
              />
            </div>

            {/* Filter by Captain */}
            <div className="relative">
              <Truck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter Captain Name..."
                value={searchCaptain}
                onChange={(e) => setSearchCaptain(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
              />
            </div>

            {/* Commission Type Selector */}
            <div>
              <select
                value={commissionTypeFilter}
                onChange={(e) => setCommissionTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
              >
                <option value="ALL">All Commission Types</option>
                <option value="SELLER">Seller Commission Only</option>
                <option value="CAPTAIN">Captain Commission Only</option>
              </select>
            </div>

            {/* Date Range Start & End */}
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                title="Start Date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                title="End Date"
              />
            </div>

          </form>
        </div>

        {/* ── Reports Data Table ────────────────────────────────────────────── */}
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-extrabold text-[10.5px]">
                <th className="py-3 px-3">Order ID / Type</th>
                <th className="py-3 px-3">Seller</th>
                <th className="py-3 px-3">Captain</th>
                <th className="py-3 px-3 text-right">Order Amount</th>
                <th className="py-3 px-3 text-right">Seller Commission</th>
                <th className="py-3 px-3 text-right">Captain Commission</th>
                <th className="py-3 px-3 text-right">Seller Earning</th>
                <th className="py-3 px-3 text-right">Captain Earning</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loadingReports ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#ff5500]" />
                    <span>Loading commission reports...</span>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    <FileText size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600 m-0">No commission records found</p>
                    <p className="text-xs text-slate-400 m-0 mt-1">Try adjusting your filter criteria</p>
                  </td>
                </tr>
              ) : (
                reports.map((row) => (
                  <tr key={row.id || row.orderId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-black text-slate-900 tracking-tight">{row.orderId}</div>
                      <span className="text-[10px] text-slate-400">{row.type}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-800 truncate max-w-[140px]" title={row.sellerName}>
                        {row.sellerName}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-800 truncate max-w-[130px]" title={row.captainName}>
                        {row.captainName}
                      </div>
                      {row.captainPhone && (
                        <span className="text-[10px] text-slate-400">{row.captainPhone}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right font-black text-slate-900">
                      ₹{row.orderAmount.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {row.sellerCommissionRate > 0 ? (
                        <div>
                          <span className="font-black text-[#ff5500]">₹{row.sellerCommissionAmount.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 block font-semibold">({row.sellerCommissionRate}%)</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {row.captainCommissionRate > 0 ? (
                        <div>
                          <span className="font-black text-emerald-600">₹{row.captainCommissionAmount.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 block font-semibold">({row.captainCommissionRate}%)</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {row.sellerEarning > 0 ? (
                        <span className="font-black text-blue-600">₹{row.sellerEarning.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {row.captainEarning > 0 ? (
                        <span className="font-black text-teal-600">₹{row.captainEarning.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        row.orderStatus === 'Delivered' || row.orderStatus === 'RIDE_COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : row.orderStatus === 'Cancelled'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {row.orderStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedReport(row)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer transition-colors border-none bg-transparent"
                        title="View Detailed Breakdown"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Bar ────────────────────────────────────────────────── */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>
              Showing {reports.length} of {pagination.totalCount} transactions
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchReports(pagination.page - 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold"
              >
                Previous
              </button>
              <span className="px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchReports(pagination.page + 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── AUDIT HISTORY MODAL ─────────────────────────────────────────────── */}
      {isHistoryModalOpen && (
        <div
          onClick={() => setIsHistoryModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 my-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-orange-100 text-[#ff5500] rounded-xl font-bold">
                  <History size={18} />
                </span>
                <h3 className="text-lg font-black text-slate-900 m-0">Commission Rate Change Log</h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
              {!settings?.history || settings.history.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No audit records logged yet.</div>
              ) : (
                settings.history.map((h, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        Seller: <strong className="text-[#ff5500]">{h.sellerCommission}%</strong> | Captain: <strong className="text-emerald-600">{h.captainCommission}%</strong>
                      </span>
                      <span className="text-[10.5px] text-slate-400">
                        {new Date(h.changedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 m-0">{h.reason || 'Commission rate updated'}</p>
                    <span className="text-[10px] text-slate-400 block">Changed by: {h.changedBy}</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTION DETAIL MODAL ────────────────────────────────────────── */}
      {selectedReport && (
        <div
          onClick={() => setSelectedReport(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 my-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 m-0">Commission Breakdown: {selectedReport.orderId}</h3>
                <span className="text-[11px] text-slate-400">{selectedReport.type}</span>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Gross Transaction Amount:</span>
                  <span className="text-slate-900 text-sm">₹{selectedReport.orderAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Order Status:</span>
                  <span className="font-bold">{selectedReport.orderStatus}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Created At:</span>
                  <span>{new Date(selectedReport.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Seller Cut Breakdown */}
              <div className="bg-orange-50/70 p-3.5 rounded-xl border border-orange-200 space-y-1.5">
                <div className="font-black text-[#ff5500] text-xs uppercase tracking-wider">Seller Commission Breakdown</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Store / Seller:</span>
                  <span className="font-bold text-slate-900">{selectedReport.sellerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Applied Rate:</span>
                  <span className="font-bold text-slate-900">{selectedReport.sellerCommissionRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Platform Commission Cut:</span>
                  <span className="font-black text-[#ff5500]">₹{selectedReport.sellerCommissionAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-orange-200/60 pt-1 font-bold">
                  <span className="text-slate-800">Seller Net Earning:</span>
                  <span className="font-black text-blue-600">₹{selectedReport.sellerEarning.toFixed(2)}</span>
                </div>
              </div>

              {/* Captain Cut Breakdown */}
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-1.5">
                <div className="font-black text-emerald-700 text-xs uppercase tracking-wider">Captain Commission Breakdown</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Assigned Captain:</span>
                  <span className="font-bold text-slate-900">{selectedReport.captainName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Applied Rate:</span>
                  <span className="font-bold text-slate-900">{selectedReport.captainCommissionRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Platform Commission Cut:</span>
                  <span className="font-black text-emerald-600">₹{selectedReport.captainCommissionAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200/60 pt-1 font-bold">
                  <span className="text-slate-800">Captain Net Earning:</span>
                  <span className="font-black text-teal-600">₹{selectedReport.captainEarning.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CommissionManagement;
