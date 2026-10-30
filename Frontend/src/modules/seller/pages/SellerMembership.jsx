import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, Clock, XCircle, AlertTriangle, Star, Zap, Shield, CreditCard, 
  RefreshCw, ChevronRight, Crown, Calendar, Receipt, Sparkles, Lock, ArrowRight, Wallet,
  Building2
} from 'lucide-react';
import { membershipService } from '../../../services/authService';
import { loadRazorpaySdk } from '../../../utils/razorpay';

const STATUS_CONFIG = {
  active: { label: 'Active Plan', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  expired: { label: 'Expired', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
  pending_payment: { label: 'Pending Payment', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: XCircle },
  none: { label: 'No Active Membership', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: AlertTriangle },
};

const PLAN_ICONS = { monthly: Zap, halfYearly: Star, yearly: Crown };
const durationLabel = (t) => ({ monthly: '1 Month', halfYearly: '6 Months', yearly: '12 Months' }[t] || t);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysLeft = (exp) => {
  if (!exp) return null;
  const end = new Date(exp);
  const now = new Date();
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((endDay - nowDay) / (1000 * 60 * 60 * 24)));
};

const SellerMembership = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [membership, setMembership] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('plans');

  const sellerData = (() => { 
    try { 
      return JSON.parse(localStorage.getItem('sathiseller_seller_data') || '{}'); 
    } catch { 
      return {}; 
    } 
  })();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, memRes, histRes] = await Promise.all([
        membershipService.getSellerPlans().catch(() => ({ plans: [] })),
        membershipService.getSellerMembership().catch(() => ({ membership: null })),
        membershipService.getSellerMembershipHistory().catch(() => ({ memberships: [] })),
      ]);
      setPlans(plansRes.plans || []);
      setMembership(memRes.membership || null);
      setHistory(histRes.memberships || []);
    } catch (e) { 
      console.error('Error loading membership data:', e); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowCheckoutModal(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePayWithRazorpay = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const isLoaded = await loadRazorpaySdk();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 1. Create Razorpay order on backend
      const orderRes = await membershipService.createRazorpayOrder(selectedPlan._id, 'seller');
      if (!orderRes.success || !orderRes.order) {
        throw new Error(orderRes.message || 'Could not initiate payment order');
      }

      const isRenewal = membership && ['active', 'expired'].includes(membership.membershipStatus);
      const razorpayKey = orderRes.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c';

      // 2. Configure Razorpay Checkout options
      const options = {
        key: razorpayKey,
        amount: orderRes.order.amount,
        currency: orderRes.order.currency || 'INR',
        name: 'Sathi Seller',
        description: `${selectedPlan.name} Subscription`,
        order_id: orderRes.order.id,
        prefill: {
          name: sellerData.ownerName || sellerData.businessName || 'Seller',
          email: sellerData.email || '',
          contact: sellerData.phone || '',
          method: 'netbanking',
        },
        theme: {
          color: '#ff5500',
        },
        handler: async (response) => {
          try {
            setSubmitting(true);
            const verificationPayload = {
              planId: selectedPlan._id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            };

            const fn = isRenewal 
              ? membershipService.renewSellerMembership 
              : membershipService.purchaseSellerMembership;

            const res = await fn(verificationPayload);
            if (res.success) {
              localStorage.removeItem('sathiseller_seller_requires_membership');
              setSuccessMsg(`🎉 Payment successful! Your "${selectedPlan.name}" has been activated instantly.`);
              setShowCheckoutModal(false);
              setSelectedPlan(null);
              await loadData();
              setActiveTab('plans');
            } else {
              setErrorMsg(res.message || 'Payment verification failed.');
            }
          } catch (err) {
            console.error('Membership activation error:', err);
            setErrorMsg(err?.response?.data?.message || err.message || 'Failed to verify payment with server.');
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setSubmitting(false);
        setErrorMsg(resp?.error?.description || 'Payment was unsuccessful. Please try again.');
      });
      rzp.open();
    } catch (err) {
      console.error('Razorpay checkout error:', err);
      setErrorMsg(err?.response?.data?.message || err.message || 'Could not launch payment gateway.');
      setSubmitting(false);
    }
  };

  const currentStatus = membership?.membershipStatus || 'none';
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.none;
  const StatusIcon = statusCfg.icon;
  const isRenewal = membership && ['active', 'expired'].includes(membership.membershipStatus);
  const remaining = membership?.expiryDate ? daysLeft(membership.expiryDate) : null;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#ff5500] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-slate-500 font-medium text-sm">Loading membership details...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const active =
                  membership?.membershipStatus === 'active' &&
                  membership?.expiryDate &&
                  new Date(membership.expiryDate) > new Date();
                navigate(active ? '/seller/dashboard' : '/seller/login');
              }} 
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
              title="Back"
            >
              <ChevronRight size={20} className="text-slate-500 rotate-180" />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-800">Seller Membership</h1>
              <p className="text-xs text-slate-500 font-medium">{sellerData.businessName || 'Your Store'}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
            <StatusIcon size={13} />
            {statusCfg.label}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Success Alert Banner */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
            <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-emerald-800">{successMsg}</p>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
            <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Active Plan Hero Card */}
        {membership?.membershipStatus === 'active' && (
          <div className="bg-gradient-to-br from-[#ff5500] via-[#ea4c00] to-[#c73e00] rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles size={13} /> Active Subscription
                </div>
                <h2 className="text-2xl sm:text-3xl font-black">{membership.planName}</h2>
                <p className="text-orange-100 text-sm font-medium mt-0.5">{durationLabel(membership.durationType)} Billing Cycle</p>
              </div>
              <div className="text-right">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-1 text-white">
                  <Crown size={26} />
                </div>
                {remaining !== null && (
                  <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-md mt-1">
                    {remaining} {remaining === 1 ? 'day' : 'days'} left
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-white/15 backdrop-blur-sm rounded-2xl p-4 mb-5 border border-white/20">
              <div>
                <p className="text-orange-100 text-[11px] font-semibold uppercase">Activated On</p>
                <p className="text-white text-sm font-black mt-0.5">{formatDate(membership.startDate)}</p>
              </div>
              <div>
                <p className="text-orange-100 text-[11px] font-semibold uppercase">Valid Until</p>
                <p className="text-white text-sm font-black mt-0.5">{formatDate(membership.expiryDate)}</p>
              </div>
              <div>
                <p className="text-orange-100 text-[11px] font-semibold uppercase">Amount Paid</p>
                <p className="text-white text-sm font-black mt-0.5">₹{membership.priceAtPurchase?.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-orange-100 pt-2 border-t border-white/20">
              <span className="font-mono">Ref ID: {membership.transactionId}</span>
              <span className="inline-flex items-center gap-1 font-bold text-white bg-emerald-500/30 px-2 py-0.5 rounded-full border border-emerald-300/40">
                <CheckCircle size={12} /> Auto-Verified Online Payment
              </span>
            </div>
          </div>
        )}

        {/* Expired Notice */}
        {membership?.membershipStatus === 'expired' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
            <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 mb-1">Membership Expired</h3>
              <p className="text-red-700 text-sm">
                Your <strong>{membership.planName}</strong> expired on {formatDate(membership.expiryDate)}. Please choose a plan below to renew and maintain your seller store operations.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1">
          {[{ id: 'plans', label: 'Membership Plans' }, { id: 'history', label: 'Billing & Invoices' }].map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)} 
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer border-none ${
                activeTab === t.id 
                  ? 'bg-[#ff5500] text-white shadow-md shadow-orange-500/20' 
                  : 'text-slate-500 hover:text-slate-700 bg-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Membership Plans Grid */}
        {activeTab === 'plans' && (
          plans.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Shield size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">No plans available right now.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const PlanIcon = PLAN_ICONS[plan.durationType] || Star;
                const isPopular = plan.durationType === 'halfYearly';
                const isCurrentActive = membership?.membershipStatus === 'active' && membership?.planId === plan._id;

                return (
                  <div 
                    key={plan._id} 
                    className={`relative bg-white rounded-3xl border-2 p-6 transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between ${
                      isPopular 
                        ? 'border-[#ff5500] shadow-lg shadow-orange-100 ring-4 ring-orange-500/5' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#ff5500] text-white text-[11px] font-black tracking-wide px-4 py-1 rounded-full shadow-md">
                        MOST POPULAR
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          isPopular ? 'bg-[#ff5500] text-white shadow-md shadow-orange-300' : 'bg-orange-50 text-[#ff5500]'
                        }`}>
                          <PlanIcon size={24} />
                        </div>
                        {isCurrentActive && (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            Current Plan
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-black text-slate-900 mb-1">{plan.name}</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">
                        {durationLabel(plan.durationType)}
                      </p>

                      <div className="mb-5 pb-5 border-b border-slate-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-slate-900">₹{plan.price?.toLocaleString()}</span>
                          <span className="text-slate-400 text-sm font-semibold">/{durationLabel(plan.durationType).toLowerCase()}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 font-medium">Instant Online Activation via Razorpay</p>
                      </div>

                      {plan.description && (
                        <p className="text-xs text-slate-600 mb-5 leading-relaxed font-medium">{plan.description}</p>
                      )}

                      {plan.features?.length > 0 && (
                        <ul className="space-y-2.5 mb-6">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                              <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all cursor-pointer border-none flex items-center justify-center gap-2 ${
                        isPopular
                          ? 'bg-[#ff5500] text-white hover:bg-[#e64d00] shadow-lg shadow-orange-500/25 active:scale-[0.98]'
                          : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md active:scale-[0.98]'
                      }`}
                    >
                      <span>{isRenewal ? 'Renew with this Plan' : 'Subscribe & Activate'}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Billing History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Membership Invoices & Transactions</h3>
              <span className="text-xs font-semibold text-slate-400">{history.length} record{history.length !== 1 ? 's' : ''}</span>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-14 text-slate-400">
                <Receipt size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">No transaction records yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((h) => {
                  const sc = STATUS_CONFIG[h.membershipStatus] || STATUS_CONFIG.none;
                  const HIcon = sc.icon;
                  return (
                    <div key={h._id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sc.bg} border ${sc.border}`}>
                          <HIcon size={18} className={sc.color} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{h.planName}</p>
                          <p className="text-xs text-slate-500 font-medium">
                            {formatDate(h.startDate)} → {formatDate(h.expiryDate)}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">ID: {h.transactionId || h.paymentReference || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="font-black text-slate-900 text-sm mb-1">₹{h.priceAtPurchase?.toLocaleString()}</p>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} border ${sc.border}`}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Online Razorpay Checkout Modal */}
      {showCheckoutModal && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#ff5500] flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Online Membership Payment</h2>
                  <p className="text-xs text-slate-400 font-medium">Instant Activation via Razorpay</p>
                </div>
              </div>
              <button 
                onClick={() => { if (!submitting) setShowCheckoutModal(false); }} 
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-none bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Plan Summary Card */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/70 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Order Summary</span>
                  <span className="text-xs font-bold text-slate-500">{durationLabel(selectedPlan.durationType)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-slate-800">{selectedPlan.name}</span>
                  <span className="text-2xl font-black text-[#ff5500]">₹{selectedPlan.price?.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Channel */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Method</p>
                <div className="p-3 bg-orange-50/60 border border-orange-200 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#ff5500] text-white flex items-center justify-center shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs">Net Banking (Razorpay)</p>
                    <p className="text-[11px] text-slate-500 font-medium">All major banks supported (SBI, HDFC, ICICI, Axis, PNB & more)</p>
                  </div>
                </div>
              </div>

              {/* Instant Activation Guarantee */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5">
                <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                  <strong>Instant Activation:</strong> Once your payment completes successfully on Razorpay, your seller subscription and store privileges will activate immediately.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
                  {errorMsg}
                </div>
              )}

              {/* Pay Button */}
              <button 
                onClick={handlePayWithRazorpay} 
                disabled={submitting} 
                className="w-full py-4 bg-[#ff5500] hover:bg-[#e64d00] text-white font-black text-sm rounded-xl transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 border-none shadow-lg shadow-orange-500/25 active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Pay ₹{selectedPlan.price?.toLocaleString()} via Razorpay</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-400 font-medium flex items-center justify-center gap-1">
                <Shield size={12} className="text-emerald-500" /> 256-Bit Encrypted Razorpay Secure Gateway
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerMembership;
