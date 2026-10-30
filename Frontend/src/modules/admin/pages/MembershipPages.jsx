import React, { useState, useEffect } from 'react';
import { membershipService } from '../../../services/authService';
import {
  Plus, Pencil, Trash2, CheckCircle, XCircle, Clock, TrendingUp,
  Search, ChevronDown, RefreshCw, Shield, Crown, Users, DollarSign,
  AlertTriangle, ToggleLeft, ToggleRight, Eye, X
} from 'lucide-react';

// ─── Shared helpers ────────────────────────────────────────────────────────

const DURATION_LABELS = { monthly: 'Monthly (1 Mo)', halfYearly: 'Half-Yearly (6 Mo)', yearly: 'Yearly (12 Mo)' };
const DURATION_MONTHS = { monthly: 1, halfYearly: 6, yearly: 12 };

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  expired: { label: 'Expired', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
  pending_payment: { label: 'Pending Payment', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  cancelled: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
  none: { label: 'None', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatCurrency = (n) => n !== undefined && n !== null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const StatCard = ({ label, value, icon: Icon, color = 'text-slate-700', bg = 'bg-slate-50' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
      <Icon size={20} className={color} />
    </div>
    <div>
      <p className="text-xs text-slate-500 font-semibold">{label}</p>
      <p className="text-xl font-black text-slate-800">{value}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>;
};

// ─── Plan Form Modal ────────────────────────────────────────────────────────

const PlanFormModal = ({ plan, onSave, onClose, accentColor }) => {
  const [form, setForm] = useState({
    name: plan?.name || '',
    durationType: plan?.durationType || 'monthly',
    durationMonths: plan?.durationMonths || 1,
    price: plan?.price || '',
    description: plan?.description || '',
    features: plan?.features?.join('\n') || '',
    status: plan?.status || 'active',
    displayOrder: plan?.displayOrder || 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleDurationChange = (v) => {
    setForm(p => ({ ...p, durationType: v, durationMonths: DURATION_MONTHS[v] || 1 }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.durationType || !form.price) { setError('Name, duration, and price are required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        durationMonths: Number(form.durationMonths),
        displayOrder: Number(form.displayOrder),
        features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error saving plan');
    } finally { setSaving(false); }
  };

  const inputCls = `w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-${accentColor === '#ff5500' ? '[#ff5500]' : '[#0ea5e9]'} transition-colors`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-slate-800">{plan ? 'Edit Plan' : 'Create New Plan'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer border-none bg-transparent text-slate-400">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Plan Name *</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Monthly Starter" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Duration *</label>
                <select className={inputCls} value={form.durationType} onChange={e => handleDurationChange(e.target.value)}>
                  {Object.entries(DURATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Price (₹) *</label>
                <input type="number" className={inputCls} value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="999" min="0" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Status</label>
                <select className={inputCls} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Display Order</label>
                <input type="number" className={inputCls} value={form.displayOrder} onChange={e => setForm(p => ({ ...p, displayOrder: e.target.value }))} min="0" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Description</label>
              <textarea className={inputCls + ' resize-none'} rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief plan description..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Features (one per line)</label>
              <textarea className={inputCls + ' resize-none'} rows={5} value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} placeholder={"List up to 50 products\nOrder management\nWallet & payouts"} />
            </div>
            {error && <p className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer border-none hover:bg-slate-200 transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3 text-white font-bold rounded-xl cursor-pointer border-none transition-colors disabled:opacity-60" style={{ background: accentColor }}>{saving ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Confirm Payment Modal ──────────────────────────────────────────────────

const ConfirmPaymentModal = ({ sub, onConfirm, onClose, accentColor }) => {
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const name = sub.sellerId?.businessName || sub.captainId?.name || 'User';
  const phone = sub.sellerId?.phone || sub.captainId?.phone || '';
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">Confirm Payment</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer border-none bg-transparent text-slate-400">✕</button>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500 font-medium">User</span><span className="font-bold text-slate-800">{name} ({phone})</span></div>
          <div className="flex justify-between"><span className="text-slate-500 font-medium">Plan</span><span className="font-bold text-slate-800">{sub.planName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 font-medium">Amount</span><span className="font-black text-slate-800">{formatCurrency(sub.priceAtPurchase)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 font-medium">Ref</span><span className="font-mono text-xs text-slate-600">{sub.paymentReference || sub.transactionId}</span></div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Admin Note (Optional)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Verified cash payment..." className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-400 transition-colors" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer border-none hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={async () => { setConfirming(true); await onConfirm(sub._id, note); setConfirming(false); onClose(); }} disabled={confirming} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl cursor-pointer border-none transition-colors disabled:opacity-60">
            {confirming ? 'Activating...' : '✓ Confirm & Activate'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Plans Table ──────────────────────────────────────────────────────────

const PlansTable = ({ plans, onEdit, onDelete, onToggle, accentColor, loading }) => {
  if (loading) return <div className="text-center py-8 text-slate-400 text-sm">Loading plans...</div>;
  if (!plans.length) return (
    <div className="text-center py-16 text-slate-400">
      <Shield size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">No plans yet. Create your first plan above.</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {['Plan', 'Duration', 'Price', 'Status', 'Subscribers', 'Order', 'Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plans.map(plan => (
            <tr key={plan._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-bold text-slate-800">{plan.name}</p>
                {plan.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{plan.description}</p>}
              </td>
              <td className="px-4 py-3 text-slate-600 font-medium">{DURATION_LABELS[plan.durationType] || plan.durationType}</td>
              <td className="px-4 py-3 font-black text-slate-800">{formatCurrency(plan.price)}</td>
              <td className="px-4 py-3"><StatusBadge status={plan.status === 'active' ? 'active' : 'cancelled'} /></td>
              <td className="px-4 py-3">
                <div className="text-xs">
                  <span className="font-bold text-emerald-600">{plan.activeSubscribers || 0} active</span>
                  <span className="text-slate-400 ml-1">/ {plan.totalSubscribers || 0} total</span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500 font-medium">{plan.displayOrder}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onToggle(plan)} title={plan.status === 'active' ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer border-none bg-transparent text-slate-500 transition-colors">
                    {plan.status === 'active' ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => onEdit(plan)} className="p-1.5 rounded-lg hover:bg-blue-50 cursor-pointer border-none bg-transparent text-slate-500 hover:text-blue-500 transition-colors"><Pencil size={15} /></button>
                  <button onClick={() => onDelete(plan)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer border-none bg-transparent text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Subscriptions Table ──────────────────────────────────────────────────

const SubscriptionsTable = ({ subs, onConfirm, loading, role }) => {
  const nameKey = role === 'seller' ? 'sellerId' : 'captainId';
  const nameProp = role === 'seller' ? 'businessName' : 'name';
  if (loading) return <div className="text-center py-8 text-slate-400 text-sm">Loading subscriptions...</div>;
  if (!subs.length) return (
    <div className="text-center py-16 text-slate-400"><Users size={40} className="mx-auto mb-3 opacity-30" /><p className="font-medium">No subscriptions found</p></div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {['User', 'Plan', 'Amount', 'Status', 'Payment', 'Start → Expiry', 'Ref', 'Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subs.map(sub => (
            <tr key={sub._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-bold text-slate-800">
                  {sub[nameKey]?.[nameProp]
                    || sub[nameKey]?.ownerName
                    || sub[nameKey]?.businessName
                    || sub.captainName
                    || sub.sellerName
                    || 'N/A'}
                </p>
                <p className="text-xs text-slate-400">{sub[nameKey]?.phone || sub.captainPhone || ''}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-700">{sub.planName}</p>
                <p className="text-xs text-slate-400">{DURATION_LABELS[sub.durationType] || sub.durationType}</p>
              </td>
              <td className="px-4 py-3 font-black text-slate-800">{formatCurrency(sub.priceAtPurchase)}</td>
              <td className="px-4 py-3"><StatusBadge status={sub.membershipStatus} /></td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sub.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{sub.paymentStatus}</span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                {formatDate(sub.startDate)} → {formatDate(sub.expiryDate)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-xs truncate">{sub.paymentReference || sub.transactionId}</td>
              <td className="px-4 py-3">
                {sub.membershipStatus === 'pending_payment' && (
                  <button onClick={() => onConfirm(sub)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer border-none transition-colors whitespace-nowrap">
                    ✓ Confirm
                  </button>
                )}
                {sub.membershipStatus === 'active' && <span className="text-xs text-emerald-600 font-bold">✓ Active</span>}
                {sub.membershipStatus === 'expired' && <span className="text-xs text-red-500 font-bold">Expired</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Plan Management Component (Shared) ───────────────────────────────

const MembershipPlanManager = ({ role }) => {
  const isSeller = role === 'seller';
  const accentColor = isSeller ? '#ff5500' : '#0ea5e9';
  const accentLight = isSeller ? 'bg-orange-50' : 'bg-sky-50';
  const accentText = isSeller ? 'text-[#ff5500]' : 'text-[#0ea5e9]';

  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [error, setError] = useState('');

  const svc = isSeller ? {
    getPlans: membershipService.adminGetSellerPlans,
    createPlan: membershipService.adminCreateSellerPlan,
    updatePlan: membershipService.adminUpdateSellerPlan,
    togglePlan: membershipService.adminToggleSellerPlan,
    deletePlan: membershipService.adminDeleteSellerPlan,
    getStats: membershipService.adminGetSellerStats,
  } : {
    getPlans: membershipService.adminGetCaptainPlans,
    createPlan: membershipService.adminCreateCaptainPlan,
    updatePlan: membershipService.adminUpdateCaptainPlan,
    togglePlan: membershipService.adminToggleCaptainPlan,
    deletePlan: membershipService.adminDeleteCaptainPlan,
    getStats: membershipService.adminGetCaptainStats,
  };

  useEffect(() => { load(); }, [role]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [plansRes, statsRes] = await Promise.all([svc.getPlans(), svc.getStats()]);
      setPlans(plansRes.plans || []);
      setStats(statsRes.stats || {});
    } catch (e) { setError(e?.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const handleSave = async (data) => {
    if (editPlan) await svc.updatePlan(editPlan._id, data);
    else await svc.createPlan(data);
    await load();
  };

  const handleToggle = async (plan) => {
    if (!window.confirm(`${plan.status === 'active' ? 'Deactivate' : 'Activate'} "${plan.name}"?`)) return;
    await svc.togglePlan(plan._id);
    await load();
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(`Delete "${plan.name}"? This cannot be undone.`)) return;
    try {
      await svc.deletePlan(plan._id);
      await load();
    } catch (e) { alert(e?.response?.data?.message || 'Cannot delete plan'); }
  };

  const title = isSeller ? 'Seller Membership Plans' : 'Captain Membership Plans';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">Create and manage {role} membership plans, pricing, and benefits</p>
        </div>
        <button onClick={() => { setEditPlan(null); setShowForm(true); }} className="px-4 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer border-none transition-colors" style={{ background: accentColor }}>
          <Plus size={15} /> New Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active Members" value={stats.activeCount ?? 0} icon={Users} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Pending Payment" value={stats.pendingCount ?? 0} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Expired" value={stats.expiredCount ?? 0} icon={XCircle} color="text-red-500" bg="bg-red-50" />
        <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} color="text-blue-600" bg="bg-blue-50" />
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">All Plans ({plans.length})</h3>
          <button onClick={load} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer border-none bg-transparent text-slate-500 transition-colors"><RefreshCw size={15} /></button>
        </div>
        <PlansTable plans={plans} onEdit={(p) => { setEditPlan(p); setShowForm(true); }} onDelete={handleDelete} onToggle={handleToggle} accentColor={accentColor} loading={loading} />
      </div>

      {showForm && (
        <PlanFormModal
          plan={editPlan}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditPlan(null); }}
          accentColor={accentColor}
        />
      )}
    </div>
  );
};

// ─── Subscription Management Component (Shared) ────────────────────────────

const MembershipSubscriptionManager = ({ role }) => {
  const isSeller = role === 'seller';
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [confirmSub, setConfirmSub] = useState(null);
  const [error, setError] = useState('');

  const svc = isSeller ? {
    getSubs: membershipService.adminGetSellerSubscriptions,
    getPlans: membershipService.adminGetSellerPlans,
    confirmPayment: membershipService.adminConfirmSellerPayment,
  } : {
    getSubs: membershipService.adminGetCaptainSubscriptions,
    getPlans: membershipService.adminGetCaptainPlans,
    confirmPayment: membershipService.adminConfirmCaptainPayment,
  };

  useEffect(() => { load(); }, [role, statusFilter, planFilter]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.planId = planFilter;
      const [subsRes, plansRes] = await Promise.all([svc.getSubs(params), svc.getPlans()]);
      setSubs(subsRes.subscriptions || []);
      setPlans(plansRes.plans || []);
    } catch (e) { setError('Failed to load subscriptions'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async (id, note) => {
    try {
      await svc.confirmPayment(id, note);
      await load();
    } catch (e) { alert(e?.response?.data?.message || 'Failed to confirm payment'); }
  };

  const filtered = subs.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = s.sellerId?.businessName || s.captainId?.name || '';
    const phone = s.sellerId?.phone || s.captainId?.phone || '';
    return name.toLowerCase().includes(q) || phone.includes(q) || (s.transactionId || '').toLowerCase().includes(q);
  });

  const title = isSeller ? 'Seller Membership Subscriptions' : 'Captain Membership Subscriptions';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">View, search, filter, and confirm {role} membership payments</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, ref..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff5500]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:border-[#ff5500]">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:border-[#ff5500]">
          <option value="">All Plans</option>
          {plans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <button onClick={load} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer border-none text-slate-600 transition-colors"><RefreshCw size={14} /></button>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <SubscriptionsTable subs={filtered} onConfirm={setConfirmSub} loading={loading} role={role} />
      </div>

      {confirmSub && (
        <ConfirmPaymentModal
          sub={confirmSub}
          onConfirm={handleConfirm}
          onClose={() => setConfirmSub(null)}
          accentColor={isSeller ? '#ff5500' : '#0ea5e9'}
        />
      )}
    </div>
  );
};

// ─── Exported Components ──────────────────────────────────────────────────

export const SellerMembershipPlans = () => <MembershipPlanManager role="seller" />;
export const SellerMembershipSubscriptions = () => <MembershipSubscriptionManager role="seller" />;
export const CaptainMembershipPlans = () => <MembershipPlanManager role="captain" />;
export const CaptainMembershipSubscriptions = () => <MembershipSubscriptionManager role="captain" />;
