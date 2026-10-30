import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, AlertTriangle, Star, Zap, Shield, CreditCard, RefreshCw, ChevronRight, Crown, Calendar, Receipt, Banknote } from 'lucide-react';
import { membershipService } from '../../../services/authService';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  expired: { label: 'Expired', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
  pending_payment: { label: 'Pending Confirmation', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: XCircle },
  none: { label: 'No Membership', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: AlertTriangle },
};

const PLAN_ICONS = { monthly: Zap, halfYearly: Star, yearly: Crown };
const durationLabel = (t) => ({ monthly: '1 Month', halfYearly: '6 Months', yearly: '12 Months' }[t] || t);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysLeft = (exp) => {
  if (!exp) return null;
  const diff = new Date(exp) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const CaptainMembership = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [membership, setMembership] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('plans');

  const captainData = (() => { try { return JSON.parse(localStorage.getItem('sathiseller_captain_data') || '{}'); } catch { return {}; } })();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, memRes, histRes] = await Promise.all([
        membershipService.getCaptainPlans(true).catch(() => ({ plans: [] })),
        membershipService.getCaptainMembership().catch(() => ({ membership: null })),
        membershipService.getCaptainMembershipHistory().catch(() => ({ memberships: [] })),
      ]);
      setPlans(plansRes.plans || []);
      setMembership(memRes.membership || null);
      setHistory(histRes.memberships || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan); setShowPaymentForm(true); setErrorMsg(''); setSuccessMsg('');
  };

  const handleSubmitPayment = async () => {
    if (!selectedPlan) return;
    setSubmitting(true); setErrorMsg('');
    try {
      const payload = { planId: selectedPlan._id, paymentReference: paymentRef, paymentMethod };
      const isRenewal = membership && ['active', 'expired'].includes(membership.membershipStatus);
      const fn = isRenewal ? membershipService.renewCaptainMembership : membershipService.purchaseCaptainMembership;
      const res = await fn(payload);
      if (res.success) {
        setSuccessMsg('Cash on Delivery request submitted! Admin will verify and activate your membership.');
        setShowPaymentForm(false); setPaymentRef('');
        await loadData();
        setActiveTab('history');
      } else { setErrorMsg(res.message || 'Failed to submit'); }
    } catch (err) { setErrorMsg(err?.response?.data?.message || err.message || 'Error submitting payment'); }
    finally { setSubmitting(false); }
  };

  const currentStatus = membership?.membershipStatus || 'none';
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.none;
  const StatusIcon = statusCfg.icon;
  const isRenewal = membership && ['active', 'expired'].includes(membership.membershipStatus);
  const remaining = membership?.expiryDate ? daysLeft(membership.expiryDate) : null;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center"><div className="w-10 h-10 border-4 border-[#0ea5e9] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div><p className="text-slate-500 font-medium text-sm">Loading...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => navigate('/captain/dashboard')} 
              className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
              aria-label="Back to dashboard"
            >
              <ChevronRight size={18} className="text-slate-500 rotate-180" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 leading-tight">Captain Membership</h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">{captainData.name || 'Captain Partner'}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
            <StatusIcon size={12} />
            <span>{statusCfg.label}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3 sm:space-y-4">
        {successMsg && (
          <div className="p-3 sm:p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
            <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm font-medium text-emerald-700">{successMsg}</p>
          </div>
        )}

        {/* Active Plan Card */}
        {membership?.membershipStatus === 'active' && (
          <div className="bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-white shadow-lg shadow-sky-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sky-100 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5">Active Plan</p>
                <h2 className="text-lg sm:text-2xl font-black">{membership.planName}</h2>
                <p className="text-sky-200 text-xs sm:text-sm font-medium">{durationLabel(membership.durationType)}</p>
              </div>
              <div className="text-right">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-1"><Crown size={20} /></div>
                {remaining !== null && <p className="text-sky-100 text-[11px] sm:text-xs font-bold">{remaining}d left</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 mb-3">
              <div><p className="text-sky-200 text-[10px] sm:text-xs font-medium">Started</p><p className="text-white text-xs sm:text-sm font-bold mt-0.5">{formatDate(membership.startDate)}</p></div>
              <div><p className="text-sky-200 text-[10px] sm:text-xs font-medium">Expires</p><p className="text-white text-xs sm:text-sm font-bold mt-0.5">{formatDate(membership.expiryDate)}</p></div>
              <div><p className="text-sky-200 text-[10px] sm:text-xs font-medium">Paid</p><p className="text-white text-xs sm:text-sm font-bold mt-0.5">₹{membership.priceAtPurchase?.toLocaleString()}</p></div>
            </div>
            {remaining !== null && remaining <= 30 && (
              <button onClick={() => setActiveTab('plans')} className="w-full py-2 sm:py-2.5 bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer border border-white/30">
                <RefreshCw size={13} className="inline mr-1.5" />Renew Now
              </button>
            )}
          </div>
        )}

        {/* Pending Notice */}
        {membership?.membershipStatus === 'pending_payment' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 flex items-start gap-2.5">
            <Clock size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-800 text-xs sm:text-sm mb-0.5">Awaiting Payment Verification</h3>
              <p className="text-amber-700 text-xs leading-relaxed">Your payment for <strong>{membership.planName}</strong> is under review. Ref: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[11px] font-mono">{membership.transactionId}</code></p>
            </div>
          </div>
        )}

        {/* Expired Notice */}
        {membership?.membershipStatus === 'expired' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 flex items-start gap-2.5">
            <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 text-xs sm:text-sm mb-0.5">Membership Expired</h3>
              <p className="text-red-700 text-xs leading-relaxed">Your <strong>{membership.planName}</strong> expired on {formatDate(membership.expiryDate)}. Renew to regain access to your captain panel.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
          {[{ id: 'plans', label: 'Choose Plan' }, { id: 'history', label: 'Payment History' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer border-none ${activeTab === t.id ? 'bg-[#0ea5e9] text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 bg-transparent'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Plans */}
        {activeTab === 'plans' && (
          plans.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><Shield size={36} className="mx-auto mb-2 opacity-30" /><p className="font-medium text-xs sm:text-sm">No plans available</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {plans.map((plan) => {
                const PlanIcon = PLAN_ICONS[plan.durationType] || Star;
                const isPopular = plan.durationType === 'halfYearly';
                return (
                  <div key={plan._id} className={`relative bg-white rounded-2xl border-2 p-3.5 sm:p-5 transition-all hover:shadow-md ${isPopular ? 'border-[#0ea5e9] shadow-md shadow-sky-50' : 'border-slate-200'}`}>
                    {isPopular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0ea5e9] text-white text-[10px] font-black px-3 py-0.5 rounded-full shadow-xs tracking-wider uppercase">MOST POPULAR</div>}
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${isPopular ? 'bg-[#0ea5e9] text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                        <PlanIcon size={18} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {durationLabel(plan.durationType)}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-slate-800 mb-0.5">{plan.name}</h3>

                    <div className="mb-2">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">₹{plan.price?.toLocaleString()}</span>
                      <span className="text-slate-400 text-xs font-medium"> /{durationLabel(plan.durationType).toLowerCase()}</span>
                    </div>

                    {plan.description && <p className="text-xs text-slate-500 mb-2.5 leading-snug line-clamp-2">{plan.description}</p>}

                    {plan.features?.length > 0 && (
                      <ul className="space-y-1.5 mb-3.5 border-t border-slate-100 pt-2">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 font-medium leading-tight">
                            <CheckCircle size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={membership?.membershipStatus === 'pending_payment'}
                      className={`w-full py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed ${isPopular ? 'bg-[#0ea5e9] text-white hover:bg-[#0369a1] shadow-md shadow-sky-100 active:scale-[0.99]' : 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-[0.99]'}`}
                    >
                      {isRenewal ? 'Renew with this Plan' : 'Get Started'}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Membership & Payment History</h3>
              <span className="text-[11px] text-slate-400">{history.length} record{history.length !== 1 ? 's' : ''}</span>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-10 text-slate-400"><Receipt size={32} className="mx-auto mb-2 opacity-30" /><p className="font-medium text-xs sm:text-sm">No records yet</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((h) => {
                  const sc = STATUS_CONFIG[h.membershipStatus] || STATUS_CONFIG.none;
                  const HIcon = sc.icon;
                  return (
                    <div key={h._id} className="px-3.5 py-3 sm:px-4 sm:py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${sc.bg} border ${sc.border}`}><HIcon size={14} className={sc.color} /></div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs sm:text-sm">{h.planName}</p>
                          <p className="text-[11px] text-slate-500">{formatDate(h.startDate)} → {formatDate(h.expiryDate)}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{h.transactionId}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-black text-slate-800 text-xs sm:text-sm mb-0.5">₹{h.priceAtPurchase?.toLocaleString()}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentForm && selectedPlan && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentForm(false); }}
        >
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl max-h-[92dvh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-800">Complete Payment</h2>
                <p className="text-[11px] text-slate-400 font-medium">Activate your captain membership</p>
              </div>
              <button 
                onClick={() => setShowPaymentForm(false)} 
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors cursor-pointer border-none bg-slate-50 text-slate-400 hover:text-slate-600 text-sm font-bold"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto flex-1 overscroll-contain">
              {/* Selected Plan Summary */}
              <div className="bg-gradient-to-r from-sky-50 to-amber-50/60 border border-sky-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-0.5">Selected Plan</p>
                  <p className="font-black text-slate-800 text-sm sm:text-base leading-tight">{selectedPlan.name}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{durationLabel(selectedPlan.durationType)}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-[#0ea5e9]">₹{selectedPlan.price?.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 block font-medium">one-time</span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                <div className="p-2.5 sm:p-3 bg-sky-50/70 border-2 border-[#0ea5e9] rounded-xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#0ea5e9] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Banknote size={17} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-xs sm:text-sm">Cash on Delivery</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">Pay cash directly upon confirmation</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-[#0ea5e9] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Selected</span>
                </div>
              </div>

              {/* Contact / Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input 
                  type="text" 
                  value={paymentRef} 
                  onChange={(e) => setPaymentRef(e.target.value)} 
                  placeholder="Enter phone number or remarks..." 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium outline-none focus:border-[#0ea5e9] transition-colors bg-slate-50 focus:bg-white" 
                />
              </div>

              {/* Info Box */}
              <div className="bg-sky-50/80 border border-sky-100 rounded-xl p-2.5 text-sky-900 leading-relaxed text-[11px] sm:text-xs">
                <p className="flex items-start gap-1.5 font-medium">
                  <span className="shrink-0 text-sm">💵</span>
                  <span>
                    Submit this request to choose Cash on Delivery. Pay <strong>₹{selectedPlan.price?.toLocaleString()}</strong> in cash. The admin will verify and activate your membership plan.
                  </span>
                </p>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-xl">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Modal Footer / Confirm Button */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-white shrink-0">
              <button 
                onClick={handleSubmitPayment} 
                disabled={submitting} 
                className="w-full py-2.5 sm:py-3 bg-[#0ea5e9] hover:bg-[#0369a1] active:bg-[#0284c7] text-white font-black text-xs sm:text-sm rounded-xl transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 border-none shadow-md shadow-sky-200 active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Banknote size={16} />
                    Confirm Cash on Delivery Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaptainMembership;
