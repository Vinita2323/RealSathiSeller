import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Settings, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  IndianRupee, 
  RefreshCw, 
  Search, 
  Filter, 
  Calendar, 
  Eye, 
  Check, 
  X, 
  ArrowUpRight, 
  Store, 
  Truck, 
  Sparkles, 
  ShieldCheck, 
  ChevronRight, 
  Loader2, 
  ToggleLeft, 
  ToggleRight,
  Info,
  DollarSign,
  Share2
} from 'lucide-react';
import { referralService } from '../../../services/authService';

// ══════════════════════════════════════════════════════════════════════════════
// 1. REFERRAL DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export const ReferralDashboard = ({ onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    sellerCount: 0,
    captainCount: 0,
    successfulCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    totalRewardsPaid: 0,
    totalPendingRewards: 0,
    recentReferrals: [],
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes] = await Promise.all([
        referralService.getStats(),
        referralService.getAllReferrals({ page: 1, limit: 10 }).catch(() => null),
      ]);
      if (statsRes && statsRes.success && statsRes.stats) {
        const s = statsRes.stats;
        // Map API field names → dashboard card keys (#89)
        setStats({
          total: s.total || 0,
          sellerCount: s.sellerCount ?? s.sellerReferrals ?? 0,
          captainCount: s.captainCount ?? s.captainReferrals ?? 0,
          successfulCount: s.successfulCount ?? s.rewarded ?? 0,
          pendingCount: s.pendingCount ?? s.pending ?? s.registered ?? 0,
          rejectedCount: s.rejectedCount ?? s.rejected ?? 0,
          totalRewardsPaid: s.totalRewardsPaid ?? s.totalRewardCredited ?? 0,
          totalPendingRewards: s.totalPendingRewards ?? 0,
          recentReferrals: recentRes?.referrals || s.recentReferrals || [],
        });
      }
    } catch (err) {
      console.error('Error fetching referral stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Rewarded':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Rewarded</span>;
      case 'Approved':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">Approved</span>;
      case 'Registered':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Registered</span>;
      case 'Rejected':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">Rejected</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{status || 'Pending'}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-100 text-[#ff5500] rounded-xl">
              <Gift size={22} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Refer & Earn Dashboard</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time analytics and financial overview of seller & captain referral activities.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-xs flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#ff5500]' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Primary KPI Grid (8 metrics required by user) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Total Referrals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Referrals</span>
            <Users size={18} className="text-slate-400" />
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {stats.total || 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">All platform referrals</span>
        </div>

        {/* 2. Total Seller Referrals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-orange-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Seller Referrals</span>
            <Store size={18} className="text-[#ff5500]" />
          </div>
          <div className="text-3xl font-black text-[#ff5500] tracking-tight">
            {stats.sellerCount || 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Referred store partners</span>
        </div>

        {/* 3. Total Captain Referrals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-teal-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Captain Referrals</span>
            <Truck size={18} className="text-teal-600" />
          </div>
          <div className="text-3xl font-black text-teal-700 tracking-tight">
            {stats.captainCount || 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Referred delivery drivers</span>
        </div>

        {/* 4. Successful Referrals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Successful</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight">
            {stats.successfulCount || 0}
          </div>
          <span className="text-[11px] text-emerald-600/80 font-medium">Rewarded & completed</span>
        </div>

        {/* 5. Pending Referrals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Review</span>
            <Clock size={18} className="text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-600 tracking-tight">
            {stats.pendingCount || 0}
          </div>
          <span className="text-[11px] text-amber-600/80 font-medium">Awaiting qualification</span>
        </div>

        {/* 6. Rejected Referrals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rejected</span>
            <XCircle size={18} className="text-rose-500" />
          </div>
          <div className="text-3xl font-black text-rose-600 tracking-tight">
            {stats.rejectedCount || 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Disqualified or duplicate</span>
        </div>

        {/* 7. Total Referral Rewards Paid */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Rewards Paid</span>
            <IndianRupee size={18} className="text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700 tracking-tight">
            ₹{Number(stats.totalRewardsPaid || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Disbursed to wallets</span>
        </div>

        {/* 8. Total Pending Referral Rewards */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pending Rewards</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-700 tracking-tight">
            ₹{Number(stats.totalPendingRewards || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-amber-600 font-medium">Payable liability</span>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight m-0">Recent Referral Activity</h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5">Latest 10 referrals across all platforms</p>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('referral_list')}
              className="text-xs font-bold text-[#ff5500] hover:text-[#e64d00] flex items-center gap-1 cursor-pointer bg-transparent border-none"
            >
              <span>View All Referrals</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Referrer</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Referred User</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2 text-[#ff5500]" />
                    <span>Loading activity...</span>
                  </td>
                </tr>
              ) : !stats.recentReferrals || stats.recentReferrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <Gift size={28} className="mx-auto mb-2 text-slate-300" />
                    <span>No recent referral records recorded yet.</span>
                  </td>
                </tr>
              ) : (
                stats.recentReferrals.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {item.referrerId?.businessName || item.referrerId?.name || 'User'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                        item.referrerRole === 'seller' ? 'bg-orange-50 text-[#ff5500] border border-orange-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}>
                        {item.referrerRole === 'seller' ? <Store size={11} /> : <Truck size={11} />}
                        {item.referrerRole}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{item.referredName || '—'}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {item.referralCode}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      ₹{item.rewardAmount || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. REFERRAL SETTINGS COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export const ReferralSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState({ type: '', text: '' });

  const [settings, setSettings] = useState({
    sellerReferralEnabled: true,
    sellerRewardAmount: 200,
    sellerRewardTrigger: 'admin_approval',
    captainReferralEnabled: true,
    captainRewardAmount: 100,
    captainRewardTrigger: 'admin_approval',
    history: [],
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await referralService.getSettings();
      if (res && res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (err) {
      console.error('Error fetching referral settings:', err);
      showToast('error', 'Failed to load referral settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg({ type: '', text: '' }), 4000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (settings.sellerRewardAmount < 0 || settings.captainRewardAmount < 0) {
      showToast('error', 'Reward amounts cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const res = await referralService.updateSettings({
        sellerReferralEnabled: settings.sellerReferralEnabled,
        sellerRewardAmount: Number(settings.sellerRewardAmount),
        sellerRewardTrigger: settings.sellerRewardTrigger,
        captainReferralEnabled: settings.captainReferralEnabled,
        captainRewardAmount: Number(settings.captainRewardAmount),
        captainRewardTrigger: settings.captainRewardTrigger,
      });

      if (res && res.success) {
        showToast('success', 'Referral settings updated successfully! Changes take effect instantly.');
        if (res.settings) setSettings(res.settings);
      } else {
        showToast('error', res?.message || 'Failed to update settings.');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('error', err?.response?.data?.message || 'Server error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast */}
      {toastMsg.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md ${
          toastMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-100 text-[#ff5500] rounded-xl">
              <Settings size={22} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Referral Settings</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure separate reward amounts, lifecycle trigger events, and switches for Seller and Captain programs.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#ff5500]' : ''} />
          <span>Reload Settings</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ════════ SELLER REFERRAL CARD ════════ */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ff5500] flex items-center justify-center">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 m-0">Seller Referral Program</h3>
                  <p className="text-[11px] text-slate-500 m-0">Incentives for onboarded store partners</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, sellerReferralEnabled: !prev.sellerReferralEnabled }))}
                className="cursor-pointer bg-transparent border-none p-0 flex items-center"
              >
                {settings.sellerReferralEnabled ? (
                  <ToggleRight size={36} className="text-[#ff5500]" />
                ) : (
                  <ToggleLeft size={36} className="text-slate-300" />
                )}
              </button>
            </div>

            <div className="space-y-4">
              {/* Reward Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Reward Amount per Referral (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={settings.sellerRewardAmount}
                    onChange={(e) => setSettings(prev => ({ ...prev, sellerRewardAmount: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-900 outline-none focus:border-[#ff5500]"
                  />
                  <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-400 m-0">Amount credited directly to the referrer seller's wallet.</p>
              </div>

              {/* Reward Trigger Event */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Reward Trigger Event <span className="text-red-500">*</span>
                </label>
                <select
                  value={settings.sellerRewardTrigger}
                  onChange={(e) => setSettings(prev => ({ ...prev, sellerRewardTrigger: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#ff5500]"
                >
                  <option value="admin_approval">Admin Approval (Recommended - Safe against fraud)</option>
                  <option value="registration">Registration (Instant upon OTP verification)</option>
                  <option value="first_order">First Completed Order</option>
                </select>
                <p className="text-[11px] text-slate-400 m-0">When the wallet reward is automatically released.</p>
              </div>
            </div>
          </div>

          {/* ════════ CAPTAIN REFERRAL CARD ════════ */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 m-0">Captain Referral Program</h3>
                  <p className="text-[11px] text-slate-500 m-0">Incentives for delivery driver referrals</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, captainReferralEnabled: !prev.captainReferralEnabled }))}
                className="cursor-pointer bg-transparent border-none p-0 flex items-center"
              >
                {settings.captainReferralEnabled ? (
                  <ToggleRight size={36} className="text-teal-600" />
                ) : (
                  <ToggleLeft size={36} className="text-slate-300" />
                )}
              </button>
            </div>

            <div className="space-y-4">
              {/* Reward Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Reward Amount per Referral (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={settings.captainRewardAmount}
                    onChange={(e) => setSettings(prev => ({ ...prev, captainRewardAmount: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-900 outline-none focus:border-teal-600"
                  />
                  <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-400 m-0">Amount credited directly to the referrer captain's wallet.</p>
              </div>

              {/* Reward Trigger Event */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Reward Trigger Event <span className="text-red-500">*</span>
                </label>
                <select
                  value={settings.captainRewardTrigger}
                  onChange={(e) => setSettings(prev => ({ ...prev, captainRewardTrigger: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-600"
                >
                  <option value="admin_approval">Admin Approval (Recommended - Safe against fraud)</option>
                  <option value="registration">Registration (Instant upon OTP verification)</option>
                  <option value="first_order">First Completed Order</option>
                </select>
                <p className="text-[11px] text-slate-400 m-0">When the wallet reward is automatically released.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[#ff5500] hover:bg-[#e64d00] text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. REFERRAL LIST / HISTORY COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export const ReferralList = () => {
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Referral for Modal
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchReferrals = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = {
        page: pageNum,
        limit: 15,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const res = await referralService.getAllReferrals(params);
      if (res && res.success) {
        setReferrals(res.referrals || []);
        setTotalCount(res.total || 0);
        setPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching referrals list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals(1);
  }, [roleFilter, statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReferrals(1);
  };

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback({ type: '', text: '' }), 4000);
  };

  const handleStatusUpdate = async (id, action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Please enter a rejection reason (optional):') || 'Rejected by Admin';
    }

    setActionLoading(true);
    try {
      const res = await referralService.updateReferralStatus(id, action, reason);
      if (res && res.success) {
        showFeedback('success', res.message || `Referral status updated to ${action}`);
        if (selectedReferral && selectedReferral._id === id) {
          setSelectedReferral(res.referral);
        }
        fetchReferrals(page);
      } else {
        showFeedback('error', res?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Status update error:', err);
      showFeedback('error', err?.response?.data?.message || 'Failed to update referral status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreditReward = async (id) => {
    if (!window.confirm('Are you sure you want to credit this referral reward bonus into the referrer’s wallet now?')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await referralService.creditReward(id);
      if (res && res.success) {
        showFeedback('success', res.message || 'Reward credited successfully!');
        if (selectedReferral && selectedReferral._id === id) {
          setSelectedReferral(null);
        }
        fetchReferrals(page);
      } else {
        showFeedback('error', res?.message || 'Failed to credit reward');
      }
    } catch (err) {
      console.error('Credit reward error:', err);
      showFeedback('error', err?.response?.data?.message || 'Reward crediting failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Rewarded':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Rewarded</span>;
      case 'Approved':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">Approved</span>;
      case 'Qualified':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">Qualified</span>;
      case 'Registered':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Registered</span>;
      case 'Rejected':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">Rejected</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{status || 'Pending'}</span>;
    }
  };

  const getRewardBadge = (status) => {
    switch (status) {
      case 'Credited':
        return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Credited</span>;
      case 'Failed':
        return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">✕ Failed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-50 text-slate-600 border border-slate-200">⏳ Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-100 text-[#ff5500] rounded-xl">
              <Users size={22} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Referral Management & Logs</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete database of seller & captain referrals, approvals, fraud controls, and wallet credits.
          </p>
        </div>

        <button
          onClick={() => fetchReferrals(page)}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#ff5500]' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              placeholder="Search by code, referrer, referred name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#ff5500]"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#ff5500]"
            >
              <option value="">All Roles</option>
              <option value="seller">Seller Referrals</option>
              <option value="captain">Captain Referrals</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#ff5500]"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Registered">Registered</option>
              <option value="Approved">Approved</option>
              <option value="Qualified">Qualified</option>
              <option value="Rewarded">Rewarded</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-[#ff5500] hover:bg-[#e64d00] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Search size={14} />
              <span>Search</span>
            </button>
            {(search || roleFilter || statusFilter || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('');
                  setStatusFilter('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                title="Clear Filters"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </form>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <span className="font-bold flex items-center gap-1.5 text-slate-500">
            <Calendar size={14} /> Date Range:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#ff5500]"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#ff5500]"
            />
          </div>
          <span className="ml-auto font-bold text-slate-400">
            Found {totalCount} records
          </span>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Referrer</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Referred User</th>
                <th className="py-3 px-4">Registered On</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reward</th>
                <th className="py-3 px-4">Reward Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 size={22} className="animate-spin mx-auto mb-2 text-[#ff5500]" />
                    <span>Loading referral records...</span>
                  </td>
                </tr>
              ) : referrals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Gift size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700 m-0">No referral entries found</p>
                    <p className="text-[11px] text-slate-400 m-0 mt-0.5">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              ) : (
                referrals.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Referrer */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {item.referrerId?.businessName || item.referrerId?.name || 'User'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.referrerId?.phone || '—'}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                        item.referrerRole === 'seller' ? 'bg-orange-50 text-[#ff5500] border border-orange-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}>
                        {item.referrerRole === 'seller' ? <Store size={11} /> : <Truck size={11} />}
                        {item.referrerRole}
                      </span>
                    </td>

                    {/* Referral Code */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {item.referralCode}
                    </td>

                    {/* Referred User */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.referredName || '—'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.referredPhone || (item.referredId?.phone ? item.referredId.phone : '—')}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-slate-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : '—'}
                    </td>

                    {/* Referral Status */}
                    <td className="py-3 px-4">
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Reward Amount */}
                    <td className="py-3 px-4 font-black text-slate-900">
                      ₹{item.rewardAmount || 0}
                    </td>

                    {/* Reward Status */}
                    <td className="py-3 px-4">
                      {getRewardBadge(item.rewardStatus)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details */}
                        <button
                          onClick={() => setSelectedReferral(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer border-none"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Approve (if not yet rewarded or approved) */}
                        {(item.status === 'Pending' || item.status === 'Registered') && (
                          <button
                            onClick={() => handleStatusUpdate(item._id, 'approve')}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer border border-emerald-200"
                            title="Approve Referral"
                          >
                            <Check size={15} />
                          </button>
                        )}

                        {/* Reject */}
                        {(item.status === 'Pending' || item.status === 'Registered') && (
                          <button
                            onClick={() => handleStatusUpdate(item._id, 'reject')}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer border border-rose-200"
                            title="Reject Referral"
                          >
                            <X size={15} />
                          </button>
                        )}

                        {/* Credit Reward Button (if Approved or Qualified and not yet credited) */}
                        {item.status !== 'Rewarded' && item.status !== 'Rejected' && item.rewardStatus !== 'Credited' && (
                          <button
                            onClick={() => handleCreditReward(item._id)}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded-lg bg-[#ff5500] hover:bg-[#e64d00] text-white text-[11px] font-bold transition-colors cursor-pointer border-none flex items-center gap-1 shadow-2xs"
                            title="Credit Reward Now"
                          >
                            <DollarSign size={13} />
                            <span>Credit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchReferrals(page - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchReferrals(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════════ DETAILS MODAL ════════ */}
      {selectedReferral && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#002625] to-[#0b3d3b] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl text-[#ff5500]">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold m-0 text-white">Referral Details</h3>
                  <p className="text-[11px] text-slate-300 m-0 font-mono">ID: {selectedReferral._id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReferral(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer border-none"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
              
              {/* Status Chips */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Status</span>
                  {getStatusBadge(selectedReferral.status)}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Reward Status</span>
                  {getRewardBadge(selectedReferral.rewardStatus)}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Reward Amount</span>
                  <span className="text-base font-black text-slate-900">₹{selectedReferral.rewardAmount || 0}</span>
                </div>
              </div>

              {/* Referrer & Referred 2-Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-orange-50/60 border border-orange-100 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-[#ff5500] tracking-wider block">
                    Referrer (Who Shared)
                  </span>
                  <p className="font-extrabold text-sm text-slate-900 m-0">
                    {selectedReferral.referrerId?.businessName || selectedReferral.referrerId?.name || 'User'}
                  </p>
                  <p className="text-slate-600 m-0">Role: <span className="font-bold capitalize">{selectedReferral.referrerRole}</span></p>
                  <p className="text-slate-600 font-mono m-0">Phone: {selectedReferral.referrerId?.phone || '—'}</p>
                  <p className="text-slate-600 font-mono m-0">Code: <span className="font-bold">{selectedReferral.referralCode}</span></p>
                </div>

                <div className="p-4 bg-teal-50/60 border border-teal-100 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-teal-700 tracking-wider block">
                    Referred User (Who Joined)
                  </span>
                  <p className="font-extrabold text-sm text-slate-900 m-0">
                    {selectedReferral.referredName || '—'}
                  </p>
                  <p className="text-slate-600 m-0">Role: <span className="font-bold capitalize">{selectedReferral.referredRole}</span></p>
                  <p className="text-slate-600 font-mono m-0">Phone: {selectedReferral.referredPhone || (selectedReferral.referredId?.phone ? selectedReferral.referredId.phone : '—')}</p>
                  <p className="text-slate-600 font-mono m-0">ID: {selectedReferral.referredId?._id || selectedReferral.referredId || 'Pending'}</p>
                </div>
              </div>

              {/* Timeline Info */}
              <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Audit Timestamps</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>Created: <span className="font-bold">{selectedReferral.createdAt ? new Date(selectedReferral.createdAt).toLocaleString() : '—'}</span></div>
                  <div>Approved: <span className="font-bold">{selectedReferral.approvedAt ? new Date(selectedReferral.approvedAt).toLocaleString() : '—'}</span></div>
                  <div>Rewarded: <span className="font-bold">{selectedReferral.rewardedAt ? new Date(selectedReferral.rewardedAt).toLocaleString() : '—'}</span></div>
                  <div>Rejected: <span className="font-bold">{selectedReferral.rejectedAt ? new Date(selectedReferral.rejectedAt).toLocaleString() : '—'}</span></div>
                </div>

                {selectedReferral.rewardTransactionId && (
                  <div className="pt-2 border-t border-slate-200/80 text-[11px] text-emerald-700 font-mono">
                    Transaction ID: <span className="font-bold">{selectedReferral.rewardTransactionId}</span>
                  </div>
                )}

                {selectedReferral.rejectionReason && (
                  <div className="pt-2 border-t border-slate-200/80 text-[11px] text-rose-700">
                    Rejection Reason: <span className="font-bold">{selectedReferral.rejectionReason}</span>
                  </div>
                )}
              </div>

              {/* Action Controls in Modal */}
              <div className="pt-2 flex flex-wrap gap-2">
                {selectedReferral.status !== 'Rewarded' && selectedReferral.status !== 'Rejected' && selectedReferral.rewardStatus !== 'Credited' && (
                  <button
                    onClick={() => handleCreditReward(selectedReferral._id)}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 px-4 bg-[#ff5500] hover:bg-[#e64d00] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <DollarSign size={14} /> Credit Reward Now
                  </button>
                )}

                {(selectedReferral.status === 'Pending' || selectedReferral.status === 'Registered') && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(selectedReferral._id, 'approve')}
                      disabled={actionLoading}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedReferral._id, 'reject')}
                      disabled={actionLoading}
                      className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. UNIFIED REFERRAL MANAGEMENT CONTAINER
// ══════════════════════════════════════════════════════════════════════════════
export const ReferralManagement = ({ defaultTab = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'bg-[#002625] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Gift size={15} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-[#002625] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Settings size={15} />
          <span>Referral Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-2 ${
            activeTab === 'list'
              ? 'bg-[#002625] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users size={15} />
          <span>All Referrals List</span>
        </button>
      </div>

      {/* Render Active View */}
      {activeTab === 'dashboard' && <ReferralDashboard onNavigateTab={setActiveTab} />}
      {activeTab === 'settings' && <ReferralSettings />}
      {activeTab === 'list' && <ReferralList />}
    </div>
  );
};

export default ReferralManagement;
